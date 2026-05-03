import { interpolateColors } from "remotion";
import { getCameraState } from "../camera/cameraPresets";
import type {
  AttackArrow,
  Frontline,
  WarEvent,
  WorldFeaturePartOverride,
} from "../data/sino-japanese-war.timeline";

export type RenderedTerritoryOverride = Record<string, string>;
export type FadedFrontline = Frontline & { opacity: number };
export type FadedArrow = AttackArrow & { opacity: number };

const mergeTerritoryKeys = (
  current?: Record<string, string>,
  next?: Record<string, string>,
) => Array.from(new Set([...Object.keys(current ?? {}), ...Object.keys(next ?? {})]));

export const getTerritoryColorOverrides = (
  current: WarEvent,
  next: WarEvent,
  progress: number,
): RenderedTerritoryOverride => {
  const keys = mergeTerritoryKeys(current.territoryColorOverrides, next.territoryColorOverrides);
  const result: RenderedTerritoryOverride = {};

  for (const key of keys) {
    const currentColor =
      current.territoryColorOverrides?.[key] ?? next.territoryColorOverrides?.[key];
    const nextColor =
      next.territoryColorOverrides?.[key] ?? current.territoryColorOverrides?.[key];

    if (!currentColor || !nextColor) {
      throw new Error(`Missing resolved territory color for ${key}.`);
    }

    result[key] = interpolateColors(progress, [0, 1], [currentColor, nextColor]);
  }

  return result;
};

const itemKey = <T extends { name?: string; label?: string }>(item: T, fallback: string) =>
  item.name ?? item.label ?? fallback;

export const fadeSceneItems = <T extends { name?: string; label?: string }>(
  currentItems: T[] = [],
  nextItems: T[] = [],
  progress: number,
) => {
  const items = new Map<string, T & { opacity: number }>();

  currentItems.forEach((item, index) => {
    items.set(itemKey(item, `current-${index}`), {
      ...item,
      opacity: 1 - progress,
    });
  });

  nextItems.forEach((item, index) => {
    const key = itemKey(item, `next-${index}`);
    const existing = items.get(key);
    items.set(key, {
      ...(existing ?? item),
      ...item,
      opacity: existing ? 1 : progress,
    });
  });

  return Array.from(items.values()).filter((item) => item.opacity > 0.03);
};

const chooseByProgress = <T>(current: T[] | undefined, next: T[] | undefined, progress: number) =>
  progress < 0.5 ? current ?? [] : next ?? current ?? [];

const mergePartOverrides = (
  current: WorldFeaturePartOverride[] | undefined,
  next: WorldFeaturePartOverride[] | undefined,
  progress: number,
) => chooseByProgress(current, next, progress);

export const getWorldState = (current: WarEvent, next: WarEvent, progress: number) => {
  return {
    camera: getCameraState(current, next, progress),
    territoryColorOverrides: getTerritoryColorOverrides(current, next, progress),
    frontlines: fadeSceneItems(current.frontlines, next.frontlines, progress) as FadedFrontline[],
    arrows: fadeSceneItems(current.arrows, next.arrows, progress) as FadedArrow[],
    worldFeaturePartOverrides: mergePartOverrides(
      current.worldFeaturePartOverrides,
      next.worldFeaturePartOverrides,
      progress,
    ),
    hatchProvinces: chooseByProgress(current.hatchProvinces, next.hatchProvinces, progress),
    labelNames: chooseByProgress(current.labelNames, next.labelNames, progress),
  };
};
