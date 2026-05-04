export const MIXKIT_REVEAL_PRESET_IDS = [
  "bar-transition-text-625",
  "box-reveal-lower-thrid-636",
  "news-logo-reveal-784",
  "pixel-frame-intro-615",
  "revealing-company-title-749",
  "animated-3d-reveal-561",
  "promo-logo-reveal-775",
  "splash-logo-reveal-565",
  "swirling-color-logo-reveal-562",
  "neon-logo-reveal-798",
  "logo-glitch-reveal-574",
  "radial-wipe-logo-reveal-572",
  "music-logo-reveal-visualizer-799",
  "gaming-shape-animation-reveal-573",
  "sport-logo-reveal-787",
  "happy-birthday-logo-reveal-790",
  "new-year-fireworks-logo-reveal-827",
  "christmas-logo-reveal-818",
  "particle-smoke-logo-reveal-843",
  "seasonal-snow-logo-reveal-842",
  "food-logo-reveal-782",
  "simple-opener-with-particles-780",
  "swipe-corporate-logo-571",
  "particle-lines-logo-564",
  "christmas-title-826",
  "clean-twist-logo-intro-810",
] as const;

export type MixkitRevealPresetId = (typeof MIXKIT_REVEAL_PRESET_IDS)[number];

export type MixkitRevealEffectKind =
  | "barText"
  | "lowerThird"
  | "news"
  | "pixelFrame"
  | "corporate"
  | "threeD"
  | "splash"
  | "swirl"
  | "neon"
  | "glitch"
  | "radialWipe"
  | "audioVisualizer"
  | "gaming"
  | "sport"
  | "confetti"
  | "fireworks"
  | "seasonal"
  | "particles"
  | "food";

export type MixkitRevealPreset = {
  id: MixkitRevealPresetId;
  mixkitId: number;
  title: string;
  sourceUrl: string;
  effectKind: MixkitRevealEffectKind;
  accentColor: string;
  secondaryColor: string;
  backgroundColor: string;
  tags: string[];
};

export const MIXKIT_REVEAL_PRESETS: MixkitRevealPreset[] = [
  {
    id: "bar-transition-text-625",
    mixkitId: 625,
    title: "Bar Transition Text",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/bar-transition-text-625/",
    effectKind: "barText",
    accentColor: "#f97316",
    secondaryColor: "#2563eb",
    backgroundColor: "#07070a",
    tags: ["bar", "transition", "text"],
  },
  {
    id: "box-reveal-lower-thrid-636",
    mixkitId: 636,
    title: "Box Reveal Lower Thrid",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/box-reveal-lower-thrid-636/",
    effectKind: "lowerThird",
    accentColor: "#facc15",
    secondaryColor: "#111827",
    backgroundColor: "#0f172a",
    tags: ["box", "lower-third", "title"],
  },
  {
    id: "news-logo-reveal-784",
    mixkitId: 784,
    title: "News Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/news-logo-reveal-784/",
    effectKind: "news",
    accentColor: "#dc2626",
    secondaryColor: "#1d4ed8",
    backgroundColor: "#060b18",
    tags: ["news", "logo", "broadcast"],
  },
  {
    id: "pixel-frame-intro-615",
    mixkitId: 615,
    title: "Pixel Frame Intro",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/pixel-frame-intro-615/",
    effectKind: "pixelFrame",
    accentColor: "#22d3ee",
    secondaryColor: "#a855f7",
    backgroundColor: "#09090b",
    tags: ["pixel", "frame", "intro"],
  },
  {
    id: "revealing-company-title-749",
    mixkitId: 749,
    title: "Revealing Company Title",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/revealing-company-title-749/",
    effectKind: "corporate",
    accentColor: "#38bdf8",
    secondaryColor: "#f8fafc",
    backgroundColor: "#0f172a",
    tags: ["company", "title", "corporate"],
  },
  {
    id: "animated-3d-reveal-561",
    mixkitId: 561,
    title: "Animated 3D Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/animated-3d-reveal-561/",
    effectKind: "threeD",
    accentColor: "#60a5fa",
    secondaryColor: "#f97316",
    backgroundColor: "#050816",
    tags: ["3d", "animated", "reveal"],
  },
  {
    id: "promo-logo-reveal-775",
    mixkitId: 775,
    title: "Promo Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/promo-logo-reveal-775/",
    effectKind: "corporate",
    accentColor: "#2dd4bf",
    secondaryColor: "#f8fafc",
    backgroundColor: "#082f49",
    tags: ["promo", "logo", "clean"],
  },
  {
    id: "splash-logo-reveal-565",
    mixkitId: 565,
    title: "Splash Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/splash-logo-reveal-565/",
    effectKind: "splash",
    accentColor: "#06b6d4",
    secondaryColor: "#f472b6",
    backgroundColor: "#051923",
    tags: ["splash", "logo", "liquid"],
  },
  {
    id: "swirling-color-logo-reveal-562",
    mixkitId: 562,
    title: "Swirling Color Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/swirling-color-logo-reveal-562/",
    effectKind: "swirl",
    accentColor: "#fb7185",
    secondaryColor: "#38bdf8",
    backgroundColor: "#16091f",
    tags: ["swirl", "color", "logo"],
  },
  {
    id: "neon-logo-reveal-798",
    mixkitId: 798,
    title: "Neon Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/neon-logo-reveal-798/",
    effectKind: "neon",
    accentColor: "#22d3ee",
    secondaryColor: "#fb7185",
    backgroundColor: "#020617",
    tags: ["neon", "logo", "glow"],
  },
  {
    id: "logo-glitch-reveal-574",
    mixkitId: 574,
    title: "Logo Glitch Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/logo-glitch-reveal-574/",
    effectKind: "glitch",
    accentColor: "#ef4444",
    secondaryColor: "#06b6d4",
    backgroundColor: "#050505",
    tags: ["glitch", "logo", "digital"],
  },
  {
    id: "radial-wipe-logo-reveal-572",
    mixkitId: 572,
    title: "Radial Wipe Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/radial-wipe-logo-reveal-572/",
    effectKind: "radialWipe",
    accentColor: "#f59e0b",
    secondaryColor: "#0ea5e9",
    backgroundColor: "#101114",
    tags: ["radial", "wipe", "logo"],
  },
  {
    id: "music-logo-reveal-visualizer-799",
    mixkitId: 799,
    title: "Music Logo Reveal Visualizer",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/music-logo-reveal-visualizer-799/",
    effectKind: "audioVisualizer",
    accentColor: "#a3e635",
    secondaryColor: "#38bdf8",
    backgroundColor: "#07110b",
    tags: ["music", "visualizer", "logo"],
  },
  {
    id: "gaming-shape-animation-reveal-573",
    mixkitId: 573,
    title: "Gaming Shape Animation Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/gaming-shape-animation-reveal-573/",
    effectKind: "gaming",
    accentColor: "#8b5cf6",
    secondaryColor: "#22c55e",
    backgroundColor: "#09090b",
    tags: ["gaming", "shape", "animation"],
  },
  {
    id: "sport-logo-reveal-787",
    mixkitId: 787,
    title: "Sport Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/sport-logo-reveal-787/",
    effectKind: "sport",
    accentColor: "#16a34a",
    secondaryColor: "#f97316",
    backgroundColor: "#052e16",
    tags: ["sport", "logo", "stripe"],
  },
  {
    id: "happy-birthday-logo-reveal-790",
    mixkitId: 790,
    title: "Happy Birthday Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/happy-birthday-logo-reveal-790/",
    effectKind: "confetti",
    accentColor: "#f472b6",
    secondaryColor: "#facc15",
    backgroundColor: "#221129",
    tags: ["birthday", "confetti", "logo"],
  },
  {
    id: "new-year-fireworks-logo-reveal-827",
    mixkitId: 827,
    title: "New Year Fireworks Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/new-year-fireworks-logo-reveal-827/",
    effectKind: "fireworks",
    accentColor: "#facc15",
    secondaryColor: "#f43f5e",
    backgroundColor: "#071225",
    tags: ["new-year", "fireworks", "logo"],
  },
  {
    id: "christmas-logo-reveal-818",
    mixkitId: 818,
    title: "Christmas Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/christmas-logo-reveal-818/",
    effectKind: "seasonal",
    accentColor: "#dc2626",
    secondaryColor: "#16a34a",
    backgroundColor: "#0f1f16",
    tags: ["christmas", "logo", "holiday"],
  },
  {
    id: "particle-smoke-logo-reveal-843",
    mixkitId: 843,
    title: "Particle Smoke Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/particle-smoke-logo-reveal-843/",
    effectKind: "particles",
    accentColor: "#94a3b8",
    secondaryColor: "#f8fafc",
    backgroundColor: "#09090b",
    tags: ["particle", "smoke", "logo"],
  },
  {
    id: "seasonal-snow-logo-reveal-842",
    mixkitId: 842,
    title: "Seasonal Snow Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/seasonal-snow-logo-reveal-842/",
    effectKind: "seasonal",
    accentColor: "#e0f2fe",
    secondaryColor: "#38bdf8",
    backgroundColor: "#082f49",
    tags: ["seasonal", "snow", "logo"],
  },
  {
    id: "food-logo-reveal-782",
    mixkitId: 782,
    title: "Food Logo Reveal",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/food-logo-reveal-782/",
    effectKind: "food",
    accentColor: "#f97316",
    secondaryColor: "#84cc16",
    backgroundColor: "#1c1917",
    tags: ["food", "logo", "organic"],
  },
  {
    id: "simple-opener-with-particles-780",
    mixkitId: 780,
    title: "Simple Opener with particles",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/simple-opener-with-particles-780/",
    effectKind: "particles",
    accentColor: "#60a5fa",
    secondaryColor: "#c084fc",
    backgroundColor: "#020617",
    tags: ["particles", "opener", "simple"],
  },
  {
    id: "swipe-corporate-logo-571",
    mixkitId: 571,
    title: "Swipe Corporate Logo",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/swipe-corporate-logo-571/",
    effectKind: "radialWipe",
    accentColor: "#0ea5e9",
    secondaryColor: "#f8fafc",
    backgroundColor: "#0f172a",
    tags: ["swipe", "corporate", "logo"],
  },
  {
    id: "particle-lines-logo-564",
    mixkitId: 564,
    title: "Particle Lines Logo",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/particle-lines-logo-564/",
    effectKind: "particles",
    accentColor: "#22d3ee",
    secondaryColor: "#64748b",
    backgroundColor: "#020617",
    tags: ["particle", "lines", "logo"],
  },
  {
    id: "christmas-title-826",
    mixkitId: 826,
    title: "Christmas Title",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/christmas-title-826/",
    effectKind: "seasonal",
    accentColor: "#ef4444",
    secondaryColor: "#f8fafc",
    backgroundColor: "#102018",
    tags: ["christmas", "title", "holiday"],
  },
  {
    id: "clean-twist-logo-intro-810",
    mixkitId: 810,
    title: "Clean Twist Logo Intro",
    sourceUrl: "https://mixkit.co/free-after-effects-templates/clean-twist-logo-intro-810/",
    effectKind: "swirl",
    accentColor: "#38bdf8",
    secondaryColor: "#f8fafc",
    backgroundColor: "#111827",
    tags: ["clean", "twist", "logo"],
  },
];

export const DEFAULT_MIXKIT_REVEAL_PRESET_ID: MixkitRevealPresetId =
  "bar-transition-text-625";

export const getMixkitRevealPreset = (id?: string) =>
  MIXKIT_REVEAL_PRESETS.find((preset) => preset.id === id) ||
  MIXKIT_REVEAL_PRESETS[0];
