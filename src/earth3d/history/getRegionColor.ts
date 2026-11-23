import { interpolateColors } from "remotion";
import type {
  HistoricalActor,
  HistoricalDataset,
  RenderPolicy,
  TerritorialControlPeriod,
} from "./schema";

const getActorColor = (dataset: HistoricalDataset, actorId: HistoricalActor) => {
  const actor = dataset.actors[actorId];

  if (!actor) {
    throw new Error(`Unknown historical actor: ${actorId}`);
  }

  return actor.color;
};

const blendColors = (colorA: string, colorB: string) =>
  interpolateColors(0.5, [0, 1], [colorA, colorB]);

const ownerForColor = (
  control: TerritorialControlPeriod,
  policy: RenderPolicy,
): HistoricalActor => {
  if (policy.colorMode === "controller") {
    return control.controllerId;
  }

  if (policy.colorMode === "sovereign" && control.sovereignId) {
    return control.sovereignId;
  }

  if (policy.puppetUsesSovereignColor && control.status === "puppet" && control.sovereignId) {
    return control.sovereignId;
  }

  if (policy.colonyUsesSovereignColor && control.status === "colony" && control.sovereignId) {
    return control.sovereignId;
  }

  return control.controllerId;
};

export const getRegionColor = (
  dataset: HistoricalDataset,
  control: TerritorialControlPeriod,
  policy: RenderPolicy,
) => {
  if (control.status === "contested" && control.sovereignId) {
    return blendColors(
      getActorColor(dataset, control.controllerId),
      getActorColor(dataset, control.sovereignId),
    );
  }

  return getActorColor(dataset, ownerForColor(control, policy));
};
