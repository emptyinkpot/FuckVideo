import { continueRender, delayRender } from "remotion";

/** 与 pipeline/config.py 保持一致：最细一级 257 个角点，其余各级 129。 */
export const FINEST_ZOOM = 9;
export const gridForZoom = (z: number) => (z >= FINEST_ZOOM ? 257 : 129);
export const NO_WATER = -32768;

export type TileData = {
  z: number;
  x: number;
  y: number;
  /** 网格角点数 */
  grid: number;
  /** (grid + 2) 的平方，米；第 0 行、第 0 列是分块外的一圈。 */
  height: Int16Array;
  /** grid 的平方，水面高度（米），NO_WATER 表示没有水。 */
  water: Int16Array;
  surfaceRes: number;
  /** surfaceRes 的平方，地表类别。 */
  surface: Uint8Array;
  normalRes: number;
  /** normalRes 的平方 × 2：逐像素向东、向北的坡度（atan 编码到 0..255） */
  slope: Uint8Array;
  horizonRes: number;
  /** horizonRes 的平方 × 8：北起顺时针 8 个方向的地平线仰角（每档 0.25°） */
  horizon: Uint8Array;
  minHeight: number;
  maxHeight: number;
  hasWater: boolean;
  /** 解压后占用的内存（字节） */
  bytes: number;
};

const tileContext = require.context("../../assets/tiles", true, /\.e3d$/);
const tileUrls = new Map<string, string>(
  tileContext.keys().map((key) => [key.replace(/^\.\//, "").replace(/\.e3d$/, ""), tileContext(key)]),
);

/** 已生成的地形分块数量；全新克隆的仓库还没运行 build_all.py 时为 0。 */
export const builtTileCount = tileUrls.size;

export const tileKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;
export const hasTile = (z: number, x: number, y: number) => tileUrls.has(tileKey(z, x, y));

/**
 * 已解压分块的内存上限。按最近使用排序，超出时先丢最久没用的；
 * 当前这一帧要用的分块不会被丢掉。丢掉的分块再次需要时重新加载。
 */
const TILE_BUDGET_BYTES = 256 * 1024 * 1024;
const cache = new Map<string, TileData>();
const pending = new Map<string, Promise<TileData>>();
let cacheBytes = 0;
let inUse = new Set<string>();

const evictTiles = () => {
  for (const [key, tile] of cache) {
    if (cacheBytes <= TILE_BUDGET_BYTES) break;
    if (inUse.has(key)) continue;
    cache.delete(key);
    cacheBytes -= tile.bytes;
  }
};

export const gunzip = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`earth3d: failed to fetch ${url} (${response.status})`);
  }
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
};

const parseTile = (z: number, x: number, y: number, buffer: ArrayBuffer): TileData => {
  const [grid, surfaceRes, normalRes, horizonRes] = new Uint16Array(buffer, 0, 4);
  const heightCount = (grid + 2) * (grid + 2);
  const waterCount = grid * grid;
  let offset = 8;
  const height = new Int16Array(buffer, offset, heightCount);
  offset += heightCount * 2;
  const water = new Int16Array(buffer, offset, waterCount);
  offset += waterCount * 2;
  const surface = new Uint8Array(buffer, offset, surfaceRes * surfaceRes);
  offset += surfaceRes * surfaceRes;
  const slope = new Uint8Array(buffer, offset, normalRes * normalRes * 2);
  offset += normalRes * normalRes * 2;
  const horizon = new Uint8Array(buffer, offset, horizonRes * horizonRes * 8);
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (let i = 0; i < height.length; i++) {
    if (height[i] < minHeight) minHeight = height[i];
    if (height[i] > maxHeight) maxHeight = height[i];
  }
  let hasWater = false;
  for (let i = 0; i < water.length; i++) {
    if (water[i] !== NO_WATER) {
      hasWater = true;
      break;
    }
  }
  return {
    z, x, y, grid, height, water, surfaceRes, surface, normalRes, slope, horizonRes, horizon,
    minHeight, maxHeight, hasWater, bytes: buffer.byteLength,
  };
};

export const getTile = (key: string) => {
  const tile = cache.get(key);
  if (tile) {
    // 最近用过的放到最后，淘汰时最后才轮到它
    cache.delete(key);
    cache.set(key, tile);
  }
  return tile;
};

/** 当前内存里分块的情况，用于检查内存占用。 */
export const tileCacheStats = () => ({ tiles: cache.size, bytes: cacheBytes, budget: TILE_BUDGET_BYTES });

/** 已加载到内存的分块数；数值变化说明有新的地形高度可用（贴地的线条据此重建）。 */
export const loadedTileCount = () => cache.size;

export const loadTile = (key: string): Promise<TileData> => {
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const url = tileUrls.get(key);
  if (!url) return Promise.reject(new Error(`earth3d: tile ${key} not built`));
  const [z, x, y] = key.split("/").map(Number);
  const promise = gunzip(url).then((buffer) => {
    const tile = parseTile(z, x, y, buffer);
    cache.set(key, tile);
    cacheBytes += tile.bytes;
    pending.delete(key);
    evictTiles();
    return tile;
  });
  pending.set(key, promise);
  return promise;
};

type Listener = () => void;
const listeners = new Set<Listener>();
export const subscribeTiles = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const batches = new Map<string, Promise<void>>();
const failed = new Set<string>();
const finishedHandles: number[] = [];

/**
 * 确保这些分块已加载。全部在缓存里时返回 true；否则发起加载，并用 delayRender
 * 挡住当前帧的截图。加载完成后通知订阅者重新渲染；订阅者把新分块画到画布上之后
 * 调用 releaseLoadedTiles()，截图才会放行。
 */
export const ensureTiles = (keys: string[]): boolean => {
  inUse = new Set(keys);
  // 只等真正存在、且没有加载失败过的分块；否则缺数据时会一直重试，截图永远等不到
  const missing = keys.filter((key) => tileUrls.has(key) && !failed.has(key) && !cache.has(key));
  if (missing.length === 0) return true;
  const batchKey = missing.slice().sort().join("|");
  if (!batches.has(batchKey)) {
    const handle = delayRender(`earth3d: loading ${missing.length} terrain tiles`, {
      timeoutInMilliseconds: 120000,
    });
    const finish = () => {
      batches.delete(batchKey);
      finishedHandles.push(handle);
      listeners.forEach((listener) => listener());
    };
    const batch = Promise.all(
      missing.map((key) =>
        loadTile(key).catch((error) => {
          console.error(error);
          failed.add(key);
        }),
      ),
    ).then(finish);
    batches.set(batchKey, batch);
  }
  return false;
};

/**
 * 河流、城市等其他异步数据也走同一套放行机制：数据就绪后通知场景重绘，
 * 重绘完成后才放行截图。
 */
export const holdUntilDrawn = <T,>(label: string, promise: Promise<T>): Promise<T> => {
  const handle = delayRender(`earth3d: ${label}`, { timeoutInMilliseconds: 120000 });
  const finish = () => {
    finishedHandles.push(handle);
    listeners.forEach((listener) => listener());
  };
  promise.then(finish, (error) => {
    console.error(error);
    finish();
  });
  return promise;
};

/** 场景已经用新数据重绘之后调用，放行对应的截图等待。 */
export const releaseLoadedTiles = () => {
  while (finishedHandles.length > 0) {
    continueRender(finishedHandles.pop() as number);
  }
};

/**
 * 在已加载的分块里按经纬度取地形高度（米），优先用最细的一级。
 * 没有任何已加载分块覆盖这一点时返回 0。
 */
export const sampleHeight = (lon: number, lat: number, maxZoom = 9): number => {
  for (let z = maxZoom; z >= 0; z--) {
    const n = 2 ** z;
    const fx = ((lon + 180) / 360) * n;
    const latRad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
    const fy = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    const tile = cache.get(tileKey(z, ((tx % n) + n) % n, Math.min(n - 1, Math.max(0, ty))));
    if (!tile) continue;
    const stride = tile.grid + 2;
    const gx = (fx - tx) * (tile.grid - 1) + 1;
    const gy = (fy - ty) * (tile.grid - 1) + 1;
    const ix = Math.min(stride - 2, Math.floor(gx));
    const iy = Math.min(stride - 2, Math.floor(gy));
    const wx = gx - ix;
    const wy = gy - iy;
    const h = tile.height;
    const at = (cx: number, cy: number) => h[cy * stride + cx];
    return (
      (at(ix, iy) * (1 - wx) + at(ix + 1, iy) * wx) * (1 - wy) +
      (at(ix, iy + 1) * (1 - wx) + at(ix + 1, iy + 1) * wx) * wy
    );
  }
  return 0;
};

/** 在已加载的分块里取水面高度（米）；不是水面返回 null。 */
export const sampleWater = (lon: number, lat: number, maxZoom = 9): number | null => {
  for (let z = maxZoom; z >= 0; z--) {
    const n = 2 ** z;
    const fx = ((lon + 180) / 360) * n;
    const latRad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
    const fy = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    const tile = cache.get(tileKey(z, ((tx % n) + n) % n, Math.min(n - 1, Math.max(0, ty))));
    if (!tile) continue;
    const ix = Math.round((fx - tx) * (tile.grid - 1));
    const iy = Math.round((fy - ty) * (tile.grid - 1));
    const value = tile.water[iy * tile.grid + ix];
    return value === NO_WATER ? null : value;
  }
  return null;
};
