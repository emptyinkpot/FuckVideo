import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_SANS } from "../../fonts";
import { cameraAtFrame, type CameraKeyframe } from "../core/camera";
import { arrowsLayer, frontlinesLayer, type ArrowActor } from "../events/warLayers";
import { eventCamera, events, openingCamera } from "../history/wars/sinoJapaneseWar";
import type { HistoricalActor } from "../history/schema";
import type { EarthLayer } from "../layers/types";
import { EarthView } from "../view/EarthView";
import { showsText, uiTheme, type EarthSceneProps } from "./shared";

const FPS = 30;
/** 开场：从太空降到第一个事件 */
const INTRO_FRAMES = FPS * 3;
/** 每个事件：前 HOLD 帧停在该事件，余下的帧飞往下一个事件 */
export const SINO_JAPANESE_WAR_SCENE_FRAMES = FPS * 5;
const HOLD_FRAMES = Math.round(SINO_JAPANESE_WAR_SCENE_FRAMES * 0.7);
export const SINO_JAPANESE_WAR_DURATION = INTRO_FRAMES + SINO_JAPANESE_WAR_SCENE_FRAMES * events.length;

/** 事件层开关；不填的都显示。人文地理层的开关在 map 里（所有地球动画共用）。 */
export type WarEventToggles = {
  /** 战线 */
  frontlines?: boolean;
  /** 进攻箭头 */
  arrows?: boolean;
};

export type SinoJapaneseWarDemoProps = EarthSceneProps & {
  title?: string;
  subtitle?: string;
  cardLeft?: number;
  cardBottom?: number;
  progressTop?: number;
  showProgressBar?: boolean;
  events?: WarEventToggles;
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

/** 史料里的参与方 -> 箭头阵营（风格里有颜色的几个；其余按 other）。 */
const arrowActor = (actor?: HistoricalActor): ArrowActor =>
  actor === "japan" || actor === "manchukuo" || actor === "china" || actor === "soviet" ? actor : "other";

const easeOut = (value: number) => 1 - (1 - value) ** 3;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const SinoJapaneseWarDemo = ({
  title = "1931-1945 中日战争演化",
  subtitle = "真实三维地球上的时间线、战线与占领区",
  cardLeft = 48,
  cardBottom = 42,
  progressTop = 34,
  showProgressBar = true,
  events: eventToggles = {},
  map,
  pass = "full",
  style = "default",
}: SinoJapaneseWarDemoProps) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const show = (key: keyof WarEventToggles) => eventToggles[key] !== false;
  const ui = uiTheme(style);

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

  // 事件层：战线、进攻箭头（颜色按阵营和风格）。人文地理层由 EarthView 按日期加上。
  const layers: EarthLayer[] = [];
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
        arrows: (event.arrows ?? []).map((arrow) => ({ ...arrow, actor: arrowActor(arrow.actor) })),
        progress: arrowProgress,
        opacity: 0.92 * lineOpacity,
      }),
    );
  }
  // 城市名避开左下的字幕卡片
  const card: [number, number, number, number] = [cardLeft, height - cardBottom - 220, 560, 220];

  const showText = showsText(pass);
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
        date={event.date}
        map={{
          toggles: map,
          // 事件额外标注的争夺省份；过渡时国家和占领状态向下一个事件推进
          political: {
            contested: event.hatchRegions ?? [],
            next: nextEvent ? { date: nextEvent.date, contested: nextEvent.hatchRegions ?? [], mix: transition } : null,
          },
          avoid: [card],
          opacity: labelOpacity,
        }}
        layers={layers}
        pass={pass}
        showBuildings={false}
      />

      {showText && frame < INTRO_FRAMES * 0.8 ? (
        <div
          style={{
            position: "absolute",
            left: cardLeft,
            top: 70,
            color: ui.text,
            opacity: interpolate(frame, [0, 12, INTRO_FRAMES * 0.6, INTRO_FRAMES * 0.8], [0, 1, 1, 0]),
            textShadow: ui.textShadow,
          }}
        >
          <div style={{ fontSize: 52, fontWeight: 900 }}>{title}</div>
          <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700, color: ui.muted }}>{subtitle}</div>
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
            ...ui.panel,
            color: ui.text,
            opacity: cardOpacity,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 900, color: ui.accent }}>{event.date.slice(0, 4)}</div>
          <div style={{ marginTop: 2, fontSize: 44, fontWeight: 900, lineHeight: 1.1 }}>{event.title}</div>
          <div style={{ marginTop: 10, fontSize: 19, fontWeight: 600, color: ui.muted, lineHeight: 1.45 }}>
            {event.summary}
          </div>
          {event.camera.label ? (
            <div style={{ marginTop: 10, fontSize: 15, color: ui.muted, opacity: 0.75 }}>{event.camera.label}</div>
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
          <div style={{ width: `${progress}%`, height: "100%", background: ui.accent }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
