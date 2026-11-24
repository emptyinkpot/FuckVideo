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
export { nationsLayer, politicalPalette } from "./map/political";
export type { PoliticalDate } from "./map/political";
export { occupationLayer } from "./map/occupation";
export { provinceStateOn, politiesOnDate, loadProvinces, PROVINCES, POLITY_IDS } from "./map/provinceStore";
export type { ProvinceState } from "./map/provinceStore";
export { arrowsLayer, frontlinesLayer } from "./events/warLayers";
export { placeLabelsLayer } from "./events/placeLabels";
export { citiesLayer } from "./map/cities";
export { regionsLayer } from "./map/regions";
export { mapLayers, MAP_LAYER_IDS, DEFAULT_MAP_TOGGLES } from "./map/mapLayers";
export type { MapOptions, MapToggles } from "./map/mapLayers";
export { pulseLayer } from "./events/pulse";
export type { ArrowActor, ArrowSpec } from "./events/warLayers";
export { railwaysLayer, railwayOn, RAILWAY_LINES } from "./map/railways";
export type { RailwayOwner } from "./map/railways";
export { CITIES_1930S, CAPITALS } from "./history/places/cities";
export { cityNameOn, capitalOn } from "./history/places/types";
export type { HistoricCity, CapitalPeriod } from "./history/places/types";

// 成片与模板
export {
  SinoJapaneseWarDemo,
  SINO_JAPANESE_WAR_DURATION,
  SINO_JAPANESE_WAR_SCENE_FRAMES,
} from "./scenes/SinoJapaneseWarDemo";
export type { SinoJapaneseWarDemoProps, WarEventToggles } from "./scenes/SinoJapaneseWarDemo";
export type { EarthSceneProps } from "./scenes/shared";
export { EarthFlyover } from "./scenes/EarthFlyover";
export type { EarthFlyoverProps } from "./scenes/EarthFlyover";
export { EarthBackdrop } from "./scenes/EarthBackdrop";
export type { EarthBackdropProps } from "./scenes/EarthBackdrop";
export { Earth3DPreview, defaultEarth3DView } from "./scenes/Earth3DPreview";
export { StrategicMapDemo, STRATEGIC_MAP_DURATION } from "./scenes/StrategicMapDemo";
export type { StrategicMapDemoProps } from "./scenes/StrategicMapDemo";
export type { Earth3DPreviewProps } from "./scenes/Earth3DPreview";
