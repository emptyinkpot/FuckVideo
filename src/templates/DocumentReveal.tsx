import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type DocumentRevealProps = {
  title?: string;
  subtitle?: string;
  body?: string;
  sealText?: string;
  highlightWords?: string[];
  tone?: "aged" | "historical" | "dramatic" | "dark" | "clean";
};

const splitHighlightedText = (body: string, highlightWords: string[]) => {
  const words = highlightWords.map((word) => word.trim()).filter(Boolean);
  if (words.length === 0) {
    return [{ text: body, highlighted: false }];
  }

  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");

  return body.split(pattern).filter(Boolean).map((part) => ({
    text: part,
    highlighted: words.includes(part),
  }));
};

export const DocumentReveal = ({
  title = "历史文件",
  subtitle = "ARCHIVE DOCUMENT",
  body = "条约上用词谨慎，纸面文字背后是更复杂的权力转移。",
  sealText = "ARCHIVE",
  highlightWords = [],
  tone = "aged",
}: DocumentRevealProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const seal = spring({ frame: frame - 45, fps, config: { damping: 10, stiffness: 160 } });
  const paperY = interpolate(enter, [0, 1], [70, 0]);
  const paperRotate = interpolate(enter, [0, 1], [-2.4, 0]);
  const lineReveal = interpolate(frame, [16, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const agedTone = tone === "aged" || tone === "historical" || tone === "dramatic";
  const paperColor = agedTone ? "#ead8ab" : "#fafafa";
  const inkColor = agedTone ? "#2d2115" : "#171717";
  const backgroundColor = agedTone ? "#17120d" : "#111827";
  const textParts = splitHighlightedText(body, highlightWords);

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        overflow: "hidden",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 35%, rgba(255,210,120,0.18), transparent 36%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.08), transparent 30%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 70,
          width: 940,
          height: 580,
          transform: `translateY(${paperY}px) rotate(${paperRotate}deg)`,
          background: paperColor,
          boxShadow: "0 38px 100px rgba(0,0,0,0.42)",
          borderRadius: 8,
          padding: "54px 68px",
          color: inkColor,
          opacity: interpolate(frame, [0, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div style={{ fontSize: 21, letterSpacing: 5, opacity: 0.58 }}>{subtitle}</div>
        <div style={{ marginTop: 22, fontSize: 50, fontWeight: 800, lineHeight: 1.08 }}>
          {title}
        </div>
        <div
          style={{
            marginTop: 24,
            height: 2,
            width: `${lineReveal * 100}%`,
            background: inkColor,
            opacity: 0.35,
          }}
        />
        <div style={{ marginTop: 34, fontSize: 29, lineHeight: 1.72, letterSpacing: 1 }}>
          {textParts.map((part, index) => (
            <span
              key={`${part.text}-${index}`}
              style={
                part.highlighted
                  ? {
                      background: "rgba(150, 30, 20, 0.14)",
                      borderBottom: "3px solid rgba(120, 20, 20, 0.5)",
                      padding: "0 3px",
                    }
                  : undefined
              }
            >
              {part.text}
            </span>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            right: 74,
            bottom: 58,
            width: 152,
            height: 152,
            borderRadius: "50%",
            border: "9px solid rgba(130,20,20,0.72)",
            color: "rgba(130,20,20,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 23,
            fontWeight: 900,
            letterSpacing: 3,
            transform: `scale(${seal}) rotate(-13deg)`,
            opacity: seal,
          }}
        >
          {sealText}
        </div>
      </div>
    </AbsoluteFill>
  );
};
