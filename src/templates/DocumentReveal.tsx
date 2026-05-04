import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type DocumentRevealProps = {
  title?: string;
  subtitle?: string;
  body?: string;
  highlightText?: string;
  highlightWords?: string[];
  style?: "old_paper" | "book" | "modern";
  highlightMode?: "underline" | "box" | "marker";
  maxSnippetChars?: number;
  sealText?: string;
  tone?: "aged" | "historical" | "dramatic" | "dark" | "clean";
};

export const extractDocumentSnippet = (
  body: string,
  highlightText?: string,
  maxChars = 120,
) => {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  const target = String(highlightText || "").trim();

  if (!target || !text.includes(target)) {
    return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
  }

  const index = text.indexOf(target);
  const side = Math.max(20, Math.floor((maxChars - target.length) / 2));
  const start = Math.max(0, index - side);
  const end = Math.min(text.length, index + target.length + side);

  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${
    end < text.length ? "..." : ""
  }`;
};

const themeMap = {
  old_paper: {
    bg: "#17120b",
    paper: "#e7d7b5",
    ink: "#2c2115",
    muted: "rgba(44,33,21,0.55)",
    line: "rgba(120,36,22,0.78)",
    marker: "rgba(201,150,42,0.38)",
    shadow: "rgba(0,0,0,0.42)",
    font: "'Noto Serif SC', 'LXGW WenKai', Georgia, 'Times New Roman', serif",
    radius: 8,
  },
  book: {
    bg: "#efede6",
    paper: "#fbf7eb",
    ink: "#191919",
    muted: "rgba(25,25,25,0.5)",
    line: "rgba(30,80,150,0.72)",
    marker: "rgba(245,202,80,0.5)",
    shadow: "rgba(0,0,0,0.18)",
    font: "'Noto Serif SC', 'LXGW WenKai', Georgia, 'Times New Roman', serif",
    radius: 8,
  },
  modern: {
    bg: "#0f1115",
    paper: "#171a22",
    ink: "#f5f5f5",
    muted: "rgba(245,245,245,0.52)",
    line: "#4f8cff",
    marker: "rgba(79,140,255,0.25)",
    shadow: "rgba(0,0,0,0.5)",
    font: "Inter, Arial, sans-serif",
    radius: 16,
  },
};

const toneToStyle = (
  tone?: DocumentRevealProps["tone"],
): NonNullable<DocumentRevealProps["style"]> => {
  if (tone === "dark" || tone === "clean") return "modern";
  return "old_paper";
};

export const DocumentReveal = ({
  title = "历史文件",
  subtitle = "历史文件",
  body = "条约上用词谨慎，所谓“转让”遮住了更复杂的权力关系。",
  highlightText,
  highlightWords = [],
  style,
  highlightMode = "underline",
  maxSnippetChars = 120,
  sealText = "ARCHIVE",
  tone,
}: DocumentRevealProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const resolvedStyle = style || toneToStyle(tone);
  const theme = themeMap[resolvedStyle];
  const mainHighlight = highlightText || highlightWords[0] || "";
  const snippet = extractDocumentSnippet(body, mainHighlight, maxSnippetChars);

  const enter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const paperOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const paperY = interpolate(enter, [0, 1], [54, 0]);
  const paperRotate = interpolate(enter, [0, 1], [-2.2, 0]);
  const cameraScale = interpolate(frame, [90, 175], [1, 1.13], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const headerLine = interpolate(frame, [25, 55], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const highlightProgress = interpolate(frame, [75, 125], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sealScale = spring({
    frame: frame - 92,
    fps,
    config: { damping: 10, stiffness: 150 },
  });
  const paperDriftX = Math.sin(frame / 17) * 1.4 + Math.sin(frame / 41) * 0.8;
  const paperDriftY = Math.cos(frame / 23) * 1.1;
  const paperDriftRotate = Math.sin(frame / 37) * 0.18;
  const lightSweep = interpolate(frame, [28, 135], [-42, 132], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  return (
    <AbsoluteFill
      style={{
        background: theme.bg,
        overflow: "hidden",
        fontFamily: theme.font,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            resolvedStyle === "old_paper"
              ? "radial-gradient(circle at 50% 35%, rgba(255,210,120,0.16), transparent 36%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.06), transparent 30%)"
              : "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), transparent 34%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: resolvedStyle === "old_paper" ? 0.12 : 0.05,
          backgroundImage:
            "linear-gradient(0deg, rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 48%, transparent 44%, rgba(0,0,0,0.32) 100%)",
          mixBlendMode: "multiply",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "8.5%",
          top: "9.5%",
          width: "83%",
          height: "80%",
          padding: "44px 58px",
          borderRadius: theme.radius,
          background: theme.paper,
          color: theme.ink,
          boxShadow: `0 34px 90px ${theme.shadow}`,
          opacity: paperOpacity,
          transform: `translate(${paperDriftX}px, ${paperY + paperDriftY}px) rotate(${
            paperRotate + paperDriftRotate
          }deg) scale(${cameraScale})`,
          transformOrigin: "52% 48%",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: theme.radius,
            opacity: resolvedStyle === "modern" ? 0.1 : 0.18,
            background:
              "radial-gradient(circle at 18% 18%, rgba(255,255,255,0.42), transparent 22%), radial-gradient(circle at 78% 70%, rgba(93,56,22,0.12), transparent 24%), linear-gradient(135deg, rgba(255,255,255,0.18), transparent 44%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: theme.radius,
            opacity: resolvedStyle === "old_paper" ? 0.16 : 0.08,
            backgroundImage:
              "linear-gradient(14deg, rgba(72,42,16,.15) 0 1px, transparent 1px 18px), linear-gradient(92deg, rgba(255,255,255,.18) 0 1px, transparent 1px 23px)",
            backgroundSize: "29px 31px",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "-16%",
            bottom: "-16%",
            left: `${lightSweep}%`,
            width: "22%",
            transform: "rotate(12deg)",
            opacity: resolvedStyle === "modern" ? 0.16 : 0.24,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
            filter: "blur(10px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            fontSize: 17,
            letterSpacing: 4,
            color: theme.muted,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 42,
            lineHeight: 1.08,
            fontWeight: 900,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 22,
            width: `${headerLine}%`,
            height: 2,
            background: theme.ink,
            opacity: 0.32,
          }}
        />

        <div
          style={{
            position: "relative",
            marginTop: 32,
            maxWidth: "82%",
            fontSize: 28,
            lineHeight: 1.72,
            letterSpacing: resolvedStyle === "modern" ? 0 : 1,
          }}
        >
          <HighlightedText
            text={snippet}
            highlightText={mainHighlight}
            highlightWords={highlightWords}
            mode={highlightMode}
            color={theme.line}
            marker={theme.marker}
            progress={highlightProgress}
          />
        </div>

        {resolvedStyle === "old_paper" ? (
          <div
            style={{
              position: "absolute",
              right: 56,
              bottom: 46,
              width: 140,
              height: 140,
              borderRadius: "50%",
              border: "8px solid rgba(130,20,20,0.68)",
              color: "rgba(130,20,20,0.68)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 21,
              fontWeight: 900,
              letterSpacing: 3,
              transform: `scale(${sealScale}) rotate(-13deg)`,
              opacity: sealScale,
            }}
          >
            {sealText}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

function HighlightedText({
  text,
  highlightText,
  highlightWords,
  mode,
  color,
  marker,
  progress,
}: {
  text: string;
  highlightText?: string;
  highlightWords: string[];
  mode: "underline" | "box" | "marker";
  color: string;
  marker: string;
  progress: number;
}) {
  const targets = [highlightText, ...highlightWords]
    .filter(Boolean)
    .map(String)
    .filter((item, index, all) => all.indexOf(item) === index)
    .sort((a, b) => b.length - a.length);

  if (!targets.length) return <span>{text}</span>;

  const regex = new RegExp(`(${targets.map(escapeRegExp).join("|")})`, "g");

  return (
    <>
      {text.split(regex).map((part, index) => {
        const isHit = targets.includes(part);

        if (!isHit) return <span key={`${part}-${index}`}>{part}</span>;

        return (
          <span
            key={`${part}-${index}`}
            style={{
              position: "relative",
              display: "inline-block",
              zIndex: 1,
              padding: mode === "box" ? "0 6px" : mode === "marker" ? "0 4px" : "0 2px",
              background:
                mode === "marker"
                  ? `linear-gradient(90deg, ${marker} ${progress * 100}%, transparent ${progress * 100}%)`
                  : "transparent",
              border: "none",
              borderRadius: mode === "box" ? 8 : 0,
            }}
          >
            {part}
            {mode === "underline" ? (
              <svg
                viewBox="0 0 100 12"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 1,
                  height: 8,
                  width: `${progress * 100}%`,
                  opacity: 0.82,
                  overflow: "hidden",
                  zIndex: -1,
                }}
              >
                <path
                  d="M1 7 C13 5 24 8 36 6 S62 5 74 7 91 8 99 5"
                  fill="none"
                  stroke={color}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d="M0 9 C18 8 31 10 48 8 S78 7 100 9"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.38"
                />
              </svg>
            ) : null}
            {mode === "box" ? (
              <svg
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: -4,
                  width: `calc(${progress * 100}% + 8px)`,
                  height: "calc(100% + 8px)",
                  opacity: 0.86,
                  overflow: "hidden",
                  pointerEvents: "none",
                }}
              >
                <path
                  d="M5 5 C20 2 42 4 95 5 M95 5 C99 15 98 28 94 35 M94 35 C66 39 31 37 5 35 M5 35 C2 24 3 13 5 5"
                  fill="none"
                  stroke={color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </span>
        );
      })}
    </>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
