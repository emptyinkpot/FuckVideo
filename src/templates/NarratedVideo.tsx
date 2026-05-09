import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  activeCaptionAt,
  VideoInfrastructure,
  type CaptionStyle,
  type ProgressStyle,
} from "../video-infrastructure/VideoInfrastructure";
import {
  resolveCaptionLayout,
  resolveProgressLayout,
  type VideoInfrastructureLayoutProps,
} from "./MultiSceneVideo";

export type NarratedCaption = {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
};

export type NarratedVideoProps = {
  title: string;
  subtitle?: string;
  bodyText: string;
  audioSrc?: string;
  captions?: NarratedCaption[];
  durationSeconds?: number;
  theme?: "historical" | "clean";
  captionStyle?: CaptionStyle;
  progressStyle?: ProgressStyle;
} & VideoInfrastructureLayoutProps;

const fallbackText =
  "输入文本后，脚本会调用 Qwen TTS 生成旁白音频，并把音频、字幕和文本送入 Remotion 渲染成视频。";

const splitText = (value: string): string[] => {
  const text = (value || fallbackText).replace(/\s+/g, "");
  const chunks = text.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [text];
  return chunks.map((chunk) => chunk.trim()).filter(Boolean).slice(0, 8);
};

export const NarratedVideo = ({
  title,
  subtitle,
  bodyText,
  audioSrc,
  captions,
  theme = "historical",
  captionStyle = "typewriter",
  progressStyle = "gradient",
  ...layoutProps
}: NarratedVideoProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames - 1);
  const timeMs = (frame / fps) * 1000;
  const lines = splitText(bodyText);
  const caption = activeCaptionAt(captions, timeMs);
  const captionLayout = resolveCaptionLayout(layoutProps);
  const progressLayout = resolveProgressLayout(layoutProps);
  const headlineIn = interpolate(frame, [0, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mapScale = interpolate(progress, [0, 1], [1.13, 1.02]);
  const mapX = interpolate(progress, [0, 1], [-52, 28]);

  const isHistorical = theme === "historical";

  return (
    <AbsoluteFill
      style={{
        background: isHistorical ? "#090b0d" : "#f5f2eb",
        color: isHistorical ? "#f8fafc" : "#171717",
        fontFamily: "Inter, Microsoft YaHei, Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}

      <AbsoluteFill
        style={{
          transform: `translateX(${mapX}px) scale(${mapScale})`,
          opacity: isHistorical ? 0.55 : 0.35,
        }}
      >
        <Img
          src={staticFile("maps/natural-earth-world-4096.jpg")}
          style={{
            position: "absolute",
            inset: -80,
            width: "calc(100% + 160px)",
            height: "calc(100% + 160px)",
            objectFit: "cover",
            filter: isHistorical
              ? "saturate(0.65) contrast(1.1) brightness(0.58)"
              : "saturate(0.7) contrast(0.95) brightness(1.04)",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background: isHistorical
            ? "linear-gradient(90deg, rgba(3,7,18,0.96) 0%, rgba(3,7,18,0.72) 42%, rgba(3,7,18,0.24) 100%)"
            : "linear-gradient(90deg, rgba(245,242,235,0.97) 0%, rgba(245,242,235,0.8) 46%, rgba(245,242,235,0.3) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 62,
          top: 54,
          width: 760,
          opacity: headlineIn,
          transform: `translateY(${interpolate(headlineIn, [0, 1], [24, 0])}px)`,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: isHistorical ? "#facc15" : "#8a5a20",
            marginBottom: 16,
          }}
        >
          文本生成旁白视频
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 62,
            lineHeight: 1.05,
            letterSpacing: 0,
            fontWeight: 950,
          }}
        >
          {title || "一键文本生成视频和语音"}
        </h1>
        {subtitle ? (
          <div
            style={{
              marginTop: 18,
              fontSize: 26,
              lineHeight: 1.35,
              color: isHistorical ? "#bfdbfe" : "#5f5547",
              fontWeight: 750,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          left: 64,
          top: 318,
          width: 700,
          display: "grid",
          gap: 14,
        }}
      >
        {lines.map((line, index) => {
          const from = 42 + index * 14;
          const opacity = interpolate(frame, [from, from + 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <Sequence key={`${line}-${index}`} from={from}>
              <div
                style={{
                  opacity,
                  transform: `translateY(${interpolate(opacity, [0, 1], [18, 0])}px)`,
                  fontSize: 24,
                  lineHeight: 1.55,
                  color: isHistorical ? "rgba(248,250,252,0.86)" : "rgba(23,23,23,0.78)",
                  textShadow: isHistorical ? "0 0 20px rgba(0,0,0,0.82)" : "none",
                }}
              >
                {line}
              </div>
            </Sequence>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 58,
          display: "grid",
          gap: 16,
        }}
      >
        {!caption ? (
          <div
            style={{
              minHeight: 76,
              padding: "18px 22px",
              borderRadius: 12,
              background: isHistorical ? "rgba(4,8,16,0.74)" : "rgba(255,255,255,0.72)",
              border: isHistorical ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(0,0,0,0.1)",
              fontSize: 28,
              lineHeight: 1.35,
              fontWeight: 800,
              color: isHistorical ? "#ffffff" : "#171717",
              textShadow: isHistorical ? "0 0 18px rgba(0,0,0,0.72)" : "none",
            }}
          >
            {lines[Math.min(lines.length - 1, Math.floor(progress * lines.length))] || ""}
          </div>
        ) : null}
      </div>

      <VideoInfrastructure
        captions={captions}
        captionStyle={captionStyle}
        progressStyle={progressStyle}
        captionLayout={captionLayout}
        progressLayout={progressLayout}
      />
    </AbsoluteFill>
  );
};
