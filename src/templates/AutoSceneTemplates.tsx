import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type CommonSceneProps = {
  title?: string;
  subtitle?: string;
  body?: string;
  keywords?: string[];
  highlightWords?: string[];
  visualFocus?: string;
  tone?: "historical" | "dark" | "clean" | "dramatic";
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

const panelFont = "Inter, 'Microsoft YaHei', Arial, sans-serif";

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
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 95 } });
  const displayName = name || title || keywords[0] || "关键人物";
  const displayRole = roleTitle || subtitle || "叙事中的关键行动者";
  const bg = tone === "clean" ? "#e5e7eb" : "#111827";
  const fg = tone === "clean" ? "#111827" : "#f8fafc";

  return (
    <AbsoluteFill style={{ background: bg, color: fg, fontFamily: panelFont, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            tone === "clean"
              ? "radial-gradient(circle at 22% 30%, rgba(15,23,42,0.08), transparent 34%)"
              : "radial-gradient(circle at 30% 28%, rgba(251,191,36,0.14), transparent 34%), linear-gradient(135deg, #111827, #27272a)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 96,
          width: 330,
          height: 500,
          borderRadius: 24,
          background: tone === "clean" ? "#ffffff" : "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.16)",
          transform: `translateX(${interpolate(enter, [0, 1], [-80, 0])}px)`,
          opacity: enter,
          boxShadow: "0 30px 80px rgba(0,0,0,0.24)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 56,
            top: 58,
            width: 218,
            height: 218,
            borderRadius: "50%",
            background: tone === "clean" ? "#d1d5db" : "linear-gradient(135deg, #facc15, #f97316)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 88,
            fontWeight: 900,
          }}
        >
          {displayName.slice(0, 1)}
        </div>
        <div style={{ position: "absolute", left: 34, right: 34, bottom: 54, textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 900 }}>{displayName}</div>
          <div style={{ marginTop: 10, fontSize: 20, color: tone === "clean" ? "#4b5563" : "#fde68a" }}>
            {era || "历史人物"}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 492, right: 88, top: 138 }}>
        <div style={{ fontSize: 26, color: tone === "clean" ? "#6b7280" : "#fbbf24", fontWeight: 800 }}>
          人物身份
        </div>
        <div style={{ marginTop: 20, fontSize: 56, fontWeight: 900, lineHeight: 1.08 }}>{displayRole}</div>
        <div style={{ marginTop: 30, fontSize: 30, lineHeight: 1.55, color: tone === "clean" ? "#374151" : "#d4d4d8" }}>
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
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const text = quote || body || "关键引文";
  const parts = splitHighlights(text, highlightWords);

  return (
    <AbsoluteFill style={{ background: tone === "clean" ? "#f8fafc" : "#09090b", color: tone === "clean" ? "#111827" : "#fff", fontFamily: panelFont }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 68% 24%, rgba(245,158,11,0.18), transparent 34%)",
        }}
      />
      <div style={{ position: "absolute", left: 100, right: 100, top: 120, opacity: enter }}>
        <div style={{ fontSize: 96, lineHeight: 0.8, color: "#f59e0b", fontFamily: "Georgia, serif" }}>“</div>
        <div style={{ marginTop: -8, fontSize: 50, lineHeight: 1.38, fontWeight: 850 }}>
          {parts.map((part, index) => (
            <span
              key={`${part.text}-${index}`}
              style={part.highlighted ? { color: "#fbbf24", borderBottom: "4px solid #f59e0b" } : undefined}
            >
              {part.text}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 34, height: 2, width: `${Math.min(1, frame / 75) * 100}%`, background: "rgba(251,191,36,0.72)" }} />
        <div style={{ marginTop: 22, fontSize: 24, color: tone === "clean" ? "#64748b" : "#a1a1aa" }}>
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
  const center = concept || title || keywords[0] || "核心概念";
  const items = [...nodes, ...keywords].filter(Boolean).slice(0, 5);
  const finalNodes = items.length > 0 ? items : ["铁路", "港口", "租借地", "军政控制"];
  const pop = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ background: tone === "clean" ? "#f8fafc" : "#111827", color: tone === "clean" ? "#111827" : "#f8fafc", fontFamily: panelFont }}>
      <div style={{ position: "absolute", left: 70, top: 56 }}>
        <div style={{ fontSize: 24, color: "#38bdf8", fontWeight: 800 }}>概念解释</div>
        <div style={{ marginTop: 10, fontSize: 48, fontWeight: 900 }}>{center}</div>
        <div style={{ marginTop: 16, width: 520, fontSize: 24, lineHeight: 1.55, color: tone === "clean" ? "#475569" : "#cbd5e1" }}>
          {definition || body || "用节点关系解释抽象概念背后的结构。"}
        </div>
      </div>
      <svg viewBox="0 0 1280 720" style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(760 370) scale(${pop})`}>
          <circle r="92" fill="#0ea5e9" opacity="0.9" />
          <text textAnchor="middle" y="8" fontSize="28" fontWeight="900" fill="#fff">
            {center.slice(0, 8)}
          </text>
          {finalNodes.map((node, index) => {
            const angle = (-90 + index * (360 / finalNodes.length)) * (Math.PI / 180);
            const x = Math.cos(angle) * 245;
            const y = Math.sin(angle) * 190;
            return (
              <g key={`${node}-${index}`}>
                <line x1="0" y1="0" x2={x} y2={y} stroke="#38bdf8" strokeWidth="3" opacity="0.55" />
                <rect x={x - 82} y={y - 30} width="164" height="60" rx="16" fill={tone === "clean" ? "#ffffff" : "#1f2937"} stroke="#38bdf8" />
                <text textAnchor="middle" x={x} y={y + 8} fontSize="22" fontWeight="800" fill={tone === "clean" ? "#111827" : "#f8fafc"}>
                  {node.slice(0, 10)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
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
  const progress = interpolate(frame, [35, 145], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(progress, [0, 1], [335, 895]);
  const object = objectLabel || body || "权益";

  return (
    <AbsoluteFill style={{ background: tone === "clean" ? "#f4f4f5" : "#18181b", color: tone === "clean" ? "#18181b" : "#f4f4f5", fontFamily: panelFont, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 72, top: 58 }}>
        <div style={{ fontSize: 24, color: "#f59e0b", fontWeight: 800 }}>隐喻可视化</div>
        <div style={{ marginTop: 10, fontSize: 52, fontWeight: 900 }}>{metaphor || title || "对象易手"}</div>
      </div>
      <div style={{ position: "absolute", left: 130, top: 300, width: 260, height: 210, borderRadius: 24, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 900 }}>
        {fromLabel || "来源"}
      </div>
      <div style={{ position: "absolute", right: 130, top: 300, width: 260, height: 210, borderRadius: 24, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 900 }}>
        {toLabel || "去向"}
      </div>
      <svg viewBox="0 0 1280 720" style={{ position: "absolute", inset: 0 }}>
        <path d="M390 405 C520 260 740 260 890 405" fill="none" stroke="#f59e0b" strokeWidth="8" strokeDasharray="16 18" />
        <g transform={`translate(${x} ${interpolate(progress, [0, 0.5, 1], [405, 270, 405])})`}>
          <circle r="72" fill="#f59e0b" />
          <circle r="52" fill="#18181b" opacity="0.18" />
          <text textAnchor="middle" y="8" fontSize="22" fontWeight="900" fill="#fff">
            {object.slice(0, 8)}
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const splitHighlights = (text: string, highlightWords: string[]) => {
  const words = highlightWords.map((word) => word.trim()).filter(Boolean);
  if (words.length === 0) {
    return [{ text, highlighted: false }];
  }
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");
  return text.split(pattern).filter(Boolean).map((part) => ({
    text: part,
    highlighted: words.includes(part),
  }));
};
