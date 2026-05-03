import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type PromptTextRotationProps = {
  words?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
};

export const PromptTextRotation = ({
  words = "提示词,动画,图形,模板",
  backgroundColor = "#111827",
  textColor = "#f8fafc",
  fontSize = 116,
}: PromptTextRotationProps) => {
  const frame = useCurrentFrame();
  const wordList = words.split(",").map((word) => word.trim()).filter(Boolean);
  const wordDuration = 50;
  const index = Math.floor(frame / wordDuration) % wordList.length;
  const local = frame % wordDuration;
  const opacity = interpolate(local, [0, 12, 38, 50], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blur = interpolate(local, [0, 12, 38, 50], [12, 0, 0, 12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          color: textColor,
          fontSize,
          fontWeight: 900,
          letterSpacing: 0,
          opacity,
          filter: `blur(${blur}px)`,
        }}
      >
        {wordList[index]}
      </div>
    </AbsoluteFill>
  );
};

export type PromptProgressBarProps = {
  label?: string;
  backgroundColor?: string;
  barColorA?: string;
  barColorB?: string;
};

export const PromptProgressBar = ({
  label = "生成动画中",
  backgroundColor = "#0f172a",
  barColorA = "#34d399",
  barColorB = "#38bdf8",
}: PromptProgressBarProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames * 0.82], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ width: 760 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "white",
            fontSize: 34,
            fontWeight: 800,
            marginBottom: 22,
          }}
        >
          <span>{label}</span>
          <span style={{ color: barColorA }}>{Math.round(progress)}%</span>
        </div>
        <div
          style={{
            height: 30,
            borderRadius: 18,
            background: "#263247",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              borderRadius: 18,
              background: `linear-gradient(90deg, ${barColorA}, ${barColorB})`,
              boxShadow: `0 0 32px ${barColorA}88`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export type PromptHistogramProps = {
  title?: string;
  backgroundColor?: string;
  firstLabel?: string;
  secondLabel?: string;
  thirdLabel?: string;
  fourthLabel?: string;
  fifthLabel?: string;
};

export const PromptHistogram = ({
  title = "能力覆盖",
  backgroundColor = "#050505",
  firstLabel = "文本",
  secondLabel = "图表",
  thirdLabel = "三维",
  fourthLabel = "社媒",
  fifthLabel = "界面",
}: PromptHistogramProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = [
    { label: firstLabel, value: 68, color: "#6366f1" },
    { label: secondLabel, value: 86, color: "#8b5cf6" },
    { label: thirdLabel, value: 52, color: "#06b6d4" },
    { label: fourthLabel, value: 92, color: "#ec4899" },
    { label: fifthLabel, value: 78, color: "#f59e0b" },
  ];
  const max = Math.max(...data.map((item) => item.value));

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        padding: 70,
        justifyContent: "flex-end",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ color: "white", fontSize: 46, fontWeight: 900, marginBottom: 46 }}>
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 30, height: 420 }}>
        {data.map((item, index) => {
          const grow = spring({
            frame: frame - index * 7,
            fps,
            config: { damping: 16, stiffness: 110 },
          });
          const height = (item.value / max) * 360 * grow;

          return (
            <div key={item.label} style={{ width: 150, textAlign: "center" }}>
              <div
                style={{
                  height,
                  borderRadius: "16px 16px 4px 4px",
                  background: item.color,
                  boxShadow: `0 0 26px ${item.color}77`,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  paddingTop: 18,
                  color: "white",
                  fontSize: 24,
                  fontWeight: 900,
                }}
              >
                {item.value}
              </div>
              <div style={{ color: "#cbd5e1", marginTop: 18, fontSize: 22 }}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export type PromptAnimatedShapesProps = {
  backgroundColor?: string;
  gap?: number;
  size?: number;
  spinSpeed?: number;
};

export const PromptAnimatedShapes = ({
  backgroundColor = "#0b0b0f",
  gap = 78,
  size = 128,
  spinSpeed = 0.8,
}: PromptAnimatedShapesProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shapes = [
    { label: "●", color: "#6366f1", delay: 0 },
    { label: "▲", color: "#10b981", delay: 14 },
    { label: "■", color: "#f59e0b", delay: 28 },
    { label: "✦", color: "#ec4899", delay: 42 },
  ];

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ display: "flex", gap, alignItems: "center" }}>
        {shapes.map((shape, index) => {
          const entrance = spring({
            frame: frame - shape.delay,
            fps,
            config: { damping: 12, stiffness: 190 },
          });
          const bounce = Math.sin((frame - shape.delay) * 0.12) * 12;

          return (
            <div
              key={shape.label}
              style={{
                color: shape.color,
                fontSize: size,
                lineHeight: 1,
                textShadow: `0 0 32px ${shape.color}`,
                opacity: entrance,
                transform: `translateY(${bounce}px) rotate(${frame * (index + 1) * spinSpeed}deg) scale(${entrance})`,
              }}
            >
              {shape.label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
