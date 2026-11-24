import { useCurrentFrame } from "remotion";
import { cameraAtFrame, type CameraKeyframe, type GeoCamera } from "../core/camera";
import type { SunSetting } from "../globe/GlobeScene";
import { EarthView } from "../view/EarthView";
import { DEFAULT_SCENE_DATE, type EarthSceneProps } from "./shared";

export type Earth3DPreviewProps = EarthSceneProps & {
  /** 画面日期（人文地理层按它显示），默认 1937-07-07 */
  date?: string;
  /** 单个镜头；给了 keyframes 时忽略 */
  view?: GeoCamera;
  keyframes?: CameraKeyframe[];
  sun?: SunSetting;
  /** 不填时用风格的设置 */
  exaggeration?: number;
  /** 城市三维建筑（镜头很近时出现） */
  buildings?: boolean;
  pixelError?: number;
  /** 不填时用风格的设置 */
  hazeDensity?: number;
};

export const defaultEarth3DView: GeoCamera = {
  lon: 116,
  lat: 33,
  rangeKm: 14000,
  pitchDeg: 0,
  headingDeg: 0,
};

/** 新地球的预览：用来检查不同位置、距离、角度、风格下的效果，带全部人文地理层。 */
export const Earth3DPreview = ({
  view = defaultEarth3DView,
  keyframes,
  sun,
  exaggeration,
  date = DEFAULT_SCENE_DATE,
  style = "default",
  map,
  buildings = true,
  pixelError = 1.5,
  hazeDensity,
  pass = "full",
}: Earth3DPreviewProps) => {
  const frame = useCurrentFrame();
  const current = keyframes && keyframes.length > 0 ? cameraAtFrame(keyframes, frame) : view;
  return (
    <EarthView
      style={style}
      view={current}
      date={date}
      map={{ toggles: map }}
      sun={sun}
      exaggeration={exaggeration}
      showBuildings={buildings}
      pixelError={pixelError}
      hazeDensity={hazeDensity}
      pass={pass}
    />
  );
};
