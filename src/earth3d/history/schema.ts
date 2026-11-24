/**
 * 史料事件的数据结构。各区域归谁、谁在占领见 history/political/types.ts。
 */

export type LonLat = [number, number];

/** 事件的参与方；进攻箭头按它取颜色（styles/ 的 events.actors）。 */
export type HistoricalActor = "china" | "japan" | "manchukuo" | "soviet" | "usa" | "uk" | "france" | "germany";

export type HistoricalConfidence = "high" | "medium" | "low";

export type HistoricalFrontline = {
  id: string;
  label: string;
  points: LonLat[];
  actor?: HistoricalActor;
  confidence?: HistoricalConfidence;
  note?: string;
};

export type HistoricalArrow = {
  id: string;
  label: string;
  from: LonLat;
  to: LonLat;
  actor?: HistoricalActor;
  confidence?: HistoricalConfidence;
  note?: string;
};

export type HistoricalCameraHint = {
  focus: LonLat;
  zoom: number;
  label?: string;
};

export type HistoricalEventProcess = {
  id: string;
  date: string;
  title: string;
  summary: string;
  actors: HistoricalActor[];
  origin?: LonLat;
  target?: LonLat;
  route?: LonLat[];
  frontlines?: HistoricalFrontline[];
  arrows?: HistoricalArrow[];
  camera: HistoricalCameraHint;
  /** 事件发生时“正在争夺”的省份（省名），占领层在这些省画流动虚线 */
  hatchRegions?: string[];
  confidence: HistoricalConfidence;
  sources: string[];
  note?: string;
};

export type HistoricalDataset = {
  id: string;
  title: string;
  period: {
    start: string;
    end: string;
  };
  events: HistoricalEventProcess[];
};
