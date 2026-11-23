import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_SANS } from "../../fonts";
import { cameraAtFrame, type GeoCamera } from "../core/camera";
import { EARTH_RADIUS_KM, angularDistance } from "../core/geo";
import { bordersLayer } from "../layers/borders";
import type { EarthLayer, RenderPass } from "../layers/types";
import { arrowsLayer } from "../layers/warLayers";
import { EarthView } from "../view/EarthView";

export type EarthFlyoverProps = {
  title?: string;
  subtitle?: string;
  /** 起点 [经度, 纬度] */
  from?: [number, number];
  /** 终点 [经度, 纬度] */
  to?: [number, number];
  fromLabel?: string;
  toLabel?: string;
  routeColor?: string;
  /** 左侧文字底色的不透明度 */
  overlayOpacity?: number;
  /** 图层开关；不填的都显示 */
  layers?: { rivers?: boolean; borders?: boolean; route?: boolean; pins?: boolean };
  /** 分层导出，见 EarthView */
  pass?: RenderPass;
};

/**
 * 三维地球上的路线飞越：镜头先俯瞰整条路线，再斜着推向终点，路线箭头沿地表从起点长到终点。
 * 替代原来平面照片地图上的 AtlasMapFlyover。
 */
export const EarthFlyover = ({
  title = "关东州与南满铁路",
  subtitle = "从大连到长春",
  from = [121.6, 38.92],
  to = [125.32, 43.88],
  fromLabel = "大连",
  toLabel = "长春",
  routeColor = "#f97316",
  overlayOpacity = 0.86,
  layers: toggles = {},
  pass = "full",
}: EarthFlyoverProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const intro = spring({ frame, fps, config: { damping: 90, stiffness: 120 } });
  const show = (key: keyof NonNullable<EarthFlyoverProps["layers"]>) => toggles[key] !== false;

  const routeKm = angularDistance(from[0], from[1], to[0], to[1]) * EARTH_RADIUS_KM;
  const middle: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const heading = (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;
  const start: GeoCamera = { lon: middle[0], lat: middle[1], rangeKm: Math.max(600, routeKm * 3.2), pitchDeg: 20, headingDeg: 0 };
  const end: GeoCamera = {
    lon: to[0] - (to[0] - from[0]) * 0.15,
    lat: to[1] - (to[1] - from[1]) * 0.15,
    rangeKm: Math.max(150, routeKm * 0.9),
    pitchDeg: 52,
    headingDeg: heading,
  };
  const view = cameraAtFrame(
    [
      { frame: 0, camera: start },
      { frame: durationInFrames - 1, camera: end },
    ],
    frame,
  );
  const routeProgress = interpolate(frame, [durationInFrames * 0.18, durationInFrames * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pins = [
    { label: fromLabel, at: from, delay: durationInFrames * 0.12 },
    { label: toLabel, at: to, delay: durationInFrames * 0.75 },
  ];
  const layers: EarthLayer[] = [];
  if (show("borders")) layers.push(bordersLayer({ opacity: 0.6 }));
  if (show("route")) {
    layers.push(arrowsLayer({ id: "route", arrows: [{ id: "route", from, to, color: routeColor }], progress: routeProgress, widthPx: 10, opacity: 1 }));
  }
  if (show("pins")) {
    layers.push({
      id: "pins",
      order: 40,
      labels: (project) =>
        pins.map((pin) => {
          const at = project(pin.at[0], pin.at[1]);
          const pop = spring({ frame: frame - pin.delay, fps, config: { damping: 12, stiffness: 160 } });
          return at ? (
            <div
              key={pin.label}
              style={{
                position: "absolute",
                left: at.x,
                top: at.y,
                transform: `translate(-50%, -50%) scale(${pop})`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  color: "white",
                  fontSize: 22,
                  fontWeight: 900,
                  textShadow: "0 0 5px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.7)",
                  whiteSpace: "nowrap",
                }}
              >
                {pin.label}
              </div>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 18,
                  background: routeColor,
                  border: "4px solid #fff7ed",
                  boxShadow: `0 0 0 10px ${routeColor}38`,
                }}
              />
            </div>
          ) : null;
        }),
    });
  }

  const showText = pass === "full" || pass === "labels";
  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: FONT_SANS }}>
      <AbsoluteFill style={{ opacity: intro }}>
        <EarthView view={view} layers={layers} pass={pass} showRivers={show("rivers")} showBuildings={false} />
      </AbsoluteFill>
      {pass === "full" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, rgba(7,17,31,${overlayOpacity}), transparent 35%, transparent 70%, rgba(7,17,31,0.45))`,
          }}
        />
      ) : null}
      {showText ? (
        <div style={{ position: "absolute", left: 70, top: 76, color: "white", opacity: intro }}>
          <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.05 }}>{title}</div>
          <div style={{ marginTop: 14, fontSize: 23, fontWeight: 800, color: "#fed7aa" }}>{subtitle}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
