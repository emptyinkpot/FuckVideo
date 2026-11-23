import { useCurrentFrame } from "remotion";
import { cameraAtFrame, type CameraKeyframe, type GeoCamera } from "../core/camera";
import type { SunSetting } from "../globe/GlobeScene";
import { bordersLayer } from "../layers/borders";
import type { EarthLayer, RenderPass } from "../layers/types";
import { EarthView } from "../view/EarthView";

export type Earth3DPreviewProps = {
  /** 单个镜头；给了 keyframes 时忽略 */
  view?: GeoCamera;
  keyframes?: CameraKeyframe[];
  sun?: SunSetting;
  exaggeration?: number;
  /** 图层开关；不填的都显示 */
  layers?: { rivers?: boolean; buildings?: boolean; borders?: boolean };
  pixelError?: number;
  hazeDensity?: number;
  /** 分层导出，见 EarthView */
  pass?: RenderPass;
};

export const defaultEarth3DView: GeoCamera = {
  lon: 116,
  lat: 33,
  rangeKm: 14000,
  pitchDeg: 0,
  headingDeg: 0,
};

/** 新地球的预览：用来检查不同位置、距离、角度下的效果。 */
export const Earth3DPreview = ({
  view = defaultEarth3DView,
  keyframes,
  sun,
  exaggeration = 1,
  layers: toggles = {},
  pixelError = 1.5,
  hazeDensity = 1 / 140,
  pass = "full",
}: Earth3DPreviewProps) => {
  const frame = useCurrentFrame();
  const current = keyframes && keyframes.length > 0 ? cameraAtFrame(keyframes, frame) : view;
  const layers: EarthLayer[] = toggles.borders === false ? [] : [bordersLayer()];
  return (
    <EarthView
      view={current}
      sun={sun}
      exaggeration={exaggeration}
      showRivers={toggles.rivers !== false}
      showBuildings={toggles.buildings !== false}
      pixelError={pixelError}
      hazeDensity={hazeDensity}
      layers={layers}
      pass={pass}
    />
  );
};
