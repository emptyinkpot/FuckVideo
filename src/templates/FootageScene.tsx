import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from "remotion";
import { isLikelyMediaFile, normalizeStaticMediaPath } from "./mediaSource";

export type FootageSceneProps = {
  src?: string;
  title?: string;
  subtitle?: string;
  fit?: "cover" | "contain";
  darken?: number;
  zoom?: number;
  showTitle?: boolean;
};

export const FootageScene = ({
  src = "",
  title = "素材镜头",
  subtitle = "本地素材库片段",
  fit = "cover",
  darken = 0.26,
  zoom = 1.06,
  showTitle = true,
}: FootageSceneProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = durationInFrames > 0 ? frame / durationInFrames : 0;
  const scale = interpolate(progress, [0, 1], [1, zoom]);
  const titleOpacity = interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 22], [18, 0], { extrapolateRight: "clamp" });
  const safeSrc = normalizeStaticMediaPath(src);
  const canRenderVideo = safeSrc && isLikelyMediaFile(safeSrc);

  return (
    <AbsoluteFill style={{ background: "#070707", overflow: "hidden" }}>
      {canRenderVideo ? (
        <Video
          src={staticFile(safeSrc)}
          muted
          style={{
            width: "100%",
            height: "100%",
            // eslint-disable-next-line @remotion/no-object-fit-on-media-video
            objectFit: fit,
            transform: `scale(${scale})`,
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(135deg, #111827 0%, #27272a 48%, #111111 100%)",
          }}
        />
      )}
      <AbsoluteFill style={{ background: `rgba(0,0,0,${darken})` }} />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.62), transparent 58%), linear-gradient(0deg, rgba(0,0,0,0.42), transparent 46%)",
        }}
      />
      {showTitle && (title || subtitle) ? (
        <div
          style={{
            position: "absolute",
            left: 82,
            bottom: 78,
            maxWidth: 1040,
            color: "white",
            fontFamily: "Inter, Arial, sans-serif",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {subtitle ? (
            <div style={{ marginBottom: 12, fontSize: 24, lineHeight: 1.35, color: "rgba(255,255,255,0.72)" }}>
              {subtitle}
            </div>
          ) : null}
          {title ? (
            <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.08, letterSpacing: 0 }}>
              {title}
            </div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
