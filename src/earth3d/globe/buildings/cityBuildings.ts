import * as THREE from "three";
import cities from "../../assets/cities.json";
import { EARTH_RADIUS_KM, enuFrame, lonLatToVector } from "../../core/geo";
import { sampleHeight, sampleWater } from "../terrain/tileStore";
import type { RiverData } from "../water/rivers";

export type City = {
  name: string;
  nameZh: string;
  country: string;
  lon: number;
  lat: number;
  pop: number;
  radiusKm: number;
  seed: number;
  outline: number[];
};

export const CITIES = cities as City[];

export type CityBuildings = {
  city: City;
  origin: THREE.Vector3;
  houses: { matrices: Float32Array; colors: Float32Array; count: number };
  blocks: { matrices: Float32Array; colors: Float32Array; count: number };
};

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** 城区轮廓在某个方向上的半径（公里），与 build_tiles.py 的城区标记一致。 */
const outlineRadius = (city: City, angle: number) => {
  const position = ((((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)) * 24;
  const index = Math.floor(position);
  const t = position - index;
  return city.outline[index % 24] * (1 - t) + city.outline[(index + 1) % 24] * t;
};

const WALL_COLORS = [
  [0.78, 0.75, 0.69], // 白灰墙
  [0.66, 0.62, 0.55], // 青砖
  [0.58, 0.45, 0.37], // 红砖
  [0.72, 0.66, 0.56], // 土黄
  [0.52, 0.50, 0.47], // 灰砖
].map((c) => c.map((v) => v ** 2.2));

/** 把河道烧进以城市为中心、10 米一格的栅格，用来避开河面。 */
const riverMask = (city: City, rivers: RiverData | null, extentKm: number) => {
  const cell = 0.01;
  const size = Math.ceil((extentKm * 2) / cell);
  const mask = new Uint8Array(size * size);
  if (!rivers) return { mask, size, cell };
  const kx = 111.32 * Math.cos((city.lat * Math.PI) / 180);
  const ky = 110.57;
  for (let r = 0; r < rivers.widths.length; r++) {
    const halfWidth = rivers.widths[r] / 2000 + 0.015;
    for (let k = rivers.offsets[r]; k < rivers.offsets[r + 1] - 1; k++) {
      const x0 = (rivers.lon[k] - city.lon) * kx;
      const y0 = (rivers.lat[k] - city.lat) * ky;
      const x1 = (rivers.lon[k + 1] - city.lon) * kx;
      const y1 = (rivers.lat[k + 1] - city.lat) * ky;
      if (Math.min(x0, x1) > extentKm || Math.max(x0, x1) < -extentKm) continue;
      if (Math.min(y0, y1) > extentKm || Math.max(y0, y1) < -extentKm) continue;
      const length = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(length / cell));
      const reach = Math.ceil(halfWidth / cell);
      for (let s = 0; s <= steps; s++) {
        const cx = Math.floor((x0 + ((x1 - x0) * s) / steps + extentKm) / cell);
        const cy = Math.floor((y0 + ((y1 - y0) * s) / steps + extentKm) / cell);
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            if (dx * dx + dy * dy > reach * reach) continue;
            const px = cx + dx;
            const py = cy + dy;
            if (px >= 0 && py >= 0 && px < size && py < size) mask[py * size + px] = 1;
          }
        }
      }
    }
  }
  return { mask, size, cell };
};

/** 建筑数据只留最近几座城市（大城市一座可达几十 MB）。 */
const CITY_CACHE_LIMIT = 4;
const cache = new Map<string, CityBuildings>();

/**
 * 生成一座城市的建筑。街网按城市种子确定：中国城市大体正南北，东西向胡同把长条街区
 * 分成两半，每半切成一个个院落（北正房、东西厢房、临街倒座房，中间是天井）；
 * 大城市中心是成排的联排房屋和零星的多层楼。城区边缘逐渐稀疏。
 * 需要城市附近的高精度分块已加载，房子才能落在正确的地面高度上。
 */
export const getCityBuildings = (city: City, rivers: RiverData | null): CityBuildings => {
  const cached = cache.get(city.name + city.seed);
  if (cached) {
    cache.delete(city.name + city.seed);
    cache.set(city.name + city.seed, cached);
    return cached;
  }
  const random = mulberry32(city.seed);
  const maxRadius = Math.max(...city.outline);
  const extent = maxRadius * 1.15;
  const { up, east, north } = enuFrame(city.lon, city.lat);
  const baseHeight = sampleHeight(city.lon, city.lat) / 1000;
  const origin = lonLatToVector(city.lon, city.lat, baseHeight);
  const chinese = city.country === "China" || city.country === "Taiwan";
  const rotation = chinese ? (random() - 0.5) * 0.12 : (random() - 0.5) * 1.2;
  const axisA = east.clone().multiplyScalar(Math.cos(rotation)).addScaledVector(north, Math.sin(rotation));
  const axisB = north.clone().multiplyScalar(Math.cos(rotation)).addScaledVector(east, -Math.sin(rotation));
  const metropolis = city.pop > 1_500_000;
  const kx = 111.32 * Math.cos((city.lat * Math.PI) / 180);
  const ky = 110.57;
  const water = riverMask(city, rivers, extent);

  const houses: number[] = [];
  const houseColors: number[] = [];
  const blocks: number[] = [];
  const blockColors: number[] = [];
  const matrix = new THREE.Matrix4();
  const basisX = new THREE.Vector3();
  const basisY = new THREE.Vector3();
  const basisZ = new THREE.Vector3();
  const position = new THREE.Vector3();

  /**
   * 放一栋房子。ax、ay 是街网坐标（公里），width 沿街网 x 方向，depth 沿 y 方向。
   * ridgeAlongY 为 true 时屋脊沿 y 方向（厢房）。
   */
  const place = (
    ax: number,
    ay: number,
    width: number,
    depth: number,
    height: number,
    flat: boolean,
    ridgeAlongY: boolean,
  ) => {
    const dx = ax * Math.cos(rotation) - ay * Math.sin(rotation);
    const dy = ax * Math.sin(rotation) + ay * Math.cos(rotation);
    const radius = Math.hypot(dx, dy);
    const lon = city.lon + dx / kx;
    const lat = city.lat + dy / ky;
    const mx = Math.floor((dx + extent) / water.cell);
    const my = Math.floor((dy + extent) / water.cell);
    if (mx >= 0 && my >= 0 && mx < water.size && my < water.size && water.mask[my * water.size + mx]) return;
    if (sampleWater(lon, lat) !== null) return;
    const ground = sampleHeight(lon, lat) / 1000;
    // 以城市中心的切平面为基准，扣掉地球曲率造成的下沉
    const drop = (radius * radius) / (2 * EARTH_RADIUS_KM);
    position
      .copy(east)
      .multiplyScalar(dx)
      .addScaledVector(north, dy)
      .addScaledVector(up, ground - baseHeight - drop - 0.002);
    if (ridgeAlongY) {
      basisX.copy(axisB).multiplyScalar(depth);
      basisY.copy(axisA).multiplyScalar(-width);
    } else {
      basisX.copy(axisA).multiplyScalar(width);
      basisY.copy(axisB).multiplyScalar(depth);
    }
    basisZ.copy(up).multiplyScalar(height + 0.002);
    matrix.makeBasis(basisX, basisY, basisZ).setPosition(position);
    const color = WALL_COLORS[Math.floor(random() * WALL_COLORS.length)];
    const shade = 0.9 + random() * 0.2;
    (flat ? blocks : houses).push(...matrix.elements);
    (flat ? blockColors : houseColors).push(color[0] * shade, color[1] * shade, color[2] * shade);
  };

  // 街网：东西向的胡同（巷）间距 55-85 米，南北向街道间距 250-450 米，每隔几条是宽一些的大街。
  // 非中国城市街区更方正。
  const boundaries = (minGap: number, maxGap: number) => {
    const list: number[] = [];
    let cursor = -extent - random() * maxGap;
    while (cursor < extent + maxGap) {
      list.push(cursor);
      cursor += minGap + random() * (maxGap - minGap);
    }
    return list;
  };
  const columns = chinese ? boundaries(0.25, 0.45) : boundaries(0.09, 0.16);
  const rows = chinese ? boundaries(0.055, 0.085) : boundaries(0.07, 0.12);
  const terraces = metropolis && !chinese ? 0.35 : metropolis ? 0.3 : 0;

  const oneStorey = () => 0.0048 + random() * 0.0012;
  for (let c = 0; c < columns.length - 1; c++) {
    const avenue = c % 4 === 0 ? 0.022 : 0.011;
    const x0 = columns[c] + avenue / 2;
    const x1 = columns[c + 1] - 0.0055;
    for (let r = 0; r < rows.length - 1; r++) {
      const y0 = rows[r] + 0.003;
      const y1 = rows[r + 1] - 0.003;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const ex = cx * Math.cos(rotation) - cy * Math.sin(rotation);
      const ey = cx * Math.sin(rotation) + cy * Math.cos(rotation);
      const rel = Math.hypot(ex, ey) / outlineRadius(city, Math.atan2(ey, ex));
      // 城区边缘逐渐稀疏；城内零星留出空地（寺庙、菜地、水塘）
      if (rel > 1.08 || random() > 1 - Math.max(0, (rel - 0.75) / 0.33) || random() < 0.04) continue;

      if (rel < terraces && random() < 0.7) {
        // 大城市中心：成排的两三层联排房屋（里弄、长屋）
        const floors = 2 + Math.floor(random() * 2);
        for (let y = y0 + 0.002; y + 0.011 < y1; y += 0.015) {
          place(cx, y + 0.0055, x1 - x0 - 0.004, 0.011, floors * 0.0033 + 0.0015, false, false);
        }
        if (random() < 0.04) place(cx, cy, (x1 - x0) * 0.4, (y1 - y0) * 0.8, 0.015 + random() * 0.02, true, false);
        continue;
      }

      // 四合院式地块：街区南北两半，各沿东西方向切成 16-30 米宽的院落
      const halves: Array<[number, number]> = [[y0, cy - 0.001], [cy + 0.001, y1]];
      for (const [ly0, ly1] of halves) {
        const depth = ly1 - ly0;
        let lx = x0;
        while (lx < x1 - 0.012) {
          const frontage = Math.min(x1 - lx, 0.016 + random() * 0.014);
          const lx1 = lx + frontage;
          const mid = (lx + lx1) / 2;
          const twoStorey = rel < 0.35 && random() < 0.25;
          const tall = twoStorey ? 0.0082 : oneStorey();
          // 正房：院落北侧，坐北朝南
          const mainDepth = 0.008 + random() * 0.003;
          place(mid, ly1 - mainDepth / 2 - 0.0008, frontage - 0.0015, mainDepth, tall, false, false);
          // 倒座房：临街一侧
          let southDepth = 0;
          if (random() < 0.7) {
            southDepth = 0.0055 + random() * 0.002;
            place(mid, ly0 + southDepth / 2 + 0.0008, frontage - 0.0015, southDepth, oneStorey() * 0.9, false, false);
          }
          // 东西厢房：屋脊南北向
          const wingLength = depth - mainDepth - southDepth - 0.006;
          if (wingLength > 0.005 && frontage > 0.014) {
            const wingY = ly0 + southDepth + 0.003 + wingLength / 2;
            const wingWidth = 0.0045 + random() * 0.001;
            if (random() < 0.85) place(lx + wingWidth / 2 + 0.0008, wingY, wingWidth, wingLength, oneStorey() * 0.9, false, true);
            if (random() < 0.85) place(lx1 - wingWidth / 2 - 0.0008, wingY, wingWidth, wingLength, oneStorey() * 0.9, false, true);
          }
          lx = lx1 + random() * 0.0015;
        }
      }
    }
  }

  const result: CityBuildings = {
    city,
    origin,
    houses: { matrices: new Float32Array(houses), colors: new Float32Array(houseColors), count: houses.length / 16 },
    blocks: { matrices: new Float32Array(blocks), colors: new Float32Array(blockColors), count: blocks.length / 16 },
  };
  cache.set(city.name + city.seed, result);
  while (cache.size > CITY_CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  return result;
};

/** 相机附近、需要显示建筑的城市。 */
export const citiesNear = (camera: THREE.Vector3, maxDistanceKm: number) =>
  CITIES.filter((city) => {
    const center = lonLatToVector(city.lon, city.lat, 0);
    return center.distanceTo(camera) - Math.max(...city.outline) < maxDistanceKm;
  });
