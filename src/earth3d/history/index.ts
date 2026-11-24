export * from "./schema";
export * from "./validateHistoricalDataset";
export { sinoJapaneseWarDataset } from "./datasets/sino-japanese-war";
export * from "./political/types";
export { POLITIES, polityById } from "./political/polities";
export type { PolityId } from "./political/polities";
export { REGIONS } from "./political/regions";
export { OWNERS, CONTROLS } from "./political/periods";
export { validatePoliticalData } from "./political/resolve";
