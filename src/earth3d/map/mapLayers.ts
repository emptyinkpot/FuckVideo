import type { EarthLayer } from "../layers/types";
import { citiesLayer } from "./cities";
import { occupationLayer } from "./occupation";
import { nationsLayer, type PoliticalDate } from "./political";
import { railwaysLayer } from "./railways";
import { regionLabelSize, regionLabelsOn, regionsLayer } from "./regions";

/**
 * 人文地理层的开关。所有地球动画共用这一组（Studio 面板里的 map），不填的都显示。
 * rivers 属于自然地理（globe/），放在这里是为了面板上一处管理。
 */
export type MapToggles = {
  rivers?: boolean;
  /** 国家层：按领有政权涂色、国界 */
  nations?: boolean;
  /** 占领层：占领斜纹、前线、争夺虚线 */
  occupation?: boolean;
  railways?: boolean;
  cities?: boolean;
  /** 国家、政权名 */
  regions?: boolean;
};

export const DEFAULT_MAP_TOGGLES: Required<MapToggles> = {
  rivers: true,
  nations: true,
  occupation: true,
  railways: true,
  cities: true,
  regions: true,
};

/** 人文地理层里各图层的 id（回归测试按它检查每个地球动画都画了全部图层）。 */
export const MAP_LAYER_IDS = ["nations", "occupation", "railways", "cities", "regions"] as const;

export type MapOptions = {
  toggles?: MapToggles;
  /** 事件额外标为“正在争夺”的区域（省名或区域 id）、过渡到下一个日期 */
  political?: Omit<PoliticalDate, "date">;
  /** 焦点铁路（线路 id） */
  railFocus?: string[];
  /** 城市名要避开的画面矩形（像素：x、y、宽、高），例如字幕卡片 */
  avoid?: Array<[number, number, number, number]>;
  /** 铁路、城市、国家名的不透明度（片头淡入用）；国家层和占领层不受影响 */
  opacity?: number;
};

/**
 * 某一天的完整人文地理层：国家、占领、铁路、城市、国家名。
 * view/EarthView 按日期自动叠上它，所有地球动画都会带全部图层；动画本身只加事件层。
 */
export const mapLayers = (date: string, options: MapOptions = {}): EarthLayer[] => {
  const show = { ...DEFAULT_MAP_TOGGLES, ...options.toggles };
  const opacity = options.opacity ?? 1;
  const when: PoliticalDate = { date, ...options.political };
  const layers: EarthLayer[] = [];
  if (show.nations) layers.push(nationsLayer(when));
  if (show.occupation) layers.push(occupationLayer(when));
  if (show.railways) layers.push(railwaysLayer({ date, focus: options.railFocus, opacity }));
  if (show.cities) {
    // 国家名显示时，城市名给它让位
    const reserve = show.regions
      ? (rangeKm: number) => regionLabelsOn(date, rangeKm).map((label) => ({ ...label, size: regionLabelSize(label) }))
      : undefined;
    layers.push(citiesLayer({ date, avoid: options.avoid, reserve, opacity }));
  }
  if (show.regions) layers.push(regionsLayer({ date, opacity }));
  return layers;
};
