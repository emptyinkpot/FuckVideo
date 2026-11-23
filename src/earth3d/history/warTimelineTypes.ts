export type Frontline = {
  name: string;
  points: Array<[number, number]>;
  opacity?: number;
};

export type AttackArrow = {
  from: [number, number];
  to: [number, number];
  label?: string;
  opacity?: number;
};

export type WorldFeaturePartOverride = {
  featureName: string;
  partIndexes: number[];
  color: string;
};

export type WarEvent = {
  year: number;
  title: string;
  subtitle?: string;
  focus: [number, number];
  zoom: number;
  frontlines?: Frontline[];
  arrows?: AttackArrow[];
  hatchProvinces?: string[];
  labelNames?: string[];
  territoryColorOverrides?: Record<string, string>;
  worldFeaturePartOverrides?: WorldFeaturePartOverride[];
};
