import type {
  HistoricalActor,
  HistoricalDataset,
  HistoricalEventProcess,
  HistoricalResolvedRegion,
} from "../schema";
import { assertValidHistoricalDataset } from "../validateHistoricalDataset";
import type {
  AttackArrow,
  Frontline,
  WarEvent,
} from "../../data/warTimelineTypes";
import { resolveHistoricalWorldState } from "../resolveHistoricalWorldState";

const yearFromDate = (date: string) => {
  const match = /^(\d{4})/.exec(date);

  if (!match) {
    throw new Error(`Historical event date must start with a year: ${date}`);
  }

  return Number(match[1]);
};

type TimelineSource = Pick<HistoricalEventProcess, "arrows" | "frontlines">;

const toFrontlines = (source: TimelineSource): Frontline[] | undefined => {
  if (!source.frontlines?.length) {
    return undefined;
  }

  return source.frontlines.map((frontline) => ({
    name: frontline.label,
    points: frontline.points,
  }));
};

const toArrows = (source: TimelineSource): AttackArrow[] | undefined => {
  if (!source.arrows?.length) {
    return undefined;
  }

  return source.arrows.map((arrow) => ({
    from: arrow.from,
    to: arrow.to,
    label: arrow.label,
  }));
};

const toLegacyRegionKey = (region: HistoricalResolvedRegion) => {
  if (region.geometry.type === "custom-geojson") {
    return region.geometry.featureId;
  }

  return region.label;
};

const toTerritoryOverrides = (
  resolvedRegions: HistoricalResolvedRegion[],
): Record<string, string> | undefined => {
  if (resolvedRegions.length === 0) {
    return undefined;
  }

  const overrides: Record<string, string> = {};

  for (const region of resolvedRegions) {
    if (region.geometry.type === "geojson-feature-part") {
      continue;
    }

    overrides[toLegacyRegionKey(region)] = region.color;
    overrides[region.label] = region.color;
  }

  return overrides;
};

const toWorldFeaturePartOverrides = (resolvedRegions: HistoricalResolvedRegion[]) =>
  resolvedRegions.flatMap((region) => {
    if (region.geometry.type !== "geojson-feature-part") {
      return [];
    }

    return [
      {
        featureName: region.geometry.featureName,
        partIndexes: region.geometry.partIndexes,
        color: region.color,
      },
    ];
  });

const hatchRegionsFromWorldState = (resolvedRegions: HistoricalResolvedRegion[]) =>
  resolvedRegions
    .filter((region) => region.status === "contested")
    .map((region) => toLegacyRegionKey(region));

export const datasetActorsToTerritoryColors = (
  dataset: HistoricalDataset,
): Record<HistoricalActor | string, string> => {
  const colors: Record<HistoricalActor | string, string> = {};

  for (const [actor, config] of Object.entries(dataset.actors) as Array<
    [HistoricalActor, { color: string }]
  >) {
    colors[actor] = config.color;
  }

  for (const [alias, actor] of Object.entries(dataset.subjectAliases ?? {})) {
    colors[alias] = dataset.actors[actor].color;
  }

  return colors;
};

export const datasetSubjectAliasesToActorIds = (dataset: HistoricalDataset): Record<string, string> => {
  const aliases: Record<string, string> = {};

  for (const [alias, actor] of Object.entries(dataset.subjectAliases ?? {})) {
    aliases[alias] = actor;
  }

  return aliases;
};

export const eventToWarEvent = (
  dataset: HistoricalDataset,
  event: HistoricalEventProcess,
): WarEvent => {
  const historicalWorldState = resolveHistoricalWorldState(dataset, event.date);
  const resolvedPartOverrides = toWorldFeaturePartOverrides(historicalWorldState.regions);
  return {
    year: yearFromDate(event.date),
    title: event.title,
    subtitle: event.summary,
    focus: event.camera.focus,
    zoom: event.camera.zoom,
    frontlines: toFrontlines(event),
    arrows: toArrows(event),
    worldFeaturePartOverrides: resolvedPartOverrides,
    hatchProvinces: Array.from(
      new Set([...(event.hatchRegions ?? []), ...hatchRegionsFromWorldState(historicalWorldState.regions)]),
    ),
    labelNames: event.labels,
    territoryColorOverrides: toTerritoryOverrides(historicalWorldState.regions),
  };
};

export const datasetToWarTimeline = (dataset: HistoricalDataset): WarEvent[] => {
  assertValidHistoricalDataset(dataset);

  return dataset.events.map((event) => eventToWarEvent(dataset, event));
};
