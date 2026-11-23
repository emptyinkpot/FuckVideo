import type { GeoCamera } from "../../core/camera";
import type { Place } from "../../layers/placeLabels";
import { sinoJapaneseWarDataset } from "../datasets/sino-japanese-war";
import type { HistoricalActor, HistoricalEventProcess } from "../schema";
import { assertValidHistoricalDataset } from "../validateHistoricalDataset";

/**
 * 1931–1945 中日战争成片的配置：史料数据之外、和画面表现有关的内容都在这里。
 * 成片组件只负责把这些配置交给地球和图层，不写任何具体的地名、颜色、归属。
 */

// 史料数据有缺字段、引用不存在的区域等问题时直接报错，不带着错数据渲染
assertValidHistoricalDataset(sinoJapaneseWarDataset);

export const dataset = sinoJapaneseWarDataset;

/** 按日期排序的事件（数据集里的顺序不完全按时间）。 */
export const events: HistoricalEventProcess[] = [...sinoJapaneseWarDataset.events].sort((a, b) =>
  a.date.padEnd(10, "-01").localeCompare(b.date.padEnd(10, "-01")),
);

/** 史料里的镜头提示（focus、zoom）换成三维镜头：距离 1500 × (2.3 / zoom)³ 公里，俯仰 38°。 */
export const eventCamera = (event: HistoricalEventProcess): GeoCamera => ({
  lon: event.camera.focus[0],
  lat: event.camera.focus[1],
  rangeKm: 1500 * (2.3 / event.camera.zoom) ** 3,
  pitchDeg: 38,
  headingDeg: 0,
});

/** 开场镜头：太空中俯瞰东亚。 */
export const openingCamera: GeoCamera = { lon: 118, lat: 33, rangeKm: 14000, pitchDeg: 0, headingDeg: 0 };

/** 箭头颜色按发起方。 */
const ACTOR_COLORS: Partial<Record<HistoricalActor, string>> = {
  japan: "#e8473a",
  manchukuo: "#e8473a",
  soviet: "#f0a830",
  china: "#4f8fe8",
};
export const arrowColor = (actor?: HistoricalActor) => (actor && ACTOR_COLORS[actor]) || "#e8473a";

export const cities: Place[] = [
  { name: "沈阳", lon: 123.43, lat: 41.8 },
  { name: "长春", lon: 125.32, lat: 43.9 },
  { name: "北京", lon: 116.41, lat: 39.9 },
  { name: "天津", lon: 117.2, lat: 39.13 },
  { name: "上海", lon: 121.47, lat: 31.23 },
  { name: "南京", lon: 118.8, lat: 32.06 },
  { name: "武汉", lon: 114.31, lat: 30.59 },
  { name: "长沙", lon: 112.94, lat: 28.23 },
  { name: "重庆", lon: 106.55, lat: 29.56 },
  { name: "广州", lon: 113.26, lat: 23.13 },
  { name: "东京", lon: 139.69, lat: 35.69 },
];

/** 史料事件里的区域标签（1938 年世界格局的英文名）对应的中文名和标注位置。 */
const REGION_LABELS: Record<string, Place> = {
  "Chinese warlords": { name: "中 国", lon: 106, lat: 33.5 },
  "Empire of Japan": { name: "日 本", lon: 138.3, lat: 37.2 },
  USSR: { name: "苏 联", lon: 108, lat: 56 },
  Xinjiang: { name: "新 疆", lon: 86, lat: 41.5 },
  "United States": { name: "美 国", lon: 150, lat: 22 },
  "United Kingdom": { name: "英属香港", lon: 114.2, lat: 22.3 },
};

/** 某个事件画面上要标的国家、地区名；满洲国存续期间（1932-03 至 1945-08）加上“满洲国”。 */
export const regionLabelsFor = (event: HistoricalEventProcess): Place[] => {
  const labels = (event.labels ?? []).flatMap((key) => (REGION_LABELS[key] ? [REGION_LABELS[key]] : []));
  if (event.date >= "1932-03-01" && event.date < "1945-08-16") {
    labels.push({ name: "满洲国", lon: 126.5, lat: 46 });
  }
  return labels;
};
