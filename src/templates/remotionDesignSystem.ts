import type { CSSProperties } from "react";

export type SceneTone = "historical" | "dark" | "clean" | "dramatic";

export const fontStack = {
  sans: "Inter, 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', Arial, sans-serif",
  serif: "'Noto Serif SC', 'Songti SC', Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
};

export const safeArea = {
  x: 80,
  y: 64,
};

export const radius = {
  paper: 6,
  card: 10,
  panel: 14,
  media: 18,
};

export const shadow = {
  hairline: "inset 0 0 0 1px rgba(255, 255, 255, 0.08)",
  soft: "0 24px 70px rgba(15, 23, 42, 0.18)",
  paper: "0 18px 50px rgba(24, 18, 12, 0.26)",
  darkPanel: "0 26px 80px rgba(0, 0, 0, 0.34)",
};

export const typography = {
  eyebrow: {
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: 2.4,
  },
  display: {
    fontSize: 58,
    lineHeight: 1.04,
    fontWeight: 900,
    letterSpacing: 0,
  },
  title: {
    fontSize: 44,
    lineHeight: 1.12,
    fontWeight: 900,
    letterSpacing: 0,
  },
  body: {
    fontSize: 28,
    lineHeight: 1.58,
    fontWeight: 520,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 20,
    lineHeight: 1.38,
    fontWeight: 650,
    letterSpacing: 0,
  },
} satisfies Record<string, CSSProperties>;

export const sceneThemes = {
  historical: {
    background: "#14110c",
    surface: "#efe5cf",
    surfaceMuted: "#d7c7a9",
    text: "#241c13",
    textOnBackground: "#f4ead7",
    muted: "rgba(36, 28, 19, 0.58)",
    accent: "#a54d2f",
    accentSoft: "rgba(165, 77, 47, 0.14)",
    line: "rgba(36, 28, 19, 0.16)",
  },
  dark: {
    background: "#0d0f14",
    surface: "#171b22",
    surfaceMuted: "#202631",
    text: "#f7f3ea",
    textOnBackground: "#f7f3ea",
    muted: "rgba(247, 243, 234, 0.62)",
    accent: "#d7a84f",
    accentSoft: "rgba(215, 168, 79, 0.14)",
    line: "rgba(247, 243, 234, 0.12)",
  },
  clean: {
    background: "#f5f2ea",
    surface: "#fffdf7",
    surfaceMuted: "#e8e2d4",
    text: "#171717",
    textOnBackground: "#171717",
    muted: "rgba(23, 23, 23, 0.58)",
    accent: "#236a8f",
    accentSoft: "rgba(35, 106, 143, 0.12)",
    line: "rgba(23, 23, 23, 0.12)",
  },
  dramatic: {
    background: "#101014",
    surface: "#1d1b1e",
    surfaceMuted: "#2a2624",
    text: "#fff8ef",
    textOnBackground: "#fff8ef",
    muted: "rgba(255, 248, 239, 0.64)",
    accent: "#c45a3c",
    accentSoft: "rgba(196, 90, 60, 0.16)",
    line: "rgba(255, 248, 239, 0.13)",
  },
} satisfies Record<SceneTone, Record<string, string>>;

export const getSceneTheme = (tone: SceneTone = "historical") =>
  sceneThemes[tone] || sceneThemes.historical;

export const editorialBackground = (tone: SceneTone): CSSProperties => {
  const theme = getSceneTheme(tone);

  return {
    background: theme.background,
    color: theme.textOnBackground,
    fontFamily: fontStack.sans,
    overflow: "hidden",
  };
};

export const quietTexture = (tone: SceneTone): CSSProperties => {
  const isLight = tone === "clean";

  return {
    position: "absolute",
    inset: 0,
    opacity: isLight ? 0.42 : 0.22,
    backgroundImage:
      "linear-gradient(0deg, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
    backgroundSize: "48px 48px",
    maskImage:
      "radial-gradient(circle at 50% 42%, rgba(0,0,0,0.9), transparent 78%)",
  };
};

export const subtleVignette: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(circle at 50% 42%, transparent 48%, rgba(0,0,0,0.32) 100%)",
  pointerEvents: "none",
};
