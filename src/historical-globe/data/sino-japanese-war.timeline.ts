import {
  datasetActorsToTerritoryColors,
  datasetSubjectAliasesToActorIds,
  datasetToWarTimeline,
} from "../history-db/adapters/toWarTimeline";
import { sinoJapaneseWarDataset } from "../history-db/datasets/sino-japanese-war";
export type {
  AttackArrow,
  Frontline,
  WarEvent,
  WorldFeaturePartOverride,
} from "./warTimelineTypes";
import type { WarEvent } from "./warTimelineTypes";

// 事实数据只维护在 history-db；这里保留旧 timeline 形状作为渲染层适配输出。
export const territoryColors = datasetActorsToTerritoryColors(sinoJapaneseWarDataset);
export const subjectAliases = datasetSubjectAliasesToActorIds(sinoJapaneseWarDataset);

export const sinoJapaneseWarTimeline: WarEvent[] = datasetToWarTimeline(
  sinoJapaneseWarDataset,
);
