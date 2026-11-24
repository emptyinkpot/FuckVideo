import * as THREE from "three";
import chinaProvincesUrl from "../data/china-provinces.geojson";
import world1938Url from "../data/historical-world-1938.geojson";
import type { HistoricalDataset, HistoricalResolvedRegion } from "../history/schema";
import { resolveHistoricalWorldState } from "../history/resolveHistoricalWorldState";
import { holdUntilDrawn } from "../globe/terrain/tileStore";
import type { EarthLayer } from "./types";

/**
 * 控制区着色叠加层：把某一天的占领区、傀儡政权、争夺区画到一张经纬度等距的透明图上，
 * 地表着色器按经纬度取色，染在真实地表上（地形明暗照旧）。
 * 中国控制区不着色；日本及其傀儡政权控制区为半透明红色；争夺区为黄色斜纹。
 */

/** 叠加层覆盖范围：西、南、东、北（度），涵盖中国、朝鲜、日本、中南半岛北部。 */
export const OVERLAY_BOUNDS = { west: 70, south: 5, east: 160, north: 60 };
const WIDTH = 3600;
const HEIGHT = Math.round((WIDTH * (OVERLAY_BOUNDS.north - OVERLAY_BOUNDS.south)) / (OVERLAY_BOUNDS.east - OVERLAY_BOUNDS.west));

const OCCUPIED_FILL = "rgba(196, 48, 38, 0.42)";
const OCCUPIED_EDGE = "rgba(150, 28, 22, 0.85)";
const CONTESTED_STRIPE = "rgba(250, 204, 21, 0.5)";
const CONTESTED_EDGE = "rgba(250, 204, 21, 0.85)";
/** 争夺区不画斜纹时的淡色填充（近景下斜纹会变成几十公里宽的条带） */
const CONTESTED_TINT = "rgba(245, 165, 40, 0.19)";

/** hatch：争夺区画斜纹；tint：画淡色填充。edges：是否描区块边线（每个像素约 2.7 公里，近景时偏粗）。 */
export type TerritoryLook = { contested: "hatch" | "tint"; edges: boolean };
const DEFAULT_LOOK: TerritoryLook = { contested: "hatch", edges: true };

type Polygon = number[][][];
type GeoFeature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
type Sources = { world: GeoFeature[]; provinces: GeoFeature[] };

let sources: Sources | null = null;
let sourcesPromise: Promise<Sources> | null = null;

const fetchJson = (url: string) => fetch(url).then((response) => response.json());

/** 加载 1938 世界格局和中国省级区块（src/earth3d/data 下），加载完成前截图会等待。 */
export const loadTerritorySources = () => {
  if (!sourcesPromise) {
    sourcesPromise = holdUntilDrawn(
      "loading territory geometry",
      Promise.all([fetchJson(world1938Url), fetchJson(chinaProvincesUrl)]).then(
        ([world, provinces]) => {
          sources = { world: world.features, provinces: provinces.features };
          return sources;
        },
      ),
    );
  }
  return sourcesPromise;
};

export const territorySourcesReady = () => sources !== null;

const polygonsOf = (geometry: GeoFeature["geometry"]): Polygon[] =>
  geometry.type === "Polygon" ? [geometry.coordinates as Polygon] : (geometry.coordinates as Polygon[]);

const toCanvas = (lon: number, lat: number): [number, number] => [
  ((lon - OVERLAY_BOUNDS.west) / (OVERLAY_BOUNDS.east - OVERLAY_BOUNDS.west)) * WIDTH,
  ((OVERLAY_BOUNDS.north - lat) / (OVERLAY_BOUNDS.north - OVERLAY_BOUNDS.south)) * HEIGHT,
];

const tracePolygons = (context: CanvasRenderingContext2D, polygons: Polygon[]) => {
  context.beginPath();
  for (const polygon of polygons) {
    for (const ring of polygon) {
      ring.forEach(([lon, lat], index) => {
        const [x, y] = toCanvas(lon, lat);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
    }
  }
};

const stripePattern = (context: CanvasRenderingContext2D) => {
  const tile = document.createElement("canvas");
  // 一格 14 像素（约 35 公里），细线约 5 公里宽
  const size = 14;
  tile.width = size;
  tile.height = size;
  const t = tile.getContext("2d") as CanvasRenderingContext2D;
  t.strokeStyle = CONTESTED_STRIPE;
  t.lineWidth = 2;
  for (const offset of [-size, 0, size]) {
    t.beginPath();
    t.moveTo(offset, size);
    t.lineTo(offset + size, 0);
    t.stroke();
  }
  return context.createPattern(tile, "repeat") as CanvasPattern;
};

const isAxis = (actor: string) => actor === "japan" || actor === "manchukuo";

/** 区域在 GeoJSON 里的几何。 */
const regionPolygons = (region: HistoricalResolvedRegion, data: Sources): Polygon[] => {
  const geometry = region.geometry;
  if (geometry.type === "custom-geojson") {
    const feature = data.provinces.find((item) => item.properties.name === geometry.featureId);
    return feature ? polygonsOf(feature.geometry) : [];
  }
  if (geometry.type === "geojson-feature-part") {
    const feature = data.world.find((item) => item.properties.NAME === geometry.featureName);
    return feature ? polygonsOf(feature.geometry).filter((_, index) => geometry.partIndexes.includes(index)) : [];
  }
  const feature = data.world.find((item) => item.properties.NAME === geometry.featureName);
  return feature ? polygonsOf(feature.geometry) : [];
};

/** 每张叠加图约 32MB（显存里同样大小），只保留最近用到的几张。 */
const CACHE_LIMIT = 4;
const cache = new Map<string, THREE.CanvasTexture>();

const remember = (key: string, texture: THREE.CanvasTexture) => {
  cache.set(key, texture);
  while (cache.size > CACHE_LIMIT) {
    const [oldestKey, oldest] = cache.entries().next().value as [string, THREE.CanvasTexture];
    cache.delete(oldestKey);
    oldest.dispose();
  }
};

/**
 * 某一天的控制区叠加层。底图：1938 年“日本帝国”本身（本土、朝鲜、台湾、库页岛南部等）；
 * 其上按史料库的控制期逐区覆盖：日本、满洲国控制的染红，争夺区画斜纹，中国控制的清空。
 * extraContested：事件额外标注的争夺省份（按省名）。
 */
export const territoryOverlay = (
  dataset: HistoricalDataset,
  date: string,
  extraContested: string[] = [],
  look: TerritoryLook = DEFAULT_LOOK,
) => {
  const key = `${date}|${extraContested.join(",")}|${look.contested}|${look.edges}`;
  const cached = cache.get(key);
  if (cached) {
    // 最近用过的放到最后，淘汰时最后才轮到它
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  if (!sources) return null;
  const data = sources;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  context.lineJoin = "round";

  const state = resolveHistoricalWorldState(dataset, date);
  const overriddenParts = new Map<string, Set<number>>();
  for (const region of state.regions) {
    if (region.geometry.type === "geojson-feature-part") {
      const set = overriddenParts.get(region.geometry.featureName) ?? new Set<number>();
      region.geometry.partIndexes.forEach((index) => set.add(index));
      overriddenParts.set(region.geometry.featureName, set);
    }
  }

  const paint = (polygons: Polygon[], fill: string | CanvasPattern, edge?: string) => {
    if (polygons.length === 0) return;
    tracePolygons(context, polygons);
    context.fillStyle = fill;
    context.fill("evenodd");
    if (edge && look.edges) {
      context.strokeStyle = edge;
      context.lineWidth = 1.5;
      context.stroke();
    }
  };
  const clear = (polygons: Polygon[]) => {
    context.save();
    context.globalCompositeOperation = "destination-out";
    paint(polygons, "#000");
    context.restore();
  };

  // 底图：1938 年日本帝国，除去由史料库单独管理的部分（如满洲）
  const empire = data.world.find((item) => item.properties.NAME === "Empire of Japan");
  if (empire) {
    const skip = overriddenParts.get("Empire of Japan") ?? new Set<number>();
    paint(polygonsOf(empire.geometry).filter((_, index) => !skip.has(index)), OCCUPIED_FILL, OCCUPIED_EDGE);
  }

  const pattern = look.contested === "hatch" ? stripePattern(context) : CONTESTED_TINT;
  for (const region of state.regions) {
    const polygons = regionPolygons(region, data);
    if (region.status === "contested" || region.controllerId === "contested") {
      clear(polygons);
      paint(polygons, pattern, CONTESTED_EDGE);
    } else if (isAxis(region.controllerId)) {
      clear(polygons);
      paint(polygons, OCCUPIED_FILL, OCCUPIED_EDGE);
    } else {
      clear(polygons);
    }
  }
  for (const name of extraContested) {
    const feature = data.provinces.find((item) => item.properties.name === name);
    if (feature) paint(polygonsOf(feature.geometry), pattern, CONTESTED_EDGE);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  remember(key, texture);
  return texture;
};

export type TerritoryLayerOptions = {
  dataset: HistoricalDataset;
  /** 显示这一天的控制状态 */
  date: string;
  /** 额外标为争夺区的省份（按省名） */
  contested?: string[];
  /** 过渡到另一天的状态：mix 从 0 到 1 */
  next?: { date: string; contested?: string[]; mix: number } | null;
  /** 争夺区画法、是否描边线，默认斜纹加边线 */
  look?: TerritoryLook;
  opacity?: number;
  order?: number;
};

/** 控制区着色图层：按史料库某一天的控制状态贴在地表上，可在两个日期之间渐变。 */
export const territoryLayer = ({
  dataset,
  date,
  contested = [],
  next = null,
  look = DEFAULT_LOOK,
  opacity = 1,
  order = 0,
}: TerritoryLayerOptions): EarthLayer => ({
  id: "territory",
  order,
  opacity,
  decal: () => {
    loadTerritorySources();
    const a = territoryOverlay(dataset, date, contested, look);
    if (!a) return null;
    const b = next && next.mix > 0 ? territoryOverlay(dataset, next.date, next.contested ?? [], look) : null;
    return {
      a,
      b,
      mix: next?.mix ?? 0,
      bounds: [OVERLAY_BOUNDS.west, OVERLAY_BOUNDS.south, OVERLAY_BOUNDS.east, OVERLAY_BOUNDS.north],
    };
  },
});
