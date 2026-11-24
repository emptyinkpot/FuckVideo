import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT_SANS } from "../../fonts";
import { cameraAtFrame, type CameraKeyframe } from "../core/camera";
import { dataset } from "../history/wars/sinoJapaneseWar";
import { placeLabelsLayer, type Place } from "../layers/placeLabels";
import { territoryLayer } from "../layers/territory";
import type { EarthLayer, RenderPass } from "../layers/types";
import { arrowsLayer } from "../layers/warLayers";
import type { EarthStyleId } from "../styles";
import { EarthView } from "../view/EarthView";

export const STRATEGIC_MAP_DURATION = 360;

export type StrategicMapDemoProps = {
  /** 画面风格，默认态势图；切到 default 可以对比写实风格 */
  style?: EarthStyleId;
  /** 图层开关；不填的都显示 */
  layers?: { rivers?: boolean; territory?: boolean; arrows?: boolean; places?: boolean; hud?: boolean };
  /** 分层导出，见 EarthView */
  pass?: RenderPass;
};

const JAPAN = "#ff4a3d";
const CHINA = "#4aa3ff";

// 平型关一带（山西东北部，恒山与五台山之间）
const PLACES: Place[] = [
  { name: "大同", lon: 113.3, lat: 40.09 },
  { name: "灵丘", lon: 114.23, lat: 39.44 },
  { name: "平型关", lon: 113.93, lat: 39.33 },
  { name: "繁峙", lon: 113.27, lat: 39.19 },
  { name: "代县", lon: 112.96, lat: 39.07 },
  { name: "浑源", lon: 113.69, lat: 39.7 },
  { name: "涞源", lon: 114.69, lat: 39.36 },
  { name: "五台山", lon: 113.59, lat: 39.03 },
];
/** 伏击地段：平型关东北的乔沟一线 */
const AMBUSH: [number, number] = [113.99, 39.35];

const KEYFRAMES: CameraKeyframe[] = [
  { frame: 0, camera: { lon: 113.7, lat: 39.05, rangeKm: 650, pitchDeg: 35, headingDeg: 0 } },
  { frame: 150, camera: { lon: 113.95, lat: 39.25, rangeKm: 240, pitchDeg: 55, headingDeg: 15 } },
  { frame: 359, camera: { lon: 114.0, lat: 39.3, rangeKm: 150, pitchDeg: 62, headingDeg: 32 } },
];

const CAPTIONS: Array<{ from: number; to: number; text: string }> = [
  { from: 10, to: 125, text: "1937年9月，日军第5师团由灵丘向平型关推进" },
  { from: 125, to: 245, text: "八路军第115师预先埋伏在平型关东北的乔沟一线" },
  { from: 245, to: 360, text: "9月25日，伏击日军第21旅团后续部队，取得全面抗战以来的首次大捷" },
];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 事件地点的跳动光晕（画面文字层，跟随三维位置） */
const pulseLayer = (frame: number, start: number): EarthLayer => ({
  id: "pulse",
  order: 45,
  labels: (project) => {
    const at = project(AMBUSH[0], AMBUSH[1]);
    if (!at || frame < start) return null;
    const t = ((frame - start) % 40) / 40;
    const appear = interpolate(frame, [start, start + 15], [0, 1], clamp);
    return (
      <div style={{ position: "absolute", left: at.x, top: at.y, transform: "translate(-50%, -50%)", opacity: appear }}>
        <div
          style={{
            position: "absolute",
            left: -60,
            top: -60,
            width: 120,
            height: 120,
            borderRadius: 120,
            background: "radial-gradient(circle, rgba(255,170,60,0.75) 0%, rgba(255,90,30,0.35) 35%, rgba(255,60,20,0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -10 - 40 * t,
            top: -10 - 40 * t,
            width: 20 + 80 * t,
            height: 20 + 80 * t,
            borderRadius: 999,
            border: "2px solid rgba(255,190,90,0.9)",
            opacity: 1 - t,
          }}
        />
        <div style={{ width: 12, height: 12, borderRadius: 12, background: "#ffd27a", transform: "translate(-50%, -50%)", boxShadow: "0 0 12px #ff9a3c" }} />
      </div>
    );
  },
});

const Hud = ({ frame }: { frame: number }) => {
  const appear = interpolate(frame, [0, 20], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 140,
        right: 140,
        top: 18,
        height: 46,
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "0 22px",
        border: "1px solid rgba(214,178,94,0.55)",
        background: "linear-gradient(180deg, rgba(10,16,20,0.82), rgba(6,10,14,0.72))",
        color: "#e9eef2",
        opacity: appear,
        fontWeight: 800,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: 8, background: JAPAN, boxShadow: `0 0 8px ${JAPAN}` }} />
      <div style={{ fontSize: 26, letterSpacing: 2, fontVariantNumeric: "tabular-nums" }}>1937.09.25</div>
      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.2)" }} />
      <div style={{ fontSize: 20, color: CHINA }}>八路军 第115师</div>
      <div style={{ flex: 1, height: 6, background: `linear-gradient(90deg, ${CHINA}, #20303c 50%, ${JAPAN})`, opacity: 0.8 }} />
      <div style={{ fontSize: 20, color: JAPAN }}>日军 第5师团</div>
      <div
        style={{
          marginLeft: 8,
          padding: "4px 12px",
          border: `1px solid ${JAPAN}`,
          color: "#ffd8d2",
          fontSize: 20,
          background: "rgba(120,20,16,0.45)",
        }}
      >
        平型关战役
      </div>
    </div>
  );
};

const Legend = ({ frame }: { frame: number }) => {
  const appear = interpolate(frame, [20, 40], [0, 1], clamp);
  const row = (swatch: ReactNode, label: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 26 }}>
      <div style={{ width: 34, display: "flex", justifyContent: "center" }}>{swatch}</div>
      <div>{label}</div>
    </div>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 22,
        bottom: 96,
        padding: "10px 14px",
        background: "rgba(6,10,14,0.7)",
        borderLeft: "3px solid rgba(214,178,94,0.7)",
        color: "#dfe6ea",
        fontSize: 16,
        fontWeight: 700,
        opacity: appear,
      }}
    >
      {row(<div style={{ width: 30, height: 4, background: JAPAN, boxShadow: `0 0 6px ${JAPAN}` }} />, "日军推进")}
      {row(<div style={{ width: 30, height: 4, background: CHINA, boxShadow: `0 0 6px ${CHINA}` }} />, "八路军机动")}
      {row(<div style={{ width: 22, height: 14, background: "rgba(200,40,30,0.75)" }} />, "日军控制区")}
      {row(<div style={{ width: 22, height: 14, background: "rgba(235,160,40,0.6)" }} />, "争夺区")}
    </div>
  );
};

const Caption = ({ frame }: { frame: number }) => {
  const current = CAPTIONS.find((caption) => frame >= caption.from && frame < caption.to);
  if (!current) return null;
  const opacity = interpolate(frame, [current.from, current.from + 12, current.to - 12, current.to], [0, 1, 1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 34,
        textAlign: "center",
        color: "#f4f7f9",
        fontSize: 32,
        fontWeight: 900,
        letterSpacing: 2,
        textShadow: "0 2px 6px rgba(0,0,0,0.95), 0 0 18px rgba(0,0,0,0.8)",
        opacity,
      }}
    >
      {current.text}
    </div>
  );
};

/**
 * 态势图风格示例：1937 年平型关战役。
 * 镜头从高空推近到恒山、五台山之间的山地，日军由灵丘向平型关推进，八路军第 115 师在乔沟一线设伏。
 */
export const StrategicMapDemo = ({ style = "strategic", layers: toggles = {}, pass = "full" }: StrategicMapDemoProps) => {
  const frame = useCurrentFrame();
  const show = (key: keyof NonNullable<StrategicMapDemoProps["layers"]>) => toggles[key] !== false;
  const japanProgress = interpolate(frame, [50, 200], [0, 1], clamp);
  const chinaProgress = interpolate(frame, [150, 250], [0, 1], clamp);
  const labelOpacity = interpolate(frame, [30, 60], [0, 1], clamp);

  const layers: EarthLayer[] = [];
  if (show("territory")) {
    layers.push(territoryLayer({ dataset, date: "1937-09-25", look: { contested: "tint", edges: false } }));
  }
  if (show("arrows")) {
    layers.push(
      arrowsLayer({
        id: "japan",
        arrows: [{ id: "japan-5th", from: [114.23, 39.44], to: [113.96, 39.34], color: JAPAN }],
        progress: japanProgress,
        widthPx: 14,
        opacity: 0.95,
      }),
      arrowsLayer({
        id: "china",
        arrows: [{ id: "china-115th", from: [114.07, 39.2], to: [114.0, 39.33], color: CHINA }],
        progress: chinaProgress,
        widthPx: 14,
        opacity: 0.95,
      }),
    );
  }
  if (show("places")) layers.push(placeLabelsLayer({ id: "places", places: PLACES, style: "city", opacity: labelOpacity }));
  if (show("arrows")) layers.push(pulseLayer(frame, 250));

  const showText = (pass === "full" || pass === "labels") && show("hud");
  return (
    <AbsoluteFill style={{ fontFamily: FONT_SANS, background: "black" }}>
      <EarthView
        view={cameraAtFrame(KEYFRAMES, frame)}
        style={style}
        layers={layers}
        pass={pass}
        showRivers={show("rivers")}
        showBuildings={false}
      />
      {showText ? (
        <>
          <Hud frame={frame} />
          <Legend frame={frame} />
          <Caption frame={frame} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
