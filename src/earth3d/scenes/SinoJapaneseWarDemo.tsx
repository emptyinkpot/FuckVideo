import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT_SANS } from "../../fonts";
import { cameraAtFrame, type CameraKeyframe } from "../core/camera";
import {
  arrowColor,
  cities,
  dataset,
  eventCamera,
  events,
  openingCamera,
  regionLabelsFor,
} from "../history/wars/sinoJapaneseWar";
import { bordersLayer } from "../layers/borders";
import { placeLabelsLayer } from "../layers/placeLabels";
import { territoryLayer } from "../layers/territory";
import type { EarthLayer, RenderPass } from "../layers/types";
import { arrowsLayer, frontlinesLayer } from "../layers/warLayers";
import { EarthView } from "../view/EarthView";
import type { EarthStyleId } from "../styles";

const FPS = 30;
/** 开场：从太空降到第一个事件 */
const INTRO_FRAMES = FPS * 3;
/** 每个事件：前 HOLD 帧停在该事件，余下的帧飞往下一个事件 */
export const SINO_JAPANESE_WAR_SCENE_FRAMES = FPS * 5;
const HOLD_FRAMES = Math.round(SINO_JAPANESE_WAR_SCENE_FRAMES * 0.7);
export const SINO_JAPANESE_WAR_DURATION = INTRO_FRAMES + SINO_JAPANESE_WAR_SCENE_FRAMES * events.length;

/** 各图层开关；不填的都显示。 */
export type WarLayerToggles = {
  /** 河流（基础地球的一部分） */
  rivers?: boolean;
  /** 1938 年国界 */
  borders?: boolean;
  /** 控制区着色 */
  territory?: boolean;
  /** 战线 */
  frontlines?: boolean;
  /** 进攻箭头 */
  arrows?: boolean;
  /** 城市名 */
  cities?: boolean;
  /** 国家、地区名 */
  regions?: boolean;
};

export type SinoJapaneseWarDemoProps = {
  /** 画面风格：default（写实）、strategic（态势图），见 src/earth3d/styles */
  style?: EarthStyleId;
  title?: string;
  subtitle?: string;
  cardLeft?: number;
  cardBottom?: number;
  progressTop?: number;
  showProgressBar?: boolean;
  layers?: WarLayerToggles;
  /**
   * 分层导出：full 完整画面；globe 只有基础地球；overlay 只有国界、着色、战线、箭头（透明背景）；
   * labels 只有地名、标题、信息卡、进度条（透明背景）。
   */
  pass?: RenderPass;
};

const KEYFRAMES: CameraKeyframe[] = (() => {
  const frames: CameraKeyframe[] = [{ frame: 0, camera: openingCamera }];
  events.forEach((event, index) => {
    const start = INTRO_FRAMES + index * SINO_JAPANESE_WAR_SCENE_FRAMES;
    const camera = eventCamera(event);
    frames.push({ frame: start, camera });
    // 停留时缓慢推近
    frames.push({ frame: start + HOLD_FRAMES, camera: { ...camera, rangeKm: camera.rangeKm * 0.9 } });
  });
  return frames;
})();

const easeOut = (value: number) => 1 - (1 - value) ** 3;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const SinoJapaneseWarDemo = ({
  title = "1931-1945 中日战争演化",
  subtitle = "真实三维地球上的时间线、战线与占领区",
  cardLeft = 48,
  cardBottom = 42,
  progressTop = 34,
  showProgressBar = true,
  layers: toggles = {},
  pass = "full",
  style = "default",
}: SinoJapaneseWarDemoProps) => {
  const frame = useCurrentFrame();
  const show = (key: keyof WarLayerToggles) => toggles[key] !== false;

  // 当前所处的事件与过渡进度
  const sceneFrame = Math.max(0, frame - INTRO_FRAMES);
  const index = Math.min(events.length - 1, Math.floor(sceneFrame / SINO_JAPANESE_WAR_SCENE_FRAMES));
  const event = events[index];
  const nextEvent = events[index + 1] ?? null;
  const local = frame < INTRO_FRAMES ? -1 : sceneFrame - index * SINO_JAPANESE_WAR_SCENE_FRAMES;
  const transition = nextEvent ? interpolate(local, [HOLD_FRAMES, SINO_JAPANESE_WAR_SCENE_FRAMES], [0, 1], clamp) : 0;
  const arrowProgress = easeOut(interpolate(local, [8, 70], [0, 1], clamp));
  const lineOpacity = frame < INTRO_FRAMES ? 0 : 1 - transition;
  const labelOpacity = interpolate(frame, [INTRO_FRAMES * 0.5, INTRO_FRAMES], [0, 1], clamp);

  const layers: EarthLayer[] = [];
  if (show("territory")) {
    layers.push(
      territoryLayer({
        dataset,
        date: event.date,
        contested: event.hatchRegions ?? [],
        next: nextEvent ? { date: nextEvent.date, contested: nextEvent.hatchRegions ?? [], mix: transition } : null,
      }),
    );
  }
  if (show("borders")) layers.push(bordersLayer());
  if (show("frontlines")) {
    layers.push(
      frontlinesLayer({
        id: `frontlines-${event.id}`,
        lines: (event.frontlines ?? []).map((line) => line.points),
        opacity: 0.95 * lineOpacity,
      }),
    );
  }
  if (show("arrows")) {
    layers.push(
      arrowsLayer({
        id: `arrows-${event.id}`,
        arrows: (event.arrows ?? []).map((arrow) => ({ ...arrow, color: arrowColor(arrow.actor) })),
        progress: arrowProgress,
        opacity: 0.92 * lineOpacity,
      }),
    );
  }
  if (show("regions")) {
    layers.push(placeLabelsLayer({ id: "regions", places: regionLabelsFor(event), style: "region", opacity: labelOpacity }));
  }
  if (show("cities")) {
    layers.push(placeLabelsLayer({ id: "cities", places: cities, style: "city", opacity: labelOpacity }));
  }

  const showText = pass === "full" || pass === "labels";
  const cardOpacity =
    frame < INTRO_FRAMES
      ? interpolate(frame, [INTRO_FRAMES - 25, INTRO_FRAMES], [0, 1], clamp)
      : interpolate(
          local,
          [0, 14, HOLD_FRAMES, SINO_JAPANESE_WAR_SCENE_FRAMES],
          [index === 0 ? 1 : 0, 1, 1, nextEvent ? 0 : 1],
          clamp,
        );
  const progress = interpolate(frame, [0, SINO_JAPANESE_WAR_DURATION - 1], [0, 100], clamp);

  return (
    <AbsoluteFill style={{ fontFamily: FONT_SANS }}>
      <EarthView
        style={style}
        view={cameraAtFrame(KEYFRAMES, frame)}
        layers={layers}
        pass={pass}
        showRivers={show("rivers")}
        showBuildings={false}
      />

      {showText && frame < INTRO_FRAMES * 0.8 ? (
        <div
          style={{
            position: "absolute",
            left: cardLeft,
            top: 70,
            color: "#f8fafc",
            opacity: interpolate(frame, [0, 12, INTRO_FRAMES * 0.6, INTRO_FRAMES * 0.8], [0, 1, 1, 0]),
            textShadow: "0 0 24px rgba(0,0,0,0.8)",
          }}
        >
          <div style={{ fontSize: 52, fontWeight: 900 }}>{title}</div>
          <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700, color: "#bfdbfe" }}>{subtitle}</div>
        </div>
      ) : null}

      {showText ? (
        <div
          style={{
            position: "absolute",
            left: cardLeft,
            bottom: cardBottom,
            width: 560,
            padding: "18px 22px",
            borderRadius: 10,
            background: "rgba(8, 12, 18, 0.62)",
            color: "#f8fafc",
            opacity: cardOpacity,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 900, color: "#facc15" }}>{event.date.slice(0, 4)}</div>
          <div style={{ marginTop: 2, fontSize: 44, fontWeight: 900, lineHeight: 1.1 }}>{event.title}</div>
          <div style={{ marginTop: 10, fontSize: 19, fontWeight: 600, color: "#dbe7f7", lineHeight: 1.45 }}>
            {event.summary}
          </div>
          {event.camera.label ? (
            <div style={{ marginTop: 10, fontSize: 15, color: "#94a3b8" }}>{event.camera.label}</div>
          ) : null}
        </div>
      ) : null}

      {showText && showProgressBar ? (
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            top: progressTop,
            height: 4,
            background: "rgba(255,255,255,0.16)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div style={{ width: `${progress}%`, height: "100%", background: "rgba(255,180,80,0.96)" }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
