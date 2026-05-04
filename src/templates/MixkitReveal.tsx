import rough from "roughjs";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  DEFAULT_MIXKIT_REVEAL_PRESET_ID,
  getMixkitRevealPreset,
  type MixkitRevealEffectKind,
  type MixkitRevealPresetId,
} from "./mixkitRevealPresets";

export type MixkitRevealProps = {
  presetId?: MixkitRevealPresetId;
  title?: string;
  subtitle?: string;
  logoText?: string;
  body?: string;
  accentColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  intensity?: number;
  showSourceLabel?: boolean;
};

const generator = rough.generator({ options: { fixedDecimalPlaceDigits: 2 } });

export const MixkitReveal = ({
  presetId = DEFAULT_MIXKIT_REVEAL_PRESET_ID,
  title = "VideoLab",
  subtitle = "Mixkit reveal asset remade for Remotion",
  logoText,
  body = "Reusable frame-driven reveal preset",
  accentColor,
  secondaryColor,
  backgroundColor,
  intensity = 1,
  showSourceLabel = true,
}: MixkitRevealProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const preset = getMixkitRevealPreset(presetId);
  const accent = accentColor || preset.accentColor;
  const secondary = secondaryColor || preset.secondaryColor;
  const bg = backgroundColor || preset.backgroundColor;
  const logo = logoText || title.slice(0, 2).toUpperCase();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 92 } });
  const reveal = ease(frame, [8, 82], [0, 1]);
  const exit = ease(frame, [154, 178], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.86, 1], { extrapolateRight: "clamp" });
  const drift = Math.sin(frame / 26) * 6 * intensity;

  return (
    <AbsoluteFill style={{ background: bg, color: "white", overflow: "hidden", fontFamily: "Inter, Arial, sans-serif" }}>
      <Atmosphere frame={frame} accent={accent} secondary={secondary} effectKind={preset.effectKind} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 1 - exit * 0.7,
          transform: `scale(${scale}) translateY(${exit * -32}px)`,
        }}
      >
        <EffectLayer
          effectKind={preset.effectKind}
          frame={frame}
          progress={reveal}
          accent={accent}
          secondary={secondary}
          intensity={intensity}
        />
        <TitleLockup
          frame={frame}
          presetTitle={preset.title}
          title={title}
          subtitle={subtitle}
          body={body}
          logoText={logo}
          accent={accent}
          secondary={secondary}
          effectKind={preset.effectKind}
          drift={drift}
        />
      </div>
      {showSourceLabel ? (
        <div
          style={{
            position: "absolute",
            left: 34,
            bottom: 26,
            color: "rgba(255,255,255,0.54)",
            fontSize: 14,
            letterSpacing: 0,
          }}
        >
          Mixkit #{preset.mixkitId} remotion preset · {preset.title}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

function EffectLayer({
  effectKind,
  frame,
  progress,
  accent,
  secondary,
  intensity,
}: {
  effectKind: MixkitRevealEffectKind;
  frame: number;
  progress: number;
  accent: string;
  secondary: string;
  intensity: number;
}) {
  switch (effectKind) {
    case "barText":
      return <BarText frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "lowerThird":
      return <LowerThird progress={progress} accent={accent} secondary={secondary} />;
    case "news":
      return <NewsSweep frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "pixelFrame":
      return <PixelFrame progress={progress} accent={accent} secondary={secondary} />;
    case "corporate":
      return <CorporateWipe progress={progress} accent={accent} secondary={secondary} />;
    case "threeD":
      return <ThreeDStack frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "splash":
      return <SplashReveal frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "swirl":
      return <SwirlReveal frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "neon":
      return <NeonReveal frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "glitch":
      return <GlitchReveal frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "radialWipe":
      return <RadialWipe progress={progress} accent={accent} secondary={secondary} />;
    case "audioVisualizer":
      return <AudioVisualizer frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "gaming":
      return <GamingShards progress={progress} accent={accent} secondary={secondary} />;
    case "sport":
      return <SportStripes progress={progress} accent={accent} secondary={secondary} />;
    case "confetti":
      return <Confetti frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "fireworks":
      return <Fireworks frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "seasonal":
      return <Seasonal frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    case "particles":
      return <ParticleField frame={frame} progress={progress} accent={accent} secondary={secondary} intensity={intensity} />;
    case "food":
      return <FoodOrganic frame={frame} progress={progress} accent={accent} secondary={secondary} />;
    default:
      return <CorporateWipe progress={progress} accent={accent} secondary={secondary} />;
  }
}

function TitleLockup({
  frame,
  presetTitle,
  title,
  subtitle,
  body,
  logoText,
  accent,
  secondary,
  effectKind,
  drift,
}: {
  frame: number;
  presetTitle: string;
  title: string;
  subtitle: string;
  body: string;
  logoText: string;
  accent: string;
  secondary: string;
  effectKind: MixkitRevealEffectKind;
  drift: number;
}) {
  const titleIn = ease(frame, [36, 84], [0, 1]);
  const textY = interpolate(titleIn, [0, 1], [34, 0], { extrapolateRight: "clamp" });
  const glitch = effectKind === "glitch" ? Math.sin(frame * 1.7) * 5 : 0;
  const neon = effectKind === "neon";
  const compact = effectKind === "lowerThird";
  const x = compact ? 92 : 0;
  const y = compact ? 420 : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: compact ? 0 : "50%",
        top: compact ? 0 : "50%",
        width: compact ? "100%" : 760,
        transform: compact ? `translate(${x}px, ${y}px)` : `translate(-50%, -50%) translate(${glitch}px, ${textY + drift}px)`,
        textAlign: compact ? "left" : "center",
        opacity: titleIn,
      }}
    >
      <div
        style={{
          margin: compact ? "0 0 18px" : "0 auto 26px",
          width: compact ? 92 : 128,
          height: compact ? 92 : 128,
          borderRadius: effectKind === "pixelFrame" ? 12 : "50%",
          display: "grid",
          placeItems: "center",
          background: `linear-gradient(135deg, ${accent}, ${secondary})`,
          color: "#fff",
          fontSize: compact ? 30 : 42,
          fontWeight: 920,
          letterSpacing: 0,
          boxShadow: neon ? `0 0 32px ${accent}, 0 0 90px ${secondary}` : `0 24px 70px rgba(0,0,0,0.38)`,
          transform: `rotate(${Math.sin(frame / 34) * 2}deg)`,
        }}
      >
        {logoText}
      </div>
      <div
        style={{
          fontSize: compact ? 40 : 70,
          lineHeight: 1.02,
          fontWeight: 920,
          letterSpacing: 0,
          textShadow: neon ? `0 0 18px ${accent}` : "0 12px 38px rgba(0,0,0,0.42)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 18,
          color: "rgba(255,255,255,0.75)",
          fontSize: compact ? 18 : 23,
          fontWeight: 720,
          lineHeight: 1.36,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          margin: compact ? "12px 0 0" : "18px auto 0",
          maxWidth: compact ? 620 : 680,
          color: "rgba(255,255,255,0.58)",
          fontSize: compact ? 15 : 17,
          lineHeight: 1.55,
        }}
      >
        {body || presetTitle}
      </div>
    </div>
  );
}

function Atmosphere({
  frame,
  accent,
  secondary,
  effectKind,
}: {
  frame: number;
  accent: string;
  secondary: string;
  effectKind: MixkitRevealEffectKind;
}) {
  const sweep = ease(frame, [14, 122], [-32, 118]);
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 52% 45%, ${hexToRgba(accent, 0.25)}, transparent 28%), radial-gradient(circle at 80% 20%, ${hexToRgba(
            secondary,
            0.18,
          )}, transparent 24%), radial-gradient(circle at 20% 88%, rgba(255,255,255,0.07), transparent 28%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: effectKind === "news" || effectKind === "corporate" ? 0.12 : 0.2,
          backgroundImage:
            "linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: effectKind === "pixelFrame" ? "32px 32px" : "58px 58px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-30%",
          bottom: "-30%",
          left: `${sweep}%`,
          width: "18%",
          transform: "rotate(14deg)",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
          filter: "blur(16px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,0.48) 100%)",
        }}
      />
    </>
  );
}

function BarText({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${-12 + progress * 36 + i * 8}%`,
            top: `${120 + i * 96}px`,
            width: `${360 + i * 90}px`,
            height: 48,
            background: i % 2 ? secondary : accent,
            opacity: 0.86,
            transform: `skewX(-18deg) translateX(${Math.sin(frame / 18 + i) * 12}px)`,
          }}
        />
      ))}
    </>
  );
}

function LowerThird({ progress, accent, secondary }: BasicEffectProps) {
  return (
    <>
      <div style={{ position: "absolute", left: 64, bottom: 128, width: 780 * progress, height: 138, background: "#fff", opacity: 0.96 }} />
      <div style={{ position: "absolute", left: 64, bottom: 128, width: 18 + 180 * progress, height: 138, background: accent }} />
      <div style={{ position: "absolute", left: 64, bottom: 92, width: 520 * progress, height: 18, background: secondary }} />
    </>
  );
}

function NewsSweep({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${10 + i * 24}%`,
            top: -80,
            width: 170,
            height: 880,
            background: i === 1 ? accent : secondary,
            opacity: 0.32 + i * 0.16,
            transform: `skewX(-19deg) translateX(${progress * 340 + Math.sin(frame / 20 + i) * 20}px)`,
          }}
        />
      ))}
      <div style={{ position: "absolute", inset: "112px 72px", border: `2px solid ${hexToRgba(accent, 0.46)}` }} />
    </>
  );
}

function PixelFrame({ progress, accent, secondary }: BasicEffectProps) {
  const blocks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <>
      {blocks.map((i) => {
        const row = Math.floor(i / 12);
        const col = i % 12;
        const active = progress > i / blocks.length;
        const edge = row === 0 || row === 5 || col === 0 || col === 11;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 130 + col * 86,
              top: 82 + row * 86,
              width: edge ? 58 : 26,
              height: edge ? 58 : 26,
              background: active ? (i % 3 ? accent : secondary) : "rgba(255,255,255,0.06)",
              opacity: active ? 0.86 : 0.18,
              transform: `scale(${active ? 1 : 0.45})`,
            }}
          />
        );
      })}
    </>
  );
}

function CorporateWipe({ progress, accent, secondary }: BasicEffectProps) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - progress * 100}% 0 0)`, background: `linear-gradient(115deg, transparent 0 42%, ${hexToRgba(accent, 0.34)} 42% 58%, transparent 58%)` }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 700 * progress, height: 700 * progress, borderRadius: "50%", border: `2px solid ${hexToRgba(secondary, 0.34)}`, transform: "translate(-50%, -50%)" }} />
    </>
  );
}

function ThreeDStack({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 900 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 390 + i * 80,
            top: 170 + i * 42,
            width: 360,
            height: 230,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${i % 2 ? accent : secondary}, rgba(255,255,255,0.08))`,
            opacity: 0.28 + progress * 0.48,
            transform: `rotateY(${-28 + progress * 44 + Math.sin(frame / 38 + i) * 3}deg) rotateX(12deg) translateZ(${i * 18}px)`,
            boxShadow: "0 34px 80px rgba(0,0,0,0.34)",
          }}
        />
      ))}
    </div>
  );
}

function SplashReveal({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${34 + Math.sin(i * 1.7) * 24}%`,
            top: `${42 + Math.cos(i * 1.2) * 24}%`,
            width: 120 + i * 36,
            height: 90 + i * 24,
            borderRadius: "48% 52% 43% 57%",
            background: i % 2 ? accent : secondary,
            opacity: 0.22 + progress * 0.38,
            transform: `translate(-50%, -50%) rotate(${frame * (0.25 + i * 0.04)}deg) scale(${0.2 + progress * (0.9 + i * 0.04)})`,
            filter: "blur(0.2px)",
          }}
        />
      ))}
    </>
  );
}

function SwirlReveal({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <svg viewBox="0 0 1280 720" style={{ position: "absolute", inset: 0 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx="640"
          cy="360"
          r={70 + i * 52 + progress * 80}
          fill="none"
          stroke={i % 2 ? accent : secondary}
          strokeWidth={10 - i}
          strokeDasharray={`${80 + i * 24} ${90 - progress * 42}`}
          strokeDashoffset={-frame * (3 + i)}
          opacity={0.18 + progress * 0.42}
        />
      ))}
    </svg>
  );
}

function NeonReveal({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <svg viewBox="0 0 1280 720" style={{ position: "absolute", inset: 0, filter: `drop-shadow(0 0 18px ${accent})` }}>
      <path d="M250 360 C390 190 520 540 640 360 S900 160 1030 360" fill="none" stroke={accent} strokeWidth="9" strokeDasharray={`${progress * 900} 900`} strokeLinecap="round" />
      <path d="M278 392 C430 250 550 500 674 386 S894 226 1008 394" fill="none" stroke={secondary} strokeWidth="4" strokeDasharray={`${progress * 850} 850`} strokeLinecap="round" opacity={0.76 + Math.sin(frame / 8) * 0.16} />
    </svg>
  );
}

function GlitchReveal({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  const jitter = Math.sin(frame * 2.1) * 22 * (1 - progress * 0.4);
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${20 + i * 11}%`,
            top: 120 + i * 74,
            width: 720 - i * 48,
            height: 18 + (i % 2) * 22,
            background: i % 2 ? accent : secondary,
            opacity: 0.2 + progress * 0.36,
            transform: `translateX(${jitter * (i % 2 ? 1 : -1)}px)`,
          }}
        />
      ))}
    </>
  );
}

function RadialWipe({ progress, accent, secondary }: BasicEffectProps) {
  const angle = progress * 360;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `conic-gradient(from -90deg, ${hexToRgba(accent, 0.62)} 0deg, ${hexToRgba(secondary, 0.34)} ${angle}deg, transparent ${angle}deg)` }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 520, height: 520, borderRadius: "50%", background: "rgba(0,0,0,0.28)", transform: "translate(-50%, -50%)" }} />
    </>
  );
}

function AudioVisualizer({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <>
      {Array.from({ length: 48 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 48;
        const h = (42 + Math.sin(frame / 5 + i * 1.7) * 30) * progress;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 640 + Math.cos(a) * 210,
              top: 360 + Math.sin(a) * 210,
              width: 8,
              height: h,
              borderRadius: 99,
              background: i % 2 ? accent : secondary,
              transformOrigin: "50% 0%",
              transform: `translate(-50%, -50%) rotate(${(a * 180) / Math.PI + 90}deg)`,
              opacity: 0.78,
            }}
          />
        );
      })}
    </>
  );
}

function GamingShards({ progress, accent, secondary }: BasicEffectProps) {
  return (
    <svg viewBox="0 0 1280 720" style={{ position: "absolute", inset: 0 }}>
      {[[180, 150, 380, 100, 330, 270], [970, 110, 1120, 250, 900, 270], [140, 540, 360, 450, 420, 650], [900, 500, 1120, 460, 1080, 650]].map((points, i) => (
        <polygon key={i} points={points.join(" ")} fill={i % 2 ? accent : secondary} opacity={0.18 + progress * 0.42} transform={`translate(${(1 - progress) * (i % 2 ? 120 : -120)} 0)`} />
      ))}
    </svg>
  );
}

function SportStripes({ progress, accent, secondary }: BasicEffectProps) {
  return (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: -180 + i * 172 + progress * 220, top: -80, width: 86, height: 900, background: i % 2 ? accent : secondary, opacity: 0.34, transform: "skewX(-24deg)" }} />
      ))}
    </>
  );
}

function Confetti({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <>
      {Array.from({ length: 82 }, (_, i) => {
        const x = pseudo(i) * 1280;
        const y = ((pseudo(i + 20) * 720 + frame * (1.8 + pseudo(i + 4) * 3)) % 780) - 40;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 7 + pseudo(i + 9) * 12, height: 5 + pseudo(i + 11) * 10, background: i % 2 ? accent : secondary, opacity: progress * 0.86, transform: `rotate(${frame * 3 + i * 17}deg)` }} />;
      })}
    </>
  );
}

function Fireworks({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <svg viewBox="0 0 1280 720" style={{ position: "absolute", inset: 0 }}>
      {[[260, 190], [980, 210], [720, 130], [520, 550]].map(([cx, cy], i) => (
        <g key={i}>
          {Array.from({ length: 18 }, (_, j) => {
            const a = (Math.PI * 2 * j) / 18;
            const r = (44 + ((frame + i * 18) % 54) * 3) * progress;
            return <line key={j} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke={j % 2 ? accent : secondary} strokeWidth="4" strokeLinecap="round" opacity={0.76 * progress} />;
          })}
        </g>
      ))}
    </svg>
  );
}

function Seasonal({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <>
      {Array.from({ length: 72 }, (_, i) => {
        const x = pseudo(i) * 1280;
        const y = ((pseudo(i + 6) * 720 + frame * (0.8 + pseudo(i + 3) * 1.8)) % 760) - 20;
        return <div key={i} style={{ position: "absolute", left: x, top: y, color: i % 5 ? accent : secondary, fontSize: 10 + pseudo(i + 8) * 20, opacity: progress * 0.72, transform: `rotate(${frame + i * 13}deg)` }}>✦</div>;
      })}
    </>
  );
}

function ParticleField({ frame = 0, progress, accent, secondary, intensity }: BasicEffectProps & { intensity: number }) {
  return (
    <>
      {Array.from({ length: 90 }, (_, i) => {
        const x = pseudo(i) * 1280 + Math.sin(frame / 32 + i) * 18 * intensity;
        const y = pseudo(i + 12) * 720 + Math.cos(frame / 28 + i) * 24 * intensity;
        const size = 3 + pseudo(i + 5) * 18;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: "50%", background: i % 3 ? accent : secondary, opacity: progress * (0.09 + pseudo(i + 7) * 0.35), filter: "blur(2px)" }} />;
      })}
      <SketchFrame progress={progress} accent={accent} />
    </>
  );
}

function FoodOrganic({ frame = 0, progress, accent, secondary }: BasicEffectProps) {
  return (
    <svg viewBox="0 0 1280 720" style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 13 }, (_, i) => {
        const x = 120 + pseudo(i) * 1040;
        const y = 92 + pseudo(i + 2) * 540;
        return (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx={(34 + pseudo(i + 6) * 62) * progress}
            ry={(12 + pseudo(i + 9) * 28) * progress}
            fill={i % 2 ? accent : secondary}
            opacity={0.2 + progress * 0.32}
            transform={`rotate(${frame * 0.35 + i * 38} ${x} ${y})`}
          />
        );
      })}
    </svg>
  );
}

function SketchFrame({ progress, accent }: { progress: number; accent: string }) {
  const paths = generator.toPaths(
    generator.rectangle(350, 190, 580, 340, {
      stroke: accent,
      strokeWidth: 3,
      roughness: 1.8,
      bowing: 1.2,
      seed: 840,
    }),
  );
  return (
    <svg viewBox="0 0 1280 720" style={{ position: "absolute", inset: 0, opacity: progress * 0.46 }}>
      {paths.map((path, index) => (
        <path key={index} d={path.d} stroke={path.stroke} strokeWidth={path.strokeWidth} fill={path.fill || "none"} />
      ))}
    </svg>
  );
}

type BasicEffectProps = {
  frame?: number;
  progress: number;
  accent: string;
  secondary: string;
};

function ease(frame: number, input: [number, number], output: [number, number]) {
  return interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
}

function pseudo(seed: number) {
  const x = Math.sin(seed * 999.73) * 43758.5453;
  return x - Math.floor(x);
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
