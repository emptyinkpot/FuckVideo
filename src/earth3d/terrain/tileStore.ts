import { continueRender, delayRender } from "remotion";

/** 与 scripts/config.py 保持一致：最细一级 257 个角点，其余各级 129。 */
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
  minHeight: number;
  maxHeight: number;
  hasWater: boolean;
};

const tileContext = require.context("../assets/tiles", true, /\.e3d$/);
const tileUrls = new Map<string, string>(
  tileContext.keys().map((key) => [key.replace(/^\.\//, "").replace(/\.e3d$/, ""), tileContext(key)]),
);

export const tileKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;
export const hasTile = (z: number, x: number, y: number) => tileUrls.has(tileKey(z, x, y));

const cache = new Map<string, TileData>();
const pending = new Map<string, Promise<TileData>>();

export const gunzip = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`earth3d: failed to fetch ${url} (${response.status})`);
  }
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
};

const parseTile = (z: number, x: number, y: number, buffer: ArrayBuffer): TileData => {
  const [grid, surfaceRes] = new Uint16Array(buffer, 0, 2);
  const heightCount = (grid + 2) * (grid + 2);
  const waterCount = grid * grid;
  const height = new Int16Array(buffer, 4, heightCount);
  const water = new Int16Array(buffer, 4 + heightCount * 2, waterCount);
  const surface = new Uint8Array(buffer, 4 + (heightCount + waterCount) * 2, surfaceRes * surfaceRes);
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
  return { z, x, y, grid, height, water, surfaceRes, surface, minHeight, maxHeight, hasWater };
};

export const getTile = (key: string) => cache.get(key);

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
    pending.delete(key);
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
const finishedHandles: number[] = [];

/**
 * 确保这些分块已加载。全部在缓存里时返回 true；否则发起加载，并用 delayRender
 * 挡住当前帧的截图。加载完成后通知订阅者重新渲染；订阅者把新分块画到画布上之后
 * 调用 releaseLoadedTiles()，截图才会放行。
 */
export const ensureTiles = (keys: string[]): boolean => {
  const missing = keys.filter((key) => !cache.has(key));
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
    const batch = Promise.all(missing.map(loadTile)).then(finish, (error) => {
      console.error(error);
      finish();
    });
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
