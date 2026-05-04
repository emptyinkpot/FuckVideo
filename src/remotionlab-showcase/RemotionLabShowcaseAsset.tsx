import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from "remotion";
import {
  DEFAULT_REMOTIONLAB_SHOWCASE_ASSET_ID,
  getRemotionLabShowcaseAsset,
  type RemotionLabShowcaseAssetId,
} from "./catalog";

export type RemotionLabShowcaseAssetProps = {
  assetId?: RemotionLabShowcaseAssetId;
  showMetadata?: boolean;
  fit?: "cover" | "contain";
  darken?: number;
};

export const RemotionLabShowcaseAsset = ({
  assetId = DEFAULT_REMOTIONLAB_SHOWCASE_ASSET_ID,
  showMetadata = true,
  fit = "contain",
  darken = 0.18,
}: RemotionLabShowcaseAssetProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const asset = getRemotionLabShowcaseAsset(assetId);
  const progress = durationInFrames > 0 ? frame / durationInFrames : 0;
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 18], [18, 0], {
    extrapolateRight: "clamp",
  });
  const scanX = interpolate(progress, [0, 1], [-28, 128]);

  return (
    <AbsoluteFill
      style={{
        background: "#090b10",
        color: "white",
        overflow: "hidden",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <AbsoluteFill>
        {asset.previewUrl || asset.previewPath ? (
          <Video
            src={asset.previewUrl || staticFile(asset.previewPath)}
            muted
            style={{
              width: "100%",
              height: "100%",
              // eslint-disable-next-line @remotion/no-object-fit-on-media-video
              objectFit: fit,
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
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(0,0,0,${darken})` }} />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(5,8,13,0.82), rgba(5,8,13,0.16) 42%, rgba(5,8,13,0.72)), linear-gradient(0deg, rgba(5,8,13,0.72), transparent 44%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(105deg, transparent ${scanX - 12}%, rgba(125, 166, 255, 0.12) ${scanX}%, transparent ${scanX + 12}%)`,
          mixBlendMode: "screen",
        }}
      />
      {showMetadata ? (
        <div
          style={{
            position: "absolute",
            left: 56,
            right: 56,
            bottom: 48,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 28,
            alignItems: "end",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                marginBottom: 14,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                color: "rgba(255,255,255,0.78)",
                fontSize: 20,
              }}
            >
              <span>{asset.category}</span>
              <span>RemotionLab</span>
              <span>{asset.durationSec.toFixed(2)}s</span>
            </div>
            <div style={{ fontSize: 54, fontWeight: 900, lineHeight: 1.05, letterSpacing: 0 }}>
              {asset.title}
            </div>
            <div
              style={{
                marginTop: 14,
                maxWidth: 980,
                color: "rgba(255,255,255,0.78)",
                fontSize: 22,
                lineHeight: 1.42,
              }}
            >
              {asset.description}
            </div>
          </div>
          <div
            style={{
              maxWidth: 320,
              padding: "16px 18px",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(5,8,13,0.62)",
              backdropFilter: "blur(8px)",
              fontSize: 18,
              lineHeight: 1.42,
              color: "rgba(255,255,255,0.74)",
            }}
          >
            <div style={{ color: "white", fontWeight: 800 }}>{asset.slug}</div>
            <div style={{ marginTop: 8 }}>{asset.fileName}</div>
            <div style={{ marginTop: 8 }}>{asset.tags.slice(0, 4).join(" / ")}</div>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
