import type {
  HistoricalDataset,
  HistoricalRegion,
  HistoricalRenderableGeometryRef,
  HistoricalResolvedRegion,
  HistoricalWorldState,
  RenderPolicy,
} from "./schema";
import { getRegionColor } from "./getRegionColor";

const openEndedDate = "9999-12-31";

export const defaultRenderPolicy: RenderPolicy = {
  colorMode: "sovereign",
  puppetUsesSovereignColor: true,
  colonyUsesSovereignColor: true,
  occupiedUsesOccupierColor: true,
  contestedPattern: "hatch",
};

const comparableDate = (date: string) => date.padEnd(10, "-01");

const isDateWithin = (date: string, from: string, to: string) => {
  const value = comparableDate(date);
  return value >= comparableDate(from) && value <= comparableDate(to || openEndedDate);
};

const labelForRegion = (region: HistoricalRegion) =>
  region.names.zh ?? region.names.en ?? region.names.local ?? region.id;

const geometryForDate = (
  region: HistoricalRegion,
  date: string,
): HistoricalRenderableGeometryRef | null => {
  const match = region.geometryRefs.find((entry) => isDateWithin(date, entry.from, entry.to));
  return match?.geometry ?? null;
};

export const resolveHistoricalWorldState = (
  dataset: HistoricalDataset,
  date: string,
): HistoricalWorldState => {
  const policy = dataset.renderPolicy ?? defaultRenderPolicy;
  const regionsById = new Map(dataset.regions.map((region) => [region.id, region]));
  const controlsByRegionId = new Map(
    dataset.ownership
      .filter((control) => isDateWithin(date, control.from, control.to))
      .map((control) => [control.regionId, control]),
  );
  const resolvedRegions: HistoricalResolvedRegion[] = [];

  for (const control of controlsByRegionId.values()) {
    const region = regionsById.get(control.regionId);
    if (!region) {
      continue;
    }

    const geometry = geometryForDate(region, date);
    if (!geometry) {
      continue;
    }

    resolvedRegions.push({
      regionId: region.id,
      label: labelForRegion(region),
      geometry,
      controllerId: control.controllerId,
      sovereignId: control.sovereignId,
      status: control.status,
      color: getRegionColor(dataset, control, policy),
      confidence: control.confidence,
      note: control.note,
    });
  }

  return {
    date,
    regions: resolvedRegions,
  };
};
