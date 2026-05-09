import {interpolate, useVideoConfig} from "remotion";
import type {NarratedCaption} from "../templates/NarratedVideo";
import type {CaptionLayout, CaptionStyle} from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const activeCaptionAt = (
  captions: NarratedCaption[] | undefined,
  timeMs: number,
) => {
  if (!captions?.length) {
    return null;
  }
  return (
    captions.find((caption) => timeMs >= caption.startMs && timeMs <= caption.endMs) ||
    captions.find((caption) => timeMs < caption.endMs) ||
    captions[captions.length - 1]
  );
};

export const CaptionOverlay = ({
  caption,
  frame,
  timeMs,
  style = "typewriter",
  layout,
}: {
  caption: NarratedCaption | null;
  frame: number;
  timeMs: number;
  style?: CaptionStyle;
  layout?: CaptionLayout;
}) => {
  if (style === "none" || !caption?.text) {
    return null;
  }
  if (style === "classic") {
    return <ClassicCaptionOverlay caption={caption} frame={frame} layout={layout} />;
  }
  return <TypewriterCaptionOverlay caption={caption} frame={frame} timeMs={timeMs} layout={layout} />;
};

export const TypewriterCaptionOverlay = ({
  caption,
  frame,
  timeMs,
  layout,
}: {
  caption: NarratedCaption | null;
  frame: number;
  timeMs: number;
  layout?: CaptionLayout;
}) => {
  const {fps} = useVideoConfig();
  if (!caption?.text) {
    return null;
  }

  const text = caption.text;
  const chars = Array.from(text);
  const localFrame = Math.max(0, ((timeMs - caption.startMs) / 1000) * fps);
  const durationFrames = Math.max(1, ((caption.endMs - caption.startMs) / 1000) * fps);
  const typeFrames = clamp(chars.length * 2, 8, Math.max(8, durationFrames * 0.78));
  const visibleCount = clamp(
    Math.floor(interpolate(localFrame, [0, typeFrames], [0, chars.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })),
    0,
    chars.length,
  );
  const cursorOn = visibleCount < chars.length || Math.floor(frame / 12) % 2 === 0;
  const opacity = captionOpacity(localFrame, durationFrames);

  return (
    <CaptionShell opacity={opacity} layout={layout} textLength={chars.length}>
      {chars.slice(0, visibleCount).join("")}
      <span
        style={{
          color: "#ffcf8a",
          opacity: cursorOn ? 1 : 0,
          marginLeft: 2,
        }}
      >
        ▋
      </span>
    </CaptionShell>
  );
};

const ClassicCaptionOverlay = ({
  caption,
  frame,
  layout,
}: {
  caption: NarratedCaption;
  frame: number;
  layout?: CaptionLayout;
}) => {
  const opacity = interpolate(frame % 12, [0, 6], [0.92, 1]);
  return (
    <CaptionShell opacity={opacity} layout={layout} textLength={Array.from(caption.text).length}>
      {caption.text}
    </CaptionShell>
  );
};

const CaptionShell = ({
  children,
  opacity,
  layout,
  textLength,
}: {
  children: React.ReactNode;
  opacity: number;
  layout?: CaptionLayout;
  textLength: number;
}) => {
  const box = normalizeCaptionLayout(layout);
  const hasPlate = hasVisiblePlate(box.backgroundColor);
  const {width} = useVideoConfig();
  const availableWidth = Math.max(240, width - box.left - box.right - box.paddingX * 2);
  const singleLineFontSize = fitSingleLineFontSize(box.fontSize, textLength, availableWidth);
  return (
    <div
      style={{
        position: "absolute",
        left: box.left,
        right: box.right,
        bottom: box.bottom,
        minHeight: box.minHeight,
        padding: `${box.paddingY}px ${box.paddingX}px`,
        borderRadius: box.borderRadius,
        background: box.backgroundColor,
        border: hasPlate ? "1px solid rgba(255,255,255,0.16)" : "none",
        boxShadow: hasPlate ? "0 18px 52px rgba(0,0,0,0.36)" : "none",
        color: box.textColor,
        fontFamily: "Inter, Microsoft YaHei, Arial, sans-serif",
        fontSize: singleLineFontSize,
        lineHeight: box.lineHeight,
        fontWeight: box.fontWeight,
        textAlign: "center",
        textShadow: "0 2px 14px rgba(0,0,0,0.82)",
        opacity,
        transform: `translateY(${interpolate(opacity, [0, 1], [10, 0])}px)`,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "clip",
      }}
    >
      {children}
    </div>
  );
};

function normalizeCaptionLayout(layout?: CaptionLayout): Required<CaptionLayout> {
  return {
    left: finite(layout?.left, 78),
    right: finite(layout?.right, 78),
    bottom: finite(layout?.bottom, 34),
    minHeight: finite(layout?.minHeight, 0),
    paddingX: finite(layout?.paddingX, 24),
    paddingY: finite(layout?.paddingY, 4),
    fontSize: finite(layout?.fontSize, 30),
    borderRadius: finite(layout?.borderRadius, 0),
    textColor: stringValue(layout?.textColor, "#f8fafc"),
    backgroundColor: stringValue(layout?.backgroundColor, "transparent"),
    fontWeight: finite(layout?.fontWeight, 850),
    lineHeight: finite(layout?.lineHeight, 1.22),
  };
}

function hasVisiblePlate(value: string) {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  if (!normalized || normalized === "transparent") return false;
  return !normalized.startsWith("rgba(") || !normalized.endsWith(",0)");
}

function finite(value: unknown, fallback: number) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function fitSingleLineFontSize(fontSize: number, textLength: number, availableWidth: number) {
  const safeLength = Math.max(1, Number(textLength || 1) + 1);
  const estimatedCharWidth = 0.96;
  const fitted = Math.floor(availableWidth / (safeLength * estimatedCharWidth));
  return clamp(Math.min(fontSize, fitted), 18, fontSize);
}

const captionOpacity = (localFrame: number, durationFrames: number) => {
  const enter = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(durationFrames - localFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(enter, exit);
};
