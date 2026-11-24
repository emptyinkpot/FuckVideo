import { REGIONS } from "./political/regions";
import type { HistoricalActor, HistoricalDataset } from "./schema";

export type HistoricalDatasetIssue = {
  level: "error" | "warning";
  message: string;
};

const ACTORS: HistoricalActor[] = ["china", "japan", "manchukuo", "soviet", "usa", "uk", "france", "germany"];

/** 事件数据自检：日期格式、参与方、坐标、争夺省份是否存在于政治地理的区域里。 */
export const validateHistoricalDataset = (dataset: HistoricalDataset): HistoricalDatasetIssue[] => {
  const issues: HistoricalDatasetIssue[] = [];
  const provinces = new Set(
    REGIONS.flatMap((region) => (region.geometry.source === "province" ? [region.geometry.name] : [])),
  );
  const isValidDate = (date: string) => /^\d{4}(-\d{2}(-\d{2})?)?$/.test(date);
  const isLonLat = ([lon, lat]: [number, number]) => lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;

  if (dataset.events.length === 0) issues.push({ level: "error", message: `Dataset ${dataset.id} has no events.` });
  const ids = new Set<string>();
  for (const event of dataset.events) {
    if (ids.has(event.id)) issues.push({ level: "error", message: `Duplicate event id ${event.id}.` });
    ids.add(event.id);
    if (!isValidDate(event.date)) issues.push({ level: "error", message: `Event ${event.id} has invalid date ${event.date}.` });
    for (const actor of event.actors) {
      if (!ACTORS.includes(actor)) issues.push({ level: "error", message: `Event ${event.id} has unknown actor ${actor}.` });
    }
    for (const arrow of event.arrows ?? []) {
      if (!isLonLat(arrow.from) || !isLonLat(arrow.to)) {
        issues.push({ level: "error", message: `Event ${event.id} arrow ${arrow.id} has invalid coordinates.` });
      }
    }
    for (const line of event.frontlines ?? []) {
      if (line.points.length < 2 || !line.points.every(isLonLat)) {
        issues.push({ level: "error", message: `Event ${event.id} frontline ${line.id} has invalid points.` });
      }
    }
    for (const name of event.hatchRegions ?? []) {
      if (!provinces.has(name)) issues.push({ level: "error", message: `Event ${event.id} contests unknown province ${name}.` });
    }
  }
  return issues;
};

export const assertValidHistoricalDataset = (dataset: HistoricalDataset) => {
  const errors = validateHistoricalDataset(dataset).filter((issue) => issue.level === "error");
  if (errors.length) throw new Error(`Historical dataset ${dataset.id} is invalid:\n${errors.map((e) => e.message).join("\n")}`);
};
