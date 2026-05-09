import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  editorialBackground,
  fontStack,
  getSceneTheme,
  quietTexture,
  radius,
  safeArea,
  shadow,
  subtleVignette,
  typography,
  type SceneTone,
} from "./remotionDesignSystem";
import {
  motionDuration,
  softSpring,
  timedProgress,
  xEnter,
  yEnter,
} from "./remotionMotionSystem";

export type CommonSceneProps = {
  title?: string;
  subtitle?: string;
  body?: string;
  keywords?: string[];
  highlightWords?: string[];
  visualFocus?: string;
  tone?: SceneTone;
};

export type PortraitFocusProps = CommonSceneProps & {
  name?: string;
  roleTitle?: string;
  description?: string;
  era?: string;
};

export type QuoteRevealProps = CommonSceneProps & {
  quote?: string;
  source?: string;
};

export type ConceptDiagramProps = CommonSceneProps & {
  concept?: string;
  definition?: string;
  nodes?: string[];
};

export type MetaphorVisualProps = CommonSceneProps & {
  metaphor?: string;
  fromLabel?: string;
  toLabel?: string;
  objectLabel?: string;
};

export const PortraitFocus = ({
  name,
  title,
  roleTitle,
  subtitle,
  description,
  era,
  keywords = [],
  tone = "historical",
}: PortraitFocusProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getSceneTheme(tone);
  const enter = softSpring({ frame, fps });
  const textEnter = softSpring({ frame, fps, delay: 14 });
  const displayName = name || title || keywords[0] || "关键人物";
  const displayRole = roleTitle || subtitle || "叙事中的关键行动者";

  return (
    <AbsoluteFill style={editorialBackground(tone)}>
      <div style={quietTexture(tone)} />
      <div style={subtleVignette} />
      <div
        style={{
          position: "absolute",
          left: safeArea.x,
          top: safeArea.y,
          color: theme.accent,
          ...typography.eyebrow,
        }}
      >
        人物身份
      </div>
      <div
        style={{
          position: "absolute",
          left: safeArea.x,
          top: 122,
          width: 330,
          height: 468,
          borderRadius: radius.panel,
          background:
            tone === "clean"
              ? theme.surface
              : `linear-gradient(180deg, ${theme.surface}, ${theme.surfaceMuted})`,
          boxShadow: tone === "clean" ? shadow.soft : shadow.darkPanel,
          overflow: "hidden",
          ...xEnter(enter, -44),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 18,
            border: `1px solid ${theme.line}`,
            borderRadius: radius.card,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 42,
            right: 42,
            top: 46,
            height: 224,
            borderRadius: radius.card,
            background:
              tone === "historical"
                ? "linear-gradient(145deg, rgba(36,28,19,0.10), rgba(165,77,47,0.18))"
                : theme.accentSoft,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.text,
            fontSize: 94,
            fontWeight: 900,
            fontFamily: fontStack.serif,
          }}
        >
          {displayName.slice(0, 1)}
        </div>
        <div
          style={{
            position: "absolute",
            left: 34,
            right: 34,
            bottom: 42,
            color: theme.text,
          }}
        >
          <div style={{ ...typography.title, fontSize: 34 }}>
            {displayName}
          </div>
          <div
            style={{
              marginTop: 10,
              color: theme.muted,
              ...typography.caption,
            }}
          >
            {era || "历史人物"}
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 478,
          right: 92,
          top: 158,
          ...yEnter(textEnter, 28),
        }}
      >
        <div
          style={{
            color: theme.textOnBackground,
            ...typography.display,
          }}
        >
          {displayRole}
        </div>
        <div
          style={{
            marginTop: 30,
            width: 88,
            height: 4,
            borderRadius: 4,
            background: theme.accent,
          }}
        />
        <div
          style={{
            marginTop: 34,
            maxWidth: 670,
            color: theme.muted,
            ...typography.body,
          }}
        >
          {description || "该人物在这一段叙事中承担推动解释和连接历史事件的作用。"}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const QuoteReveal = ({
  quote,
  body,
  source,
  subtitle,
  highlightWords = [],
  tone = "dark",
}: QuoteRevealProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getSceneTheme(tone);
  const enter = softSpring({ frame, fps });
  const sourceEnter = softSpring({ frame, fps, delay: 24 });
  const ruleProgress = timedProgress(frame, 28, 54);
  const text = quote || body || "关键引文";
  const parts = splitHighlights(text, highlightWords);

  return (
    <AbsoluteFill style={editorialBackground(tone)}>
      <div style={quietTexture(tone)} />
      <div style={subtleVignette} />
      <div
        style={{
          position: "absolute",
          left: safeArea.x,
          top: 74,
          color: theme.accent,
          ...typography.eyebrow,
        }}
      >
        引文摘录
      </div>
      <div
        style={{
          position: "absolute",
          left: safeArea.x,
          right: 126,
          top: 128,
          ...yEnter(enter, 34),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -12,
            top: -28,
            color: theme.accentSoft,
            fontFamily: fontStack.serif,
            fontSize: 178,
            lineHeight: 0.8,
            fontWeight: 900,
          }}
        >
          “
        </div>
        <div
          style={{
            position: "relative",
            maxWidth: 980,
            color: theme.textOnBackground,
            fontFamily: fontStack.serif,
            fontSize: 52,
            lineHeight: 1.32,
            fontWeight: 800,
            letterSpacing: 0,
          }}
        >
          {parts.map((part, index) => (
            <span
              key={`${part.text}-${index}`}
              style={
                part.highlighted
                  ? {
                      color: theme.textOnBackground,
                      background: `linear-gradient(180deg, transparent 58%, ${theme.accentSoft} 58%)`,
                      boxShadow: `inset 0 -3px 0 ${theme.accent}`,
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
            marginTop: 34,
            width: `${ruleProgress * 100}%`,
            maxWidth: 520,
            height: 3,
            borderRadius: 3,
            background: theme.accent,
          }}
        />
        <div
          style={{
            marginTop: 22,
            color: theme.muted,
            ...typography.caption,
            ...yEnter(sourceEnter, 18),
          }}
        >
          {source || subtitle || "引文来源"}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ConceptDiagram = ({
  concept,
  title,
  definition,
  body,
  nodes = [],
  keywords = [],
  tone = "dark",
}: ConceptDiagramProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getSceneTheme(tone);
  const center = concept || title || keywords[0] || "核心概念";
  const items = [...nodes, ...keywords].filter(Boolean).slice(0, 5);
  const finalNodes = items.length > 0 ? items : ["背景条件", "关键机制", "资源流向", "权力结构"];
  const enter = softSpring({ frame, fps });
  const lineProgress = timedProgress(frame, 24, motionDuration.slow);

  return (
    <AbsoluteFill style={editorialBackground(tone)}>
      <div style={quietTexture(tone)} />
      <div style={subtleVignette} />
      <div
        style={{
          position: "absolute",
          left: safeArea.x,
          top: safeArea.y,
          width: 430,
          ...xEnter(enter, -34),
        }}
      >
        <div style={{ color: theme.accent, ...typography.eyebrow }}>
          概念解释
        </div>
        <div
          style={{
            marginTop: 18,
            color: theme.textOnBackground,
            ...typography.display,
          }}
        >
          {center}
        </div>
        <div
          style={{
            marginTop: 28,
            color: theme.muted,
            ...typography.body,
            fontSize: 25,
          }}
        >
          {definition || body || "用结构化节点解释抽象概念背后的关系。"}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 570,
          top: 86,
          width: 602,
          height: 548,
          borderRadius: radius.panel,
          background:
            tone === "clean"
              ? "rgba(255,255,255,0.72)"
              : "rgba(255,255,255,0.045)",
          border: `1px solid ${theme.line}`,
          boxShadow: tone === "clean" ? shadow.soft : shadow.darkPanel,
          overflow: "hidden",
          ...yEnter(enter, 30),
        }}
      >
        <svg viewBox="0 0 602 548" style={{ position: "absolute", inset: 0 }}>
          <path
            d={`M116 108 C220 108 250 106 ${356 * lineProgress + 116 * (1 - lineProgress)} 106`}
            fill="none"
            stroke={theme.accent}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.82"
          />
          <path
            d={`M116 438 C220 438 250 442 ${356 * lineProgress + 116 * (1 - lineProgress)} 442`}
            fill="none"
            stroke={theme.accent}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.42"
          />
          <line
            x1="116"
            y1="108"
            x2="116"
            y2={108 + 330 * lineProgress}
            stroke={theme.accent}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.68"
          />
        </svg>

        <div
          style={{
            position: "absolute",
            left: 48,
            top: 64,
            width: 168,
            height: 420,
            borderRadius: radius.card,
            background: theme.accentSoft,
            border: `1px solid ${theme.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 22,
            color: theme.textOnBackground,
            textAlign: "center",
            fontSize: center.length > 6 ? 23 : 25,
            lineHeight: 1.18,
            fontWeight: 900,
            whiteSpace: center.length > 6 ? "normal" : "nowrap",
            wordBreak: "keep-all",
          }}
        >
          {center.slice(0, 12)}
        </div>

        {finalNodes.map((node, index) => {
          const progress = timedProgress(frame, 36 + index * 9, 28);
          return (
            <div
              key={`${node}-${index}`}
              style={{
                position: "absolute",
                left: 278,
                top: 72 + index * 84,
                width: 252,
                minHeight: 58,
                borderRadius: radius.card,
                background: tone === "clean" ? theme.surface : theme.surfaceMuted,
                border: `1px solid ${theme.line}`,
                color: tone === "clean" ? theme.text : theme.textOnBackground,
                padding: "14px 18px",
                boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                ...xEnter(progress, 28),
              }}
            >
              <div
                style={{
                  color: theme.accent,
                  fontSize: 14,
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: 1.4,
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </div>
              <div
                style={{
                  marginTop: 7,
                  fontSize: 22,
                  lineHeight: 1.22,
                  fontWeight: 850,
                }}
              >
                {node.slice(0, 18)}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const MetaphorVisual = ({
  metaphor,
  title,
  fromLabel,
  toLabel,
  objectLabel,
  body,
  tone = "historical",
}: MetaphorVisualProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getSceneTheme(tone);
  const enter = softSpring({ frame, fps });
  const progress = timedProgress(frame, 34, 92);
  const x = interpolate(progress, [0, 1], [344, 902]);
  const y = interpolate(progress, [0, 0.5, 1], [398, 284, 398]);
  const object = objectLabel || body || "权益";

  return (
    <AbsoluteFill style={editorialBackground(tone)}>
      <div style={quietTexture(tone)} />
      <div style={subtleVignette} />
      <div
        style={{
          position: "absolute",
          left: safeArea.x,
          top: safeArea.y,
          ...yEnter(enter, 30),
        }}
      >
        <div style={{ color: theme.accent, ...typography.eyebrow }}>
          隐喻可视化
        </div>
        <div
          style={{
            marginTop: 16,
            color: theme.textOnBackground,
            ...typography.display,
          }}
        >
          {metaphor || title || "对象易手"}
        </div>
      </div>
      <TransferNode left={132} label={fromLabel || "来源"} tone={tone} />
      <TransferNode left={888} label={toLabel || "去向"} tone={tone} />
      <svg viewBox="0 0 1280 720" style={{ position: "absolute", inset: 0 }}>
        <path
          d="M392 398 C532 250 742 250 888 398"
          fill="none"
          stroke={theme.accent}
          strokeWidth="5"
          strokeDasharray="10 16"
          strokeLinecap="round"
          opacity="0.72"
        />
        <g transform={`translate(${x} ${y})`}>
          <circle r="58" fill={theme.accent} />
          <circle r="44" fill="rgba(0,0,0,0.14)" />
          <text
            textAnchor="middle"
            y="7"
            fontSize="20"
            fontWeight="900"
            fill="#fff"
            fontFamily={fontStack.sans}
          >
            {object.slice(0, 8)}
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const TransferNode = ({
  left,
  label,
  tone,
}: {
  left: number;
  label: string;
  tone: SceneTone;
}) => {
  const theme = getSceneTheme(tone);

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: 318,
        width: 260,
        height: 160,
        borderRadius: radius.panel,
        background: tone === "clean" ? theme.surface : theme.surface,
        border: `1px solid ${theme.line}`,
        color: tone === "clean" ? theme.text : theme.textOnBackground,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        textAlign: "center",
        fontSize: 34,
        lineHeight: 1.16,
        fontWeight: 900,
        boxShadow: tone === "clean" ? shadow.soft : shadow.darkPanel,
      }}
    >
      {label}
    </div>
  );
};

const splitHighlights = (text: string, highlightWords: string[]) => {
  const words = highlightWords.map((word) => word.trim()).filter(Boolean);
  if (words.length === 0) {
    return [{ text, highlighted: false }];
  }
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      highlighted: words.some((word) => word.toLowerCase() === part.toLowerCase()),
    }));
};
