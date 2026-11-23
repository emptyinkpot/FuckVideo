import * as THREE from "three";
import { EARTH_RADIUS_KM, mercatorYToLat, tileBounds } from "../../core/geo";
import { createTerrainMaterial, type TerrainRelief } from "../materials/terrainMaterial";
import { NO_WATER, type TileData } from "./tileStore";

export type Chunk = {
  key: string;
  /** 分块中心（海平面）的场景坐标；网格顶点都相对它存放，避免 float32 精度问题。 */
  center: THREE.Vector3;
  terrain: THREE.BufferGeometry;
  terrainMaterial: THREE.ShaderMaterial;
  water: THREE.BufferGeometry | null;
  /** 坡度图、地平线图；贴地图层的材质也要用，光照和地表一致 */
  relief: TerrainRelief;
  /** 贴地图层在这个分块上的材质（按图层 id），随分块一起释放 */
  decals: Map<string, THREE.ShaderMaterial>;
  /** 显存占用估计（字节）：顶点、索引、各张纹理 */
  bytes: number;
  /** 最近一次被使用的帧序号 */
  stamp: number;
};

const DEG = Math.PI / 180;

/** 把一个分块的 (HEIGHT_GRID)^2 个采样点换成场景坐标（double，相对分块中心）。 */
const gridPositions = (tile: TileData, exaggeration: number, center: THREE.Vector3) => {
  const GRID = tile.grid;
  const HEIGHT_GRID = GRID + 2;
  const n = 2 ** tile.z;
  const { west, east } = tileBounds(tile.z, tile.x, tile.y);
  const out = new Float64Array(HEIGHT_GRID * HEIGHT_GRID * 3);
  const up = new Float64Array(HEIGHT_GRID * HEIGHT_GRID * 3);
  for (let j = 0; j < HEIGHT_GRID; j++) {
    const lat = mercatorYToLat((tile.y + (j - 1) / (GRID - 1)) / n) * DEG;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    for (let i = 0; i < HEIGHT_GRID; i++) {
      const lon = (west + ((i - 1) / (GRID - 1)) * (east - west)) * DEG;
      const index = j * HEIGHT_GRID + i;
      const ux = cosLat * Math.cos(lon);
      const uy = sinLat;
      const uz = -cosLat * Math.sin(lon);
      const r = EARTH_RADIUS_KM + (tile.height[index] / 1000) * exaggeration;
      out[index * 3] = ux * r - center.x;
      out[index * 3 + 1] = uy * r - center.y;
      out[index * 3 + 2] = uz * r - center.z;
      up[index * 3] = ux;
      up[index * 3 + 1] = uy;
      up[index * 3 + 2] = uz;
    }
  }
  return { positions: out, up };
};

const surfaceTexture = (tile: TileData) => {
  const texture = new THREE.DataTexture(
    tile.surface,
    tile.surfaceRes,
    tile.surfaceRes,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
};

/** 坡度图（逐像素细法线，带 mipmap）和 8 个方向地平线图（拆成两张 RGBA）。 */
const reliefTextures = (tile: TileData): TerrainRelief => {
  const slope = new THREE.DataTexture(tile.slope, tile.normalRes, tile.normalRes, THREE.RGFormat, THREE.UnsignedByteType);
  slope.minFilter = THREE.LinearMipmapLinearFilter;
  slope.magFilter = THREE.LinearFilter;
  slope.generateMipmaps = true;
  slope.flipY = false;
  slope.needsUpdate = true;
  const count = tile.horizonRes * tile.horizonRes;
  const first = new Uint8Array(count * 4);
  const second = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 4; c++) {
      first[i * 4 + c] = tile.horizon[i * 8 + c];
      second[i * 4 + c] = tile.horizon[i * 8 + 4 + c];
    }
  }
  const horizon = [first, second].map((data) => {
    const texture = new THREE.DataTexture(data, tile.horizonRes, tile.horizonRes, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.needsUpdate = true;
    return texture;
  });
  return { slope, horizonA: horizon[0], horizonB: horizon[1] };
};

export const buildChunk = (tile: TileData, exaggeration = 1): Chunk => {
  const GRID = tile.grid;
  const HEIGHT_GRID = GRID + 2;
  const { west, east, north, south } = tileBounds(tile.z, tile.x, tile.y);
  const midLat = ((north + south) / 2) * DEG;
  const midLon = ((west + east) / 2) * DEG;
  const center = new THREE.Vector3(
    Math.cos(midLat) * Math.cos(midLon) * EARTH_RADIUS_KM,
    Math.sin(midLat) * EARTH_RADIUS_KM,
    -Math.cos(midLat) * Math.sin(midLon) * EARTH_RADIUS_KM,
  );
  const { positions: grid, up } = gridPositions(tile, exaggeration, center);
  const inner = (i: number, j: number) => (j + 1) * HEIGHT_GRID + (i + 1);

  // 地表网格 + 四条边上的裙边（向下垂的一圈），遮住相邻不同精度分块之间的缝
  const vertexCount = GRID * GRID + 4 * GRID;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const heights = new Float32Array(vertexCount);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const read = (index: number, target: THREE.Vector3) =>
    target.set(grid[index * 3], grid[index * 3 + 1], grid[index * 3 + 2]);
  const point = new THREE.Vector3();
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const v = j * GRID + i;
      const g = inner(i, j);
      positions[v * 3] = grid[g * 3];
      positions[v * 3 + 1] = grid[g * 3 + 1];
      positions[v * 3 + 2] = grid[g * 3 + 2];
      // 法线用两侧采样点的差分；边缘处用到分块外那一圈，和相邻分块算出来一致
      read(g + 1, a).sub(read(g - 1, point));
      read(g + HEIGHT_GRID, b).sub(read(g - HEIGHT_GRID, point));
      normal.crossVectors(b, a).normalize();
      if (normal.x * up[g * 3] + normal.y * up[g * 3 + 1] + normal.z * up[g * 3 + 2] < 0) normal.negate();
      normals[v * 3] = normal.x;
      normals[v * 3 + 1] = normal.y;
      normals[v * 3 + 2] = normal.z;
      uvs[v * 2] = i / (GRID - 1);
      uvs[v * 2 + 1] = j / (GRID - 1);
      heights[v] = tile.height[g];
    }
  }

  const tileWidthKm = ((east - west) / 360) * 2 * Math.PI * EARTH_RADIUS_KM * Math.cos(midLat);
  const skirtKm = Math.max(0.05, (tileWidthKm / (GRID - 1)) * 1.5);
  const edges: number[][] = [[], [], [], []];
  for (let k = 0; k < GRID; k++) {
    edges[0].push(k); // 北边
    edges[1].push((GRID - 1) * GRID + k); // 南边
    edges[2].push(k * GRID); // 西边
    edges[3].push(k * GRID + GRID - 1); // 东边
  }
  let skirtVertex = GRID * GRID;
  const skirtStart: number[] = [];
  for (const edge of edges) {
    skirtStart.push(skirtVertex);
    for (const v of edge) {
      const j = Math.floor(v / GRID);
      const i = v % GRID;
      const g = inner(i, j);
      positions[skirtVertex * 3] = positions[v * 3] - up[g * 3] * skirtKm;
      positions[skirtVertex * 3 + 1] = positions[v * 3 + 1] - up[g * 3 + 1] * skirtKm;
      positions[skirtVertex * 3 + 2] = positions[v * 3 + 2] - up[g * 3 + 2] * skirtKm;
      normals.copyWithin(skirtVertex * 3, v * 3, v * 3 + 3);
      uvs.copyWithin(skirtVertex * 2, v * 2, v * 2 + 2);
      heights[skirtVertex] = heights[v];
      skirtVertex++;
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < GRID - 1; j++) {
    for (let i = 0; i < GRID - 1; i++) {
      const v = j * GRID + i;
      indices.push(v, v + GRID, v + 1, v + 1, v + GRID, v + GRID + 1);
    }
  }
  edges.forEach((edge, e) => {
    for (let k = 0; k < GRID - 1; k++) {
      const top0 = edge[k];
      const top1 = edge[k + 1];
      const bottom0 = skirtStart[e] + k;
      const bottom1 = skirtStart[e] + k + 1;
      indices.push(top0, bottom0, top1, top1, bottom0, bottom1);
    }
  });

  const terrain = new THREE.BufferGeometry();
  terrain.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  terrain.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  terrain.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  terrain.setAttribute("aHeight", new THREE.BufferAttribute(heights, 1));
  terrain.setIndex(indices);
  terrain.computeBoundingSphere();

  const water = tile.hasWater ? buildWater(tile, exaggeration, center) : null;
  const relief = reliefTextures(tile);
  // 内存里的原始数据要一直留着：Studio 切换动画、热更新时会新建 WebGL 画布，
  // 缓存里的网格和纹理要重新上传到新画布。所以占用按“内存一份 + 显存一份”估算：
  // 网格两份；纹理直接引用分块的原始数据（整块解压数据随之保留），再加显存里的一份。
  const textureBytes =
    tile.surfaceRes * tile.surfaceRes +
    Math.round(tile.normalRes * tile.normalRes * 2 * 1.34) +
    tile.horizonRes * tile.horizonRes * 8 * 2;
  const bytes = (geometryBytes(terrain) + geometryBytes(water)) * 2 + tile.bytes + textureBytes;
  return {
    key: `${tile.z}/${tile.x}/${tile.y}`,
    center,
    terrain,
    terrainMaterial: createTerrainMaterial(surfaceTexture(tile), tileWidthKm / tile.surfaceRes, relief, exaggeration),
    relief,
    decals: new Map(),
    water,
    bytes,
    stamp: 0,
  };
};

/** 水面网格：四个角都有水面高度的格子才生成；岸线由水面和地形相交自然形成。 */
const buildWater = (tile: TileData, exaggeration: number, center: THREE.Vector3) => {
  const GRID = tile.grid;
  const HEIGHT_GRID = GRID + 2;
  const n = 2 ** tile.z;
  const { west, east } = tileBounds(tile.z, tile.x, tile.y);
  const positions = new Float32Array(GRID * GRID * 3);
  const depth = new Float32Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) {
    const lat = mercatorYToLat((tile.y + j / (GRID - 1)) / n) * DEG;
    for (let i = 0; i < GRID; i++) {
      const v = j * GRID + i;
      const level = tile.water[v];
      if (level === NO_WATER) continue;
      const lon = (west + (i / (GRID - 1)) * (east - west)) * DEG;
      const r = EARTH_RADIUS_KM + (level / 1000) * exaggeration;
      positions[v * 3] = Math.cos(lat) * Math.cos(lon) * r - center.x;
      positions[v * 3 + 1] = Math.sin(lat) * r - center.y;
      positions[v * 3 + 2] = -Math.cos(lat) * Math.sin(lon) * r - center.z;
      depth[v] = level - tile.height[(j + 1) * HEIGHT_GRID + (i + 1)];
    }
  }
  const indices: number[] = [];
  const wet = (v: number) => tile.water[v] !== NO_WATER;
  for (let j = 0; j < GRID - 1; j++) {
    for (let i = 0; i < GRID - 1; i++) {
      const v = j * GRID + i;
      if (wet(v) && wet(v + 1) && wet(v + GRID) && wet(v + GRID + 1)) {
        indices.push(v, v + GRID, v + 1, v + 1, v + GRID, v + GRID + 1);
      }
    }
  }
  if (indices.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aDepth", new THREE.BufferAttribute(depth, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
};

/**
 * 地形分块（网格、纹理，内存和显存合计）的上限，按总字节数限制，当前帧用到的分块不淘汰。
 * 原来按个数（1600 个）限制，最坏情况会到 6GB。一帧通常用 150-250 个分块，1GB 足够连续镜头复用。
 */
const CHUNK_BUDGET_BYTES = 1024 * 1024 * 1024;
const chunkCache = new Map<string, Chunk>();
let chunkBytes = 0;
let frameStamp = 0;

/** 每次渲染选块之前调用：这之后取用的分块都算“当前帧在用”。 */
export const beginChunkFrame = () => {
  frameStamp++;
};

export const chunkCacheStats = () => ({ chunks: chunkCache.size, bytes: chunkBytes, budget: CHUNK_BUDGET_BYTES });

const geometryBytes = (geometry: THREE.BufferGeometry | null) => {
  if (!geometry) return 0;
  let bytes = geometry.index ? geometry.index.array.byteLength : 0;
  for (const attribute of Object.values(geometry.attributes)) bytes += (attribute as THREE.BufferAttribute).array.byteLength;
  return bytes;
};

const disposeChunk = (chunk: Chunk) => {
  chunk.terrain.dispose();
  chunk.water?.dispose();
  (chunk.terrainMaterial.uniforms.uSurface.value as THREE.Texture).dispose();
  chunk.terrainMaterial.dispose();
  chunk.relief.slope.dispose();
  chunk.relief.horizonA.dispose();
  chunk.relief.horizonB.dispose();
  chunk.decals.forEach((material) => material.dispose());
};

export const getChunk = (tile: TileData, exaggeration = 1): Chunk => {
  const key = `${tile.z}/${tile.x}/${tile.y}@${exaggeration}`;
  const cached = chunkCache.get(key);
  if (cached) {
    chunkCache.delete(key);
    chunkCache.set(key, cached);
    cached.stamp = frameStamp;
    return cached;
  }
  const chunk = buildChunk(tile, exaggeration);
  chunk.stamp = frameStamp;
  chunkCache.set(key, chunk);
  chunkBytes += chunk.bytes;
  for (const [oldKey, old] of chunkCache) {
    if (chunkBytes <= CHUNK_BUDGET_BYTES) break;
    if (old.stamp === frameStamp) continue;
    chunkCache.delete(oldKey);
    chunkBytes -= old.bytes;
    disposeChunk(old);
  }
  return chunk;
};
