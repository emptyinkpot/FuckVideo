// src/earth3d 的唯一对外出口。模块外的代码只从这里引用。

// 坐标与镜头
export { cameraAtFrame, cameraPose, interpolateCamera, sunDirection } from "./core/camera";
export type { CameraKeyframe, GeoCamera } from "./core/camera";

// 基础地球与画面
export { GlobeScene } from "./globe/GlobeScene";
export type { GlobeSceneProps, SunSetting } from "./globe/GlobeScene";
export { EarthView } from "./view/EarthView";
export type { EarthViewProps } from "./view/EarthView";

// 风格
export { EARTH_STYLES, EARTH_STYLE_IDS, defaultStyle, resolveStyle, strategicStyle } from "./styles";
export type { EarthStyle, EarthStyleId, Rgb } from "./styles";

// 图层
export type { DecalSource, EarthLayer, LayerContext, Projector, RenderPass } from "./layers/types";
export { bordersLayer } from "./layers/borders";
export { territoryLayer } from "./layers/territory";
export { arrowsLayer, frontlinesLayer } from "./layers/warLayers";
export { placeLabelsLayer } from "./layers/placeLabels";

// 成片与模板
export {
  SinoJapaneseWarDemo,
  SINO_JAPANESE_WAR_DURATION,
  SINO_JAPANESE_WAR_SCENE_FRAMES,
} from "./scenes/SinoJapaneseWarDemo";
export type { SinoJapaneseWarDemoProps, WarLayerToggles } from "./scenes/SinoJapaneseWarDemo";
export { EarthFlyover } from "./scenes/EarthFlyover";
export type { EarthFlyoverProps } from "./scenes/EarthFlyover";
export { EarthBackdrop } from "./scenes/EarthBackdrop";
export type { EarthBackdropProps } from "./scenes/EarthBackdrop";
export { Earth3DPreview, defaultEarth3DView } from "./scenes/Earth3DPreview";
export { StrategicMapDemo, STRATEGIC_MAP_DURATION } from "./scenes/StrategicMapDemo";
export type { StrategicMapDemoProps } from "./scenes/StrategicMapDemo";
export type { Earth3DPreviewProps } from "./scenes/Earth3DPreview";
