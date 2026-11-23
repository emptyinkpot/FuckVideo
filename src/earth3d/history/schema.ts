export type LonLat = [number, number];

export type HistoricalActor =
  | "china"
  | "japan"
  | "manchukuo"
  | "soviet"
  | "usa"
  | "uk"
  | "france"
  | "germany"
  | "contested"
  | "neutral";

export type HistoricalConfidence = "high" | "medium" | "low";

export type HistoricalGeometryLevel =
  | "country"
  | "province"
  | "prefecture"
  | "county"
  | "custom-polygon"
  | "symbolic";

export type HistoricalRenderableGeometryRef =
  | {
      type: "geojson-feature";
      source: string;
      featureName: string;
      level: HistoricalGeometryLevel;
      confidence: HistoricalConfidence;
      note?: string;
    }
  | {
      type: "geojson-feature-part";
      source: string;
      featureName: string;
      partIndexes: number[];
      level: HistoricalGeometryLevel;
      confidence: HistoricalConfidence;
      note?: string;
    }
  | {
      type: "custom-geojson";
      source: string;
      featureId: string;
      level: HistoricalGeometryLevel;
      confidence: HistoricalConfidence;
      note?: string;
    };

export type HistoricalRegion = {
  id: string;
  names: {
    zh?: string;
    en?: string;
    local?: string;
  };
  aliases?: string[];
  geometryRefs: Array<{
    from: string;
    to: string;
    geometry: HistoricalRenderableGeometryRef;
    confidence: HistoricalConfidence;
    note?: string;
  }>;
};

export type HistoricalControlStatus =
  | "sovereign"
  | "controlled"
  | "occupied"
  | "puppet"
  | "colony"
  | "protectorate"
  | "leased"
  | "contested"
  | "neutral"
  | "liberated";

export type TerritorialControlPeriod = {
  regionId: string;
  from: string;
  to: string;
  controllerId: HistoricalActor;
  sovereignId?: HistoricalActor;
  status: HistoricalControlStatus;
  confidence: HistoricalConfidence;
  sources?: string[];
  note?: string;
};

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
  labels?: string[];
  hatchRegions?: string[];
  affectedRegions?: string[];
  result?: {
    controlChanges?: TerritorialControlPeriod[];
  };
  confidence: HistoricalConfidence;
  sources: string[];
  note?: string;
};

export type RenderPolicy = {
  colorMode: "controller" | "sovereign" | "status" | "custom";
  puppetUsesSovereignColor: boolean;
  colonyUsesSovereignColor: boolean;
  occupiedUsesOccupierColor: boolean;
  contestedPattern: "hatch" | "pulse" | "blend";
};

export type HistoricalResolvedRegion = {
  regionId: string;
  label: string;
  geometry: HistoricalRenderableGeometryRef;
  controllerId: HistoricalActor;
  sovereignId?: HistoricalActor;
  status: HistoricalControlStatus;
  color: string;
  confidence: HistoricalConfidence;
  note?: string;
};

export type HistoricalWorldState = {
  date: string;
  regions: HistoricalResolvedRegion[];
};

export type HistoricalCameraHint = {
  focus: LonLat;
  zoom: number;
  label?: string;
};

export type HistoricalDataset = {
  id: string;
  title: string;
  period: {
    start: string;
    end: string;
  };
  geometryPolicy?: {
    currentRenderableLevels: HistoricalGeometryLevel[];
    defaultDataset: string;
    note: string;
  };
  subjectAliases?: Record<string, HistoricalActor>;
  renderPolicy?: RenderPolicy;
  actors: Record<
    HistoricalActor,
    {
      label: string;
      color: string;
    }
  >;
  regions: HistoricalRegion[];
  ownership: TerritorialControlPeriod[];
  events: HistoricalEventProcess[];
};
