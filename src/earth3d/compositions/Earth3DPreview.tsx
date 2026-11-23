import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { EarthScene, type SunSetting } from "../EarthScene";
import { cameraAtFrame, type CameraKeyframe, type GeoCamera } from "../camera/geoCamera";

export type Earth3DPreviewProps = {
  /** 单个镜头；给了 keyframes 时忽略 */
  view?: GeoCamera;
  keyframes?: CameraKeyframe[];
  sun?: SunSetting;
  exaggeration?: number;
  showRivers?: boolean;
  showBuildings?: boolean;
  showBorders?: boolean;
  pixelError?: number;
  hazeDensity?: number;
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
  showRivers = true,
  showBuildings = true,
  showBorders = true,
  pixelError = 1.5,
  hazeDensity = 1 / 140,
}: Earth3DPreviewProps) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const current = keyframes && keyframes.length > 0 ? cameraAtFrame(keyframes, frame) : view;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        flat
        gl={{ logarithmicDepthBuffer: true, antialias: true }}
        camera={{ fov: 35, near: 0.0005, far: 400000 }}
      >
        <EarthScene
          view={current}
          sun={sun}
          exaggeration={exaggeration}
          showRivers={showRivers}
          showBuildings={showBuildings}
          showBorders={showBorders}
          pixelError={pixelError}
          hazeDensity={hazeDensity}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
