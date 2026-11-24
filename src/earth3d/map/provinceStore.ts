import * as THREE from "three";
import bordersUrl from "../assets/provinces-borders.bin";
import detailUrl from "../assets/provinces-detail.bin";
import globalUrl from "../assets/provinces-global.bin";
import provinceMeta from "../assets/provinces.json";
import { gunzip, holdUntilDrawn } from "../globe/terrain/tileStore";
import { CONTROLS, OWNERS } from "../history/political/periods";
import { POLITIES } from "../history/political/polities";
import { REGIONS } from "../history/political/regions";
import { validatePoliticalData } from "../history/political/resolve";
import type { PoliticalRegion } from "../history/political/types";
import type { PolylineSet } from "../layers/geoLines";

/**
 * 全球地块系统（数据由 pipeline/build_provinces.py 生成）：
 * - 两张地块编号图（全球约 10 公里一像素，东亚约 2.2 公里一像素），着色器按经纬度取地块编号；
 * - 地块边界线（每条记两侧的地块），国界、前线从里面挑两侧不同的画；
 * - 地块信息：代表点、面积、现代中国省份、1930 / 1938 / 1945 年所属国家和宗主国。
 * 某一天每个地块归谁、谁在占，由 provinceStateOn() 算出（史料见 history/political/）。
 */

type Meta = {
  names: string[];
  provinces: Array<{
    name: string;
    src: "cn" | "ne";
    country: string;
    cn?: string;
    lon: number;
    lat: number;
    areaKm2: number;
    hist: Record<"1930" | "1938" | "1945", [number, number]>;
  }>;
};
const META = provinceMeta as unknown as Meta;
export const PROVINCES = META.provinces;
/** 地块编号从 1 开始，0 为海洋、范围外。 */
export const PROVINCE_COUNT = PROVINCES.length;

// 史料有误时（引用不存在的区域、政权，时间段重叠……）直接报错，不带着错数据渲染
validatePoliticalData();

// ---------- 政权编号 ----------

/** 历史底图里的国家（宗主国）名 -> 手工整理的政权 id。其余国家按底图名自动编号（id 为 "w:" + 名字）。 */
const WORLD_TO_POLITY: Record<string, string> = {
  "Empire of Japan": "japan",
  Japan: "japan",
  USSR: "ussr",
  Mongolia: "mongolia",
  France: "france",
  "United Kingdom": "uk",
  "United States": "usa",
  Netherlands: "netherlands",
  Portugal: "portugal",
  Siam: "siam",
  Thailand: "siam",
  Tibet: "tibet",
};

/** 所有政权：手工整理的在前（编号 1 起），世界其他国家按底图名排在后面。 */
export const POLITY_IDS: string[] = (() => {
  const ids: string[] = POLITIES.map((polity) => polity.id);
  const seen = new Set(ids);
  for (const province of PROVINCES) {
    for (const year of ["1930", "1938", "1945"] as const) {
      const subject = META.names[province.hist[year][1]];
      const id = subject ? (WORLD_TO_POLITY[subject] ?? `w:${subject}`) : "";
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
})();
export const polityIndex = new Map(POLITY_IDS.map((id, index) => [id, index + 1]));

// ---------- 区域 -> 地块 ----------

const insidePolygon = (lon: number, lat: number, polygon: Array<[number, number]>) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** 区域包含哪些地块：中国省份（含台港澳）按现代省名；底图国家按 1938 年底图的国名；手画范围按代表点是否在里面。 */
const membersOf = (region: PoliticalRegion): number[] => {
  const members: number[] = [];
  PROVINCES.forEach((province, index) => {
    const geometry = region.geometry;
    const hit =
      geometry.source === "province"
        ? province.cn === geometry.name
        : geometry.source === "world"
          ? META.names[province.hist["1938"][0]] === geometry.name && !province.cn
          : insidePolygon(province.lon, province.lat, geometry.polygon);
    if (hit) members.push(index + 1);
  });
  return members;
};
const REGION_MEMBERS = new Map(REGIONS.map((region) => [region.id, membersOf(region)]));

// ---------- 某一天的状态 ----------

const within = (date: string, from?: string, to?: string) => (!from || date >= from) && (!to || date < to);
const yearBucket = (date: string) => (date < "1934-01-01" ? "1930" : date < "1943-01-01" ? "1938" : "1945");

export type ProvinceState = {
  /** 每个地块（下标 = 地块编号）的领有政权编号、控制政权编号（0 为无）、状态（0 无、1 占领、2 争夺） */
  owner: Uint16Array;
  controller: Uint16Array;
  status: Uint8Array;
};

const stateCache = new Map<string, ProvinceState>();

/**
 * 某一天每个地块的状态。世界各国按历史底图（当年所属国家的宗主国，殖民地取宗主国）；
 * history/political/ 里整理的区域按领有、控制时间段覆盖上去。
 * extraContested：事件额外标为“正在争夺”的区域（省名或区域 id），进攻方按 attacker。
 */
export const provinceStateOn = (date: string, extraContested: string[] = [], attacker = "japan"): ProvinceState => {
  const key = `${date}|${extraContested.join(",")}|${attacker}`;
  const cached = stateCache.get(key);
  if (cached) return cached;
  const owner = new Uint16Array(PROVINCE_COUNT + 1);
  const controller = new Uint16Array(PROVINCE_COUNT + 1);
  const status = new Uint8Array(PROVINCE_COUNT + 1);
  const year = yearBucket(date);
  PROVINCES.forEach((province, index) => {
    if (province.cn) return; // 中国境内（含台港澳）全部由整理的史料决定
    const subject = META.names[province.hist[year][1]];
    if (subject) owner[index + 1] = polityIndex.get(WORLD_TO_POLITY[subject] ?? `w:${subject}`) ?? 0;
  });
  for (const region of REGIONS) {
    const members = REGION_MEMBERS.get(region.id) ?? [];
    const own = OWNERS.find((period) => period.region === region.id && within(date, period.from, period.to));
    if (own) for (const id of members) owner[id] = polityIndex.get(own.owner) ?? 0;
    const control = CONTROLS.find((period) => period.region === region.id && within(date, period.from, period.to));
    const extra =
      extraContested.includes(region.id) ||
      (region.geometry.source === "province" && extraContested.includes(region.geometry.name));
    for (const id of members) {
      if (control) {
        controller[id] = polityIndex.get(control.controller) ?? 0;
        status[id] = control.status === "contested" ? 2 : 1;
      } else if (own) {
        controller[id] = 0;
        status[id] = 0;
      }
      if (!control && extra && owner[id] !== polityIndex.get(attacker)) {
        controller[id] = polityIndex.get(attacker) ?? 0;
        status[id] = 2;
      }
    }
  }
  const state = { owner, controller, status };
  stateCache.set(key, state);
  while (stateCache.size > 16) stateCache.delete(stateCache.keys().next().value as string);
  return state;
};

/** 某一天领有至少一个地块的政权，以及各自地块的面积加权中心（国家名标注用）。 */
export const politiesOnDate = (date: string) => {
  const state = provinceStateOn(date);
  const sums = new Map<number, { area: number; x: number; y: number; z: number }>();
  for (let id = 1; id <= PROVINCE_COUNT; id++) {
    const polity = state.owner[id];
    if (!polity) continue;
    const province = PROVINCES[id - 1];
    const lon = (province.lon * Math.PI) / 180;
    const lat = (province.lat * Math.PI) / 180;
    const sum = sums.get(polity) ?? { area: 0, x: 0, y: 0, z: 0 };
    const a = province.areaKm2;
    sum.area += a;
    sum.x += a * Math.cos(lat) * Math.cos(lon);
    sum.y += a * Math.cos(lat) * Math.sin(lon);
    sum.z += a * Math.sin(lat);
    sums.set(polity, sum);
  }
  return new Map(
    [...sums].map(([polity, s]) => [
      POLITY_IDS[polity - 1],
      {
        areaKm2: s.area,
        lon: (Math.atan2(s.y, s.x) * 180) / Math.PI,
        lat: (Math.atan2(s.z, Math.hypot(s.x, s.y)) * 180) / Math.PI,
      },
    ]),
  );
};

/**
 * 历史底图里各国、殖民地的地块面积加权中心，按当年的国名分组（国家名标注用；中国境内不算）。
 * 殖民地按自己的名字（英属印度、法属印度支那……）单独一组，不和宗主国本土合在一起。
 */
export const worldUnitsOn = (date: string) => {
  const state = provinceStateOn(date);
  const year = yearBucket(date);
  const sums = new Map<string, { area: number; x: number; y: number; z: number }>();
  PROVINCES.forEach((province, index) => {
    if (!state.owner[index + 1] || province.cn) return;
    const name = META.names[province.hist[year][0]];
    if (!name) return;
    const lon = (province.lon * Math.PI) / 180;
    const lat = (province.lat * Math.PI) / 180;
    const sum = sums.get(name) ?? { area: 0, x: 0, y: 0, z: 0 };
    const a = province.areaKm2;
    sum.area += a;
    sum.x += a * Math.cos(lat) * Math.cos(lon);
    sum.y += a * Math.cos(lat) * Math.sin(lon);
    sum.z += a * Math.sin(lat);
    sums.set(name, sum);
  });
  return [...sums].map(([name, s]) => ({
    name,
    areaKm2: s.area,
    lon: (Math.atan2(s.y, s.x) * 180) / Math.PI,
    lat: (Math.atan2(s.z, Math.hypot(s.x, s.y)) * 180) / Math.PI,
  }));
};

// ---------- 纹理和边界线 ----------

export type ProvinceRaster = { texture: THREE.DataTexture; bounds: [number, number, number, number]; size: [number, number] };
export type ProvinceData = { global: ProvinceRaster; detail: ProvinceRaster; borders: PolylineSet; pairs: Uint32Array };

let data: ProvinceData | null = null;
let promise: Promise<ProvinceData> | null = null;

const parseRaster = (buffer: ArrayBuffer): ProvinceRaster => {
  const [width, height] = new Uint32Array(buffer, 0, 2);
  const [west, south, east, north] = new Float32Array(buffer, 8, 4);
  const ids = new Uint16Array(buffer.slice(24));
  // uint16 拆成两个字节（R 低位、G 高位），着色器里拼回编号；画布第 0 行是北边，纹理第 0 行是南边
  const bytes = new Uint8Array(width * height * 2);
  for (let y = 0; y < height; y++) {
    const source = y * width;
    const target = (height - 1 - y) * width;
    for (let x = 0; x < width; x++) {
      const id = ids[source + x];
      bytes[(target + x) * 2] = id & 255;
      bytes[(target + x) * 2 + 1] = id >> 8;
    }
  }
  const texture = new THREE.DataTexture(bytes, width, height, THREE.RGFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return { texture, bounds: [west, south, east, north], size: [width, height] };
};

/** 加载地块编号图和边界线，加载完成前截图会等待。 */
export const loadProvinces = () => {
  if (!promise) {
    promise = holdUntilDrawn(
      "loading provinces",
      Promise.all([gunzip(globalUrl), gunzip(detailUrl), gunzip(bordersUrl)]).then(([g, d, b]) => {
        const [count, vertexCount] = new Uint32Array(b, 0, 2);
        let offset = 8;
        const offsets = new Uint32Array(b, offset, count + 1);
        offset += (count + 1) * 4;
        const pairs = new Uint32Array(b, offset, count);
        offset += count * 4;
        const lon = new Float32Array(b, offset, vertexCount);
        offset += vertexCount * 4;
        const lat = new Float32Array(b, offset, vertexCount);
        offset += vertexCount * 4;
        const height = new Float32Array(b, offset, vertexCount);
        data = { global: parseRaster(g), detail: parseRaster(d), borders: { offsets, lon, lat, height }, pairs };
        return data;
      }),
    );
  }
  return promise;
};

export const provinceData = () => data;

/** 某一天的对照表纹理：第 i 个像素（按 128 宽排列）是地块 i 的领有者（R、G）、控制者和状态（B、A）。 */
const LOOKUP_WIDTH = 128;
export const LOOKUP_SIZE: [number, number] = [LOOKUP_WIDTH, Math.ceil((PROVINCE_COUNT + 1) / LOOKUP_WIDTH)];
const lookupCache = new Map<ProvinceState, THREE.DataTexture>();

export const lookupTexture = (state: ProvinceState) => {
  let texture = lookupCache.get(state);
  if (!texture) {
    const bytes = new Uint8Array(LOOKUP_SIZE[0] * LOOKUP_SIZE[1] * 4);
    for (let id = 0; id <= PROVINCE_COUNT; id++) {
      bytes[id * 4] = state.owner[id] & 255;
      bytes[id * 4 + 1] = state.owner[id] >> 8;
      // 控制者编号低 8 位在 B；A 的低 4 位是控制者高位，第 7、8 位是状态
      bytes[id * 4 + 2] = state.controller[id] & 255;
      bytes[id * 4 + 3] = (state.controller[id] >> 8) | (state.status[id] << 6);
    }
    texture = new THREE.DataTexture(bytes, LOOKUP_SIZE[0], LOOKUP_SIZE[1], THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    lookupCache.set(state, texture);
    while (lookupCache.size > 16) {
      const [oldKey, old] = lookupCache.entries().next().value as [ProvinceState, THREE.DataTexture];
      lookupCache.delete(oldKey);
      old.dispose();
    }
  }
  return texture;
};
