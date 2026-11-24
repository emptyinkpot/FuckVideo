import type { GeoCamera } from "../../core/camera";
import { sinoJapaneseWarDataset } from "../datasets/sino-japanese-war";
import type { HistoricalEventProcess } from "../schema";
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

// 箭头颜色按阵营由风格决定（styles/ 的 events.actors）；国家、地区名由人文地理层按日期显示（map/regions.tsx）。
