// src/earth3d 的唯一对外出口。模块外的代码只从这里引用。
export { EarthGlobe } from "./legacy/EarthGlobeTemplate";
export type { EarthGlobeProps } from "./legacy/EarthGlobeTemplate";
export { EditableHistoricalWorldGlobe } from "./legacy/EditableHistoricalWorldGlobe";
export type { EditableHistoricalGlobeProps } from "./legacy/EditableHistoricalWorldGlobe";
export { HistoricalGlobeTexture1938 } from "./legacy/HistoricalGlobeTexture1938";
export type { HistoricalGlobeTexture1938Props } from "./legacy/HistoricalGlobeTexture1938";
export {
  SinoJapaneseWarDemo,
  SINO_JAPANESE_WAR_DURATION,
  SINO_JAPANESE_WAR_SCENE_FRAMES,
} from "./compositions/SinoJapaneseWarDemo";
export type { SinoJapaneseWarDemoProps } from "./compositions/SinoJapaneseWarDemo";

// 新的数据驱动三维地球
export { EarthScene } from "./EarthScene";
export type { EarthSceneProps, SunSetting } from "./EarthScene";
export { Earth3DPreview, defaultEarth3DView } from "./compositions/Earth3DPreview";
export type { Earth3DPreviewProps } from "./compositions/Earth3DPreview";
export { cameraAtFrame, cameraPose, interpolateCamera, sunDirection } from "./camera/geoCamera";
export type { CameraKeyframe, GeoCamera } from "./camera/geoCamera";
