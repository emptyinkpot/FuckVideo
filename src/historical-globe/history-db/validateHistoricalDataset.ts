import type { HistoricalDataset } from "./schema";

export type HistoricalDatasetIssue = {
  level: "error" | "warning";
  message: string;
};

export const validateHistoricalDataset = (
  dataset: HistoricalDataset,
): HistoricalDatasetIssue[] => {
  const issues: HistoricalDatasetIssue[] = [];
  const actorIds = new Set(Object.keys(dataset.actors));
  const regionIds = new Set(dataset.regions.map((region) => region.id));
  const regionsById = new Map(dataset.regions.map((region) => [region.id, region]));

  const isValidDate = (date: string) => /^\d{4}(-\d{2}(-\d{2})?)?$/.test(date);
  const comparableDate = (date: string) => date.padEnd(10, "-01");
  const isDateRangeValid = (from: string, to: string) =>
    isValidDate(from) && isValidDate(to) && comparableDate(from) <= comparableDate(to);
  const isColor = (color: string) =>
    /^#[0-9a-fA-F]{6}$/.test(color) || /^rgba?\(/.test(color);

  if (dataset.regions.length === 0) {
    issues.push({
      level: "error",
      message: `Dataset ${dataset.id} has no regions.`,
    });
  }

  if (dataset.ownership.length === 0) {
    issues.push({
      level: "error",
      message: `Dataset ${dataset.id} has no ownership records.`,
    });
  }

  if (dataset.events.length === 0) {
    issues.push({
      level: "error",
      message: `Dataset ${dataset.id} has no events.`,
    });
  }

  for (const [actorId, actor] of Object.entries(dataset.actors)) {
    if (!actor.label.trim()) {
      issues.push({
        level: "error",
        message: `Actor ${actorId} has empty label.`,
      });
    }

    if (!isColor(actor.color)) {
      issues.push({
        level: "error",
        message: `Actor ${actorId} has invalid color ${actor.color}.`,
      });
    }
  }

  for (const [alias, actorId] of Object.entries(dataset.subjectAliases ?? {})) {
    if (!actorIds.has(actorId)) {
      issues.push({
        level: "error",
        message: `Subject alias ${alias} references unknown actor ${actorId}.`,
      });
    }
  }

  for (const region of dataset.regions) {
    if (region.geometryRefs.length === 0) {
      issues.push({
        level: "error",
        message: `Region ${region.id} has no geometryRefs.`,
      });
    }

    for (const geometryRef of region.geometryRefs) {
      if (!isDateRangeValid(geometryRef.from, geometryRef.to)) {
        issues.push({
          level: "error",
          message: `Region ${region.id} has invalid geometry date range ${geometryRef.from} -> ${geometryRef.to}.`,
        });
      }
    }
  }

  for (const control of dataset.ownership) {
    if (!regionIds.has(control.regionId)) {
      issues.push({
        level: "error",
        message: `Ownership references unknown region ${control.regionId}.`,
      });
    }

    if (!actorIds.has(control.controllerId)) {
      issues.push({
        level: "error",
        message: `Ownership ${control.regionId} references unknown controller ${control.controllerId}.`,
      });
    }

    if (control.sovereignId && !actorIds.has(control.sovereignId)) {
      issues.push({
        level: "error",
        message: `Ownership ${control.regionId} references unknown sovereign ${control.sovereignId}.`,
      });
    }

    if (!isDateRangeValid(control.from, control.to)) {
      issues.push({
        level: "error",
        message: `Ownership ${control.regionId} has invalid date range ${control.from} -> ${control.to}.`,
      });
    }

    const region = regionsById.get(control.regionId);
    const hasLowAccuracyGeometry = region?.geometryRefs.some(
      (geometryRef) =>
        geometryRef.confidence === "low" || geometryRef.geometry.confidence === "low",
    );

    if (control.confidence === "high" && hasLowAccuracyGeometry) {
      issues.push({
        level: "warning",
        message: `Ownership ${control.regionId} is high confidence but uses low-confidence geometry.`,
      });
    }
  }

  for (const event of dataset.events) {
    if (!isValidDate(event.date)) {
      issues.push({
        level: "error",
        message: `Event ${event.id} has invalid date ${event.date}.`,
      });
    }

    if (!event.summary.trim()) {
      issues.push({
        level: "error",
        message: `Event ${event.id} has empty summary.`,
      });
    }

    if (!event.sources.length) {
      issues.push({
        level: "error",
        message: `Event ${event.id} has no sources.`,
      });
    }

    for (const actor of event.actors) {
      if (!actorIds.has(actor)) {
        issues.push({
          level: "error",
          message: `Event ${event.id} references unknown actor ${actor}.`,
        });
      }
    }

    for (const regionId of event.affectedRegions ?? []) {
      if (!regionIds.has(regionId)) {
        issues.push({
          level: "warning",
          message: `Event ${event.id} references unknown affected region ${regionId}.`,
        });
      }
    }
  }

  return issues;
};

export const assertValidHistoricalDataset = (dataset: HistoricalDataset) => {
  const issues = validateHistoricalDataset(dataset);
  const errors = issues.filter((issue) => issue.level === "error");

  if (errors.length > 0) {
    throw new Error(errors.map((issue) => issue.message).join("\n"));
  }

  return issues;
};
