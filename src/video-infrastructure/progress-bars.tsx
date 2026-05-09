import {useVideoConfig} from "remotion";
import type {ProgressLayout, ProgressSegment, ProgressStyle} from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const VideoProgressBar = ({
  frame,
  style = "gradient",
  bottom = 0,
  segments = [],
  layout,
}: {
  frame: number;
  style?: ProgressStyle;
  bottom?: number;
  segments?: ProgressSegment[];
  layout?: ProgressLayout;
}) => {
  const {fps, durationInFrames} = useVideoConfig();
  if (style === "none") {
    return null;
  }

  const progress = clamp(frame / Math.max(1, durationInFrames - 1), 0, 1);
  const isThin = style === "thin";
  const box = normalizeProgressLayout(layout, isThin, bottom);
  const currentMs = (frame / fps) * 1000;
  const visibleSegments = segments
    .filter((segment) => segment.title && Number(segment.endMs) > Number(segment.startMs))
    .sort((a, b) => Number(a.startMs || 0) - Number(b.startMs || 0));

  if (visibleSegments.length > 0) {
    const showLabels = !isThin && visibleSegments.length <= 8;
    return (
      <div
        style={{
          position: "absolute",
          left: box.left,
          right: box.right,
          bottom: box.bottom,
          height: box.height,
          display: "flex",
          gap: box.gap,
          padding: isThin ? 0 : `0 ${box.paddingX}px`,
          background: "rgba(255,255,255,0.13)",
          overflow: "hidden",
          fontFamily: "Inter, Microsoft YaHei, Arial, sans-serif",
        }}
      >
        {visibleSegments.map((segment, index) => {
          const startMs = Number(segment.startMs || 0);
          const endMs = Number(segment.endMs || startMs + 1);
          const segmentDuration = Math.max(1, endMs - startMs);
          const segmentProgress =
            currentMs <= startMs ? 0 : currentMs >= endMs ? 1 : (currentMs - startMs) / Math.max(1, endMs - startMs);
          const color = segment.color || fallbackColor(index);

          return (
            <div
                key={segment.id || `${segment.title}-${index}`}
                style={{
                flexBasis: 0,
                flexGrow: segmentDuration,
                flexShrink: 1,
                minWidth: box.minSegmentWidth,
                position: "relative",
                overflow: "hidden",
                background: "rgba(8,10,14,0.58)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${segmentProgress * 100}%`,
                  background: isThin
                    ? color
                    : `linear-gradient(90deg, ${color}, rgba(255,255,255,0.86))`,
                  boxShadow: isThin ? "none" : `0 0 16px ${color}88`,
                }}
              />
              {showLabels ? (
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 10px",
                    color: "#f8fafc",
                    fontSize: box.labelFontSize,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textShadow: "0 1px 10px rgba(0,0,0,0.85)",
                  }}
                >
                  {segment.title}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: box.left,
        right: box.right,
        bottom: box.bottom,
        height: box.height,
        background: "rgba(255,255,255,0.16)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: "100%",
          background: isThin
            ? "#f4d35e"
            : "linear-gradient(90deg, #ffcf8a, #f4d35e 48%, #4f8cff)",
          boxShadow: isThin ? "none" : "0 0 18px rgba(244,211,94,0.72)",
        }}
      />
    </div>
  );
};

function fallbackColor(index: number) {
  return ["#f4d35e", "#4f8cff", "#7dd3fc", "#fca5a5", "#c4b5fd", "#86efac"][index % 6];
}

function normalizeProgressLayout(
  layout: ProgressLayout | undefined,
  isThin: boolean,
  fallbackBottom: number,
): Required<ProgressLayout> {
  return {
    left: finite(layout?.left, 0),
    right: finite(layout?.right, 0),
    bottom: finite(layout?.bottom, fallbackBottom),
    height: finite(layout?.height, isThin ? 7 : 30),
    gap: finite(layout?.gap, isThin ? 2 : 4),
    paddingX: finite(layout?.paddingX, 0),
    labelFontSize: finite(layout?.labelFontSize, 14),
    minSegmentWidth: finite(layout?.minSegmentWidth, isThin ? 8 : 36),
  };
}

function finite(value: unknown, fallback: number) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
