import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export type ClaudeTyperTemplateProps = {
  prompt?: string;
  backgroundColor?: string;
  panelColor?: string;
  textColor?: string;
};

export const ClaudeTyperTemplate = ({
  prompt = "生成一套可复用的 Remotion 动画模板系统。",
  backgroundColor = "#15130f",
  panelColor = "#211f1a",
  textColor = "#c9c2b2",
}: ClaudeTyperTemplateProps) => {
  const frame = useCurrentFrame();
  const visible = clamp(Math.floor((frame - 20) / 2), 0, prompt.length);
  const cursorOn = Math.floor(frame / 12) % 2 === 0;
  const panelIn = spring({ frame, fps: 30, config: { damping: 80 } });

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: 920,
          minHeight: 360,
          borderRadius: 18,
          background: panelColor,
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 34px 90px rgba(0,0,0,0.45)",
          padding: 34,
          transform: `translateY(${interpolate(panelIn, [0, 1], [50, 0])}px) scale(${interpolate(panelIn, [0, 1], [0.96, 1])})`,
        }}
      >
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
            <div
              key={color}
              style={{ width: 14, height: 14, borderRadius: "50%", background: color }}
            />
          ))}
        </div>
        <div style={{ color: textColor, fontSize: 28, lineHeight: 1.55 }}>
          <span style={{ color: "#ffcf8a" }}>$</span> {prompt.slice(0, visible)}
          <span style={{ opacity: cursorOn ? 1 : 0, color: "#ffcf8a" }}>▋</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export type SpotlightRevealTemplateProps = {
  title?: string;
  backgroundColor?: string;
  lightColor?: string;
  fontSize?: number;
};

export const SpotlightRevealTemplate = ({
  title = "动画模板库",
  backgroundColor = "#050505",
  lightColor = "255,241,184",
  fontSize = 112,
}: SpotlightRevealTemplateProps) => {
  const frame = useCurrentFrame();
  const swing = Math.sin(frame / 18) * 24;
  const reveal = interpolate(frame, [10, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 640,
          width: 360,
          height: 760,
          transform: `translateX(-50%) rotate(${swing}deg) scaleY(${1 + reveal * 0.08})`,
          transformOrigin: "50% 0%",
          background:
            `linear-gradient(to bottom, rgba(${lightColor},0.72), rgba(${lightColor},0.15) 45%, transparent 78%)`,
          clipPath: "polygon(48% 0, 52% 0, 100% 100%, 0 100%)",
          filter: "blur(1px)",
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          fontSize,
          fontWeight: 900,
          letterSpacing: 0,
          color: "#1c1c1c",
          textShadow: `0 0 ${24 + reveal * 40}px rgba(${lightColor},0.78)`,
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};

export type ProceduralFishTemplateProps = {
  fishCount?: number;
  backgroundTop?: string;
  backgroundBottom?: string;
  primaryColor?: string;
  secondaryColor?: string;
};

export const ProceduralFishTemplate = ({
  fishCount = 16,
  backgroundTop = "#062b45",
  backgroundBottom = "#03121e",
  primaryColor = "#65f5ff",
  secondaryColor = "#ff7fd7",
}: ProceduralFishTemplateProps) => {
  const frame = useCurrentFrame();
  const fishes = Array.from({ length: fishCount }, (_, i) => i);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${backgroundTop} 0%, ${backgroundBottom} 100%)`,
        overflow: "hidden",
      }}
    >
      {fishes.map((fish) => {
        const lane = 70 + (fish % 8) * 76;
        const progress = ((frame * (0.55 + fish * 0.025) + fish * 54) % 1500) / 1500;
        const x = interpolate(progress, [0, 1], [-180, 1460]);
        const y = lane + Math.sin(frame / 17 + fish) * 24;
        const hue = fish % 2 === 0 ? primaryColor : secondaryColor;

        return (
          <div
            key={fish}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 104,
              height: 42,
              transform: `rotate(${Math.sin(frame / 20 + fish) * 8}deg)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "4px 18px 4px 0",
                borderRadius: "60% 45% 45% 60%",
                background: `radial-gradient(circle at 28% 45%, white 0 3px, transparent 4px), linear-gradient(90deg, ${hue}, rgba(255,255,255,0.68))`,
                boxShadow: `0 0 24px ${hue}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 8,
                width: 34,
                height: 28,
                background: hue,
                clipPath: "polygon(0 50%, 100% 0, 76% 50%, 100% 100%)",
                transform: `scaleX(${0.75 + Math.sin(frame / 5 + fish) * 0.2})`,
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export type RulerProgressTemplateProps = {
  title?: string;
  targetProgress?: number;
  backgroundColor?: string;
  fillColorA?: string;
  fillColorB?: string;
};

export const RulerProgressTemplate = ({
  title = "项目进度",
  targetProgress = 0.82,
  backgroundColor = "#f4efe5",
  fillColorA = "#21a87a",
  fillColorB = "#5ee7ac",
}: RulerProgressTemplateProps) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [18, 150], [0, targetProgress], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const width = 920;

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div style={{ width }}>
        <div style={{ fontSize: 54, fontWeight: 900, color: "#25221c", marginBottom: 42 }}>
          {title}
        </div>
        <div
          style={{
            position: "relative",
            height: 130,
            borderRadius: 8,
            background: "#d6b772",
            boxShadow: "inset 0 -10px 0 rgba(0,0,0,0.08), 0 28px 54px rgba(72,55,20,0.24)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${progress * 100}%`,
              background: `linear-gradient(90deg, ${fillColorA}, ${fillColorB})`,
            }}
          />
          {Array.from({ length: 31 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i / 30) * 100}%`,
                top: 0,
                width: 2,
                height: i % 5 === 0 ? 72 : 38,
                background: "#312719",
                opacity: 0.65,
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              left: `calc(${progress * 100}% - 6px)`,
              top: -16,
              width: 12,
              height: 162,
              background: "#101010",
              boxShadow: "0 0 22px rgba(0,0,0,0.4)",
            }}
          />
        </div>
        <div style={{ marginTop: 28, fontSize: 48, fontWeight: 900, color: "#14684f" }}>
          {Math.round(progress * 100)}%
        </div>
      </div>
    </AbsoluteFill>
  );
};

export type SvgAssemblyTemplateProps = {
  title?: string;
  backgroundColor?: string;
  glowColor?: string;
  partColorA?: string;
  partColorB?: string;
};

export const SvgAssemblyTemplate = ({
  title = "SVG 组装动画",
  backgroundColor = "#070914",
  glowColor = "rgba(94,231,255,0.7)",
  partColorA = "#5ee7ff",
  partColorB = "#ff5ec4",
}: SvgAssemblyTemplateProps) => {
  const frame = useCurrentFrame();
  const parts = [
    { x: 460, y: 310, w: 360, h: 120, color: partColorA, delay: 0, r: 0 },
    { x: 560, y: 235, w: 170, h: 96, color: partColorB, delay: 8, r: -7 },
    { x: 382, y: 390, w: 136, h: 54, color: "#ffe45e", delay: 16, r: 14 },
    { x: 762, y: 390, w: 136, h: 54, color: "#ffe45e", delay: 20, r: -14 },
    { x: 610, y: 440, w: 60, h: 120, color: "#ffffff", delay: 26, r: 0 },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle, #162241 0%, ${backgroundColor} 72%)`,
        overflow: "hidden",
      }}
    >
      {parts.map((part, index) => {
        const enter = spring({
          frame: frame - part.delay,
          fps: 30,
          config: { damping: 62, mass: 0.8 },
        });
        const fromX = index % 2 === 0 ? -520 : 1620;
        const fromY = index < 2 ? -260 : 980;
        const x = interpolate(enter, [0, 1], [fromX, part.x]);
        const y = interpolate(enter, [0, 1], [fromY, part.y]);
        const stretch = interpolate(enter, [0, 0.55, 1], [0.08, 1.35, 1]);

        return (
          <div
            key={part.color + part.delay}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: part.w,
              height: part.h,
              borderRadius: part.h / 2,
              background: part.color,
              boxShadow: `0 0 34px ${part.color}`,
              transform: `translate(-50%, -50%) rotate(${part.r + (1 - enter) * 280}deg) scaleX(${stretch}) scaleY(${interpolate(enter, [0, 1], [3.2, 1])})`,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 588,
          textAlign: "center",
          color: "white",
          fontSize: 38,
          fontWeight: 800,
          textShadow: `0 0 24px ${glowColor}`,
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};

export type Wechat2DTemplateProps = {
  contactName?: string;
  leftMessageA?: string;
  rightMessageA?: string;
  leftMessageB?: string;
  rightMessageB?: string;
};

export const Wechat2DTemplate = ({
  contactName = "动画模板",
  leftMessageA = "这个动画能直接做成模板吗？",
  rightMessageA = "可以，已经放进 Remotion 工作台。",
  leftMessageB = "后面还能改文字和节奏？",
  rightMessageB = "可以，参数都在组件里。",
}: Wechat2DTemplateProps) => {
  const frame = useCurrentFrame();
  const messages = [
    { side: "left", text: leftMessageA, delay: 8 },
    { side: "right", text: rightMessageA, delay: 42 },
    { side: "left", text: leftMessageB, delay: 82 },
    { side: "right", text: rightMessageB, delay: 118 },
  ];

  return (
    <AbsoluteFill style={{ background: "#dfe5dd", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 390,
          height: 680,
          borderRadius: 34,
          background: "#ededed",
          overflow: "hidden",
          boxShadow: "0 28px 80px rgba(0,0,0,0.32)",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            height: 72,
            background: "#f7f7f7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            color: "#191919",
          }}
        >
          {contactName}
        </div>
        <div style={{ padding: 22 }}>
          {messages.map((message) => {
            const enter = spring({ frame: frame - message.delay, fps: 30, config: { damping: 70 } });
            const isRight = message.side === "right";

            return (
              <div
                key={message.text}
                style={{
                  display: "flex",
                  justifyContent: isRight ? "flex-end" : "flex-start",
                  opacity: enter,
                  transform: `translateY(${interpolate(enter, [0, 1], [28, 0])}px)`,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    maxWidth: 260,
                    borderRadius: 10,
                    padding: "12px 14px",
                    background: isRight ? "#95ec69" : "#ffffff",
                    color: "#111",
                    fontSize: 18,
                    lineHeight: 1.35,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                  }}
                >
                  {message.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const tickerColumns = [
  ["#66f7ff", "#ff4fd8", "#fff36b", "#61ffa6"],
  ["#ff8d4d", "#8f7cff", "#56d9ff", "#ffe66d"],
  ["#f06292", "#4dd0e1", "#aed581", "#ffca28"],
];

export type ThreeDTickerTemplateProps = {
  backgroundColor?: string;
  perspective?: number;
  columnGap?: number;
};

export const ThreeDTickerTemplate = ({
  backgroundColor = "#050711",
  perspective = 1000,
  columnGap = 34,
}: ThreeDTickerTemplateProps) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: backgroundColor, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: "-120px 0",
          display: "flex",
          justifyContent: "center",
          gap: columnGap,
          transform: `perspective(${perspective}px) rotateX(18deg) rotateZ(-4deg) scale(1.16)`,
        }}
      >
        {tickerColumns.map((column, columnIndex) => {
          const direction = columnIndex % 2 === 0 ? -1 : 1;
          const progress = ((frame + columnIndex * 35) % 180) / 180;
          const y = direction === -1 ? progress * -50 : -50 + progress * 50;

          return (
            <div key={column.join("")} style={{ width: 270, height: "200%" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 26,
                  transform: `translateY(${y}%)`,
                }}
              >
                {[...column, ...column].map((color, index) => (
                  <div
                    key={`${color}-${index}`}
                    style={{
                      height: 210,
                      borderRadius: 18,
                      background: `linear-gradient(135deg, ${color}, #111827)`,
                      border: "1px solid rgba(255,255,255,0.18)",
                      boxShadow: `0 24px 60px ${color}44`,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, #050711 0%, transparent 20%, transparent 78%, #050711 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

export type VinylPlayerTemplateProps = {
  title?: string;
  subtitle?: string;
  coverImage?: string;
  backgroundColor?: string;
};

export const VinylPlayerTemplate = ({
  title = "午夜模板系统",
  subtitle = "动态图形模板库",
  coverImage = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=400&auto=format&fit=crop",
  backgroundColor = "#080b0c",
}: VinylPlayerTemplateProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rotation = (frame / (fps * 2.4)) * 360;
  const progress = interpolate(frame, [0, 240], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const marquee = -((frame % 180) / 180) * 50;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 38%, #243233, ${backgroundColor} 72%)`,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: 480,
          borderRadius: 32,
          padding: 42,
          background: "#121212",
          boxShadow: "0 35px 90px rgba(0,0,0,0.65)",
        }}
      >
        <div
          style={{
            width: 330,
            height: 330,
            margin: "0 auto 34px",
            borderRadius: "50%",
            background:
              "repeating-radial-gradient(#080808 0 3px, #191919 4px 6px)",
            boxShadow: "inset 0 0 32px black, 0 28px 52px rgba(0,0,0,0.55)",
            transform: `rotate(${rotation}deg)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Img
            src={coverImage}
            style={{ width: 126, height: 126, borderRadius: "50%", objectFit: "cover" }}
          />
        </div>
        <div style={{ overflow: "hidden", color: "white" }}>
          <div style={{ display: "flex", transform: `translateX(${marquee}%)`, whiteSpace: "nowrap" }}>
            <h2 style={{ fontSize: 28, margin: 0, paddingRight: 42 }}>{title}</h2>
            <h2 style={{ fontSize: 28, margin: 0, paddingRight: 42 }}>{title}</h2>
          </div>
          <div style={{ marginTop: 10, color: "#8a8a8a", fontSize: 18 }}>{subtitle}</div>
        </div>
        <div style={{ height: 5, background: "#343434", borderRadius: 5, marginTop: 30 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "white", borderRadius: 5 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
