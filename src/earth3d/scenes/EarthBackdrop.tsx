import { useCurrentFrame, useVideoConfig } from "remotion";
import type { GeoCamera } from "../core/camera";
import { EarthView } from "../view/EarthView";
import type { EarthStyleId } from "../styles";

export type EarthBackdropProps = {
  /** 画面风格：default（写实）、strategic（态势图），见 src/earth3d/styles */
  style?: EarthStyleId;
  /** 画面中心对准的经纬度 */
  lon?: number;
  lat?: number;
  /** 镜头距离（公里） */
  rangeKm?: number;
  pitchDeg?: number;
  /** 整段时长内镜头朝东缓慢平移的经度（度） */
  driftDeg?: number;
};

/**
 * 三维地球背景：俯瞰东亚、缓慢平移，只有基础地球，不带任何图层。用作讲解类视频的底图。
 * 替代原来的平面照片世界地图背景。
 */
export const EarthBackdrop = ({
  lon = 112,
  lat = 33,
  rangeKm = 5200,
  pitchDeg = 18,
  driftDeg = 6,
  style = "default",
}: EarthBackdropProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  const view: GeoCamera = { lon: lon - driftDeg / 2 + driftDeg * t, lat, rangeKm, pitchDeg, headingDeg: 0 };
  return <EarthView view={view} style={style} showBuildings={false} />;
};
