import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_SANS } from "../../fonts";
import { cameraAtFrame, type CameraKeyframe } from "../core/camera";
import { placeLabelsLayer, type Place } from "../events/placeLabels";
import { pulseLayer } from "../events/pulse";
import { arrowsLayer } from "../events/warLayers";
import type { EarthLayer } from "../layers/types";
import { css, resolveStyle, type EarthStyle } from "../styles";
import { EarthView } from "../view/EarthView";
import { showsText, uiTheme, type EarthSceneProps } from "./shared";

export const STRATEGIC_MAP_DURATION = 360;
const DATE = "1937-09-25";

export type StrategicMapDemoProps = EarthSceneProps & {
  /** 事件层开关：进攻箭头和事件光晕、当地地名、顶部状态条和图例字幕 */
  events?: { arrows?: boolean; places?: boolean; hud?: boolean };
};

// 平型关一带的县镇、山口（城市表里没有的小地方；大同等城市由人文地理层的城市图层画）
const PLACES: Place[] = [
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

const Hud = ({ frame, look }: { frame: number; look: EarthStyle }) => {
  const appear = interpolate(frame, [0, 20], [0, 1], clamp);
  const ui = uiTheme(look);
  const japan = css(look.events.actors.japan);
  const china = css(look.events.actors.china);
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
        ...ui.panel,
        color: ui.text,
        opacity: appear,
        fontWeight: 800,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: 8, background: japan, boxShadow: `0 0 8px ${japan}` }} />
      <div style={{ fontSize: 26, letterSpacing: 2, fontVariantNumeric: "tabular-nums" }}>{DATE.split("-").join(".")}</div>
      <div style={{ width: 1, height: 24, background: ui.muted, opacity: 0.3 }} />
      <div style={{ fontSize: 20, color: china }}>八路军 第115师</div>
      <div style={{ flex: 1, height: 6, background: `linear-gradient(90deg, ${china}, ${css(look.ui.panel)} 50%, ${japan})`, opacity: 0.8 }} />
      <div style={{ fontSize: 20, color: japan }}>日军 第5师团</div>
      <div style={{ marginLeft: 8, padding: "4px 12px", border: `1px solid ${japan}`, color: ui.text, fontSize: 20, background: css(look.events.actors.japan, 0.25) }}>
        平型关战役
      </div>
    </div>
  );
};

const Legend = ({ frame, look }: { frame: number; look: EarthStyle }) => {
  const appear = interpolate(frame, [20, 40], [0, 1], clamp);
  const ui = uiTheme(look);
  const row = (swatch: ReactNode, label: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 26 }}>
      <div style={{ width: 34, display: "flex", justifyContent: "center" }}>{swatch}</div>
      <div>{label}</div>
    </div>
  );
  const line = (c: string) => <div style={{ width: 30, height: 4, background: c, boxShadow: `0 0 6px ${c}` }} />;
  // 占领：领有者底色上叠占领者颜色的斜纹；争夺：占领者颜色的虚线
  const japan = css(look.political.colors.japan);
  const stripes = (base: string, dashed: boolean) => (
    <div
      style={{
        width: 26,
        height: 16,
        background: dashed
          ? `repeating-linear-gradient(45deg, ${japan} 0 2px, transparent 2px 6px), ${base}`
          : `repeating-linear-gradient(135deg, ${japan} 0 2.5px, transparent 2.5px 6px), ${base}`,
        ...(dashed ? { maskImage: "repeating-linear-gradient(-45deg, #000 0 5px, transparent 5px 8px)" } : {}),
      }}
    />
  );
  const [r, g, b] = look.political.colors.roc;
  const shade = look.railways.ownerShade;
  return (
    <div style={{ position: "absolute", left: 22, bottom: 96, padding: "10px 14px", ...ui.panel, color: ui.text, fontSize: 16, fontWeight: 700, opacity: appear }}>
      {row(line(css(look.events.actors.japan)), "日军推进")}
      {row(line(css(look.events.actors.china)), "八路军机动")}
      {row(line(css([r * shade, g * shade, b * shade])), "铁路")}
      {row(stripes(css(look.political.colors.roc, 0.85), false), "日军占领")}
      {row(stripes(css(look.political.colors.jinsui, 0.85), true), "正在争夺")}
    </div>
  );
};

const Caption = ({ frame, look }: { frame: number; look: EarthStyle }) => {
  const current = CAPTIONS.find((caption) => frame >= caption.from && frame < caption.to);
  if (!current) return null;
  const ui = uiTheme(look);
  const opacity = interpolate(frame, [current.from, current.from + 12, current.to - 12, current.to], [0, 1, 1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 34,
        textAlign: "center",
        color: ui.text,
        fontSize: 32,
        fontWeight: 900,
        letterSpacing: 2,
        textShadow: ui.textShadow,
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
 * 人文地理层（控制区、铁路、城市……）由 EarthView 按日期加上；平绥、同蒲铁路是日军进入山西的通道，作为焦点线路。
 */
export const StrategicMapDemo = ({ style = "strategic", map, events: eventToggles = {}, pass = "full" }: StrategicMapDemoProps) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const look = resolveStyle(style);
  const show = (key: keyof NonNullable<StrategicMapDemoProps["events"]>) => eventToggles[key] !== false;
  const japanProgress = interpolate(frame, [50, 200], [0, 1], clamp);
  const chinaProgress = interpolate(frame, [150, 250], [0, 1], clamp);
  const labelOpacity = interpolate(frame, [30, 60], [0, 1], clamp);

  const layers: EarthLayer[] = [];
  if (show("arrows")) {
    layers.push(
      arrowsLayer({
        id: "japan",
        arrows: [{ id: "japan-5th", from: [114.23, 39.44], to: [113.96, 39.34], actor: "japan" }],
        progress: japanProgress,
        widthPx: 14,
        opacity: 0.95,
      }),
      arrowsLayer({
        id: "china",
        arrows: [{ id: "china-115th", from: [114.07, 39.2], to: [114.0, 39.33], actor: "china" }],
        progress: chinaProgress,
        widthPx: 14,
        opacity: 0.95,
      }),
      pulseLayer({ id: "ambush", at: AMBUSH, frame, start: 250 }),
    );
  }
  if (show("places")) layers.push(placeLabelsLayer({ id: "places", places: PLACES, style: "city", opacity: labelOpacity }));

  const hud = showsText(pass) && show("hud");
  return (
    <AbsoluteFill style={{ fontFamily: FONT_SANS, background: "black" }}>
      <EarthView
        view={cameraAtFrame(KEYFRAMES, frame)}
        style={style}
        date={DATE}
        map={{
          toggles: map,
          railFocus: ["pingsui", "tongpu"],
          avoid: [
            [140, 18, 1000, 46],
            [22, height - 96 - 160, 200, 160],
          ],
          opacity: labelOpacity,
        }}
        layers={layers}
        pass={pass}
        showBuildings={false}
      />
      {hud ? (
        <>
          <Hud frame={frame} look={look} />
          <Legend frame={frame} look={look} />
          <Caption frame={frame} look={look} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
