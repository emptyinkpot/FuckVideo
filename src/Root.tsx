import "./preflight.css";
import "./fonts";
import { Composition } from "remotion";
import { z } from "zod";
import {
  Earth3DPreview,
  EarthFlyover,
  SINO_JAPANESE_WAR_DURATION,
  SinoJapaneseWarDemo,
} from "./earth3d";
import {
  PromptAnimatedShapes,
  PromptHistogram,
  PromptProgressBar,
  PromptTextRotation,
} from "./templates/PromptMotionExamples";
import { MapRouteFlyover } from "./templates/MapTemplates";
import {
  ClaudeTyperTemplate,
  ProceduralFishTemplate,
  RulerProgressTemplate,
  SpotlightRevealTemplate,
  SvgAssemblyTemplate,
  ThreeDTickerTemplate,
  VinylPlayerTemplate,
  Wechat2DTemplate,
} from "./templates/MotionTemplates";
import {
  ThreeBouncingSpheres,
  ThreeCardCascade,
  ThreeParticleNebula,
  ThreeProductStage,
} from "./templates/ThreeDTemplates";
import {
  defaultGeneratedTemplateProps,
  GeneratedTemplateVideo,
} from "./templates/GeneratedTemplateVideo";
import {
  NarratedVideo,
  type NarratedVideoProps,
} from "./templates/NarratedVideo";
import { DocumentReveal } from "./templates/DocumentReveal";
import { MixkitReveal } from "./templates/MixkitReveal";
import { MIXKIT_REVEAL_PRESET_IDS } from "./templates/mixkitRevealPresets";
import {
  defaultMultiSceneVideoProps,
  MultiSceneVideo,
} from "./templates/MultiSceneVideo";
import { currentMultiSceneDefaultProps } from "./generated/currentMultiSceneDefaultProps";
import {
  ConceptDiagram,
  MetaphorVisual,
  PortraitFocus,
  QuoteReveal,
} from "./templates/AutoSceneTemplates";

const templateIdSchema = z.enum([
  "DocumentReveal",
  "QuoteReveal",
  "PortraitFocus",
  "ConceptDiagram",
  "MetaphorVisual",
  "MixkitReveal",
  "SinoJapaneseWarDemo",
  "EarthFlyover",
  "MapRouteFlyover",
  "ClaudeTyper",
  "SpotlightReveal",
  "ProceduralFish",
  "RulerProgress",
  "SvgAssembly",
  "Wechat2D",
  "ThreeDTicker",
  "VinylPlayer",
  "PromptTextRotation",
  "PromptProgressBar",
  "PromptHistogram",
  "PromptAnimatedShapes",
  "ThreeProductStage",
  "ThreeBouncingSpheres",
  "ThreeParticleNebula",
  "ThreeCardCascade",
]);

const captionStyleSchema = z.enum(["typewriter", "classic", "none"]);
const progressStyleSchema = z.enum(["gradient", "thin", "none"]);
const videoInfrastructureLayoutSchema = {
  captionLeft: z.number().min(0).max(960).optional(),
  captionRight: z.number().min(0).max(960).optional(),
  captionBottom: z.number().min(0).max(540).optional(),
  captionMinHeight: z.number().min(0).max(240).optional(),
  captionPaddingX: z.number().min(0).max(160).optional(),
  captionPaddingY: z.number().min(0).max(120).optional(),
  captionFontSize: z.number().min(10).max(96).optional(),
  captionBorderRadius: z.number().min(0).max(80).optional(),
  captionTextColor: z.string().optional(),
  captionBackgroundColor: z.string().optional(),
  captionFontWeight: z.number().min(100).max(1000).optional(),
  captionLineHeight: z.number().min(0.8).max(2.4).optional(),
  progressLeft: z.number().min(0).max(960).optional(),
  progressRight: z.number().min(0).max(960).optional(),
  progressBottom: z.number().min(0).max(540).optional(),
  progressHeight: z.number().min(1).max(120).optional(),
  progressGap: z.number().min(0).max(40).optional(),
  progressPaddingX: z.number().min(0).max(240).optional(),
  progressLabelFontSize: z.number().min(8).max(64).optional(),
  progressMinSegmentWidth: z.number().min(0).max(240).optional(),
};

const generatedTemplateVideoSchema = z.object({
  templateId: templateIdSchema,
  title: z.string().optional(),
  audioSrc: z.string().optional(),
  captions: z.any().optional(),
  durationSeconds: z.number().min(5).max(600).optional(),
  showCaptions: z.boolean().optional(),
  captionStyle: captionStyleSchema.optional(),
  progressStyle: progressStyleSchema.optional(),
  ...videoInfrastructureLayoutSchema,
}).passthrough();

const documentRevealSchema = z.object({
  imageSrc: z.string().optional().describe("原图路径（public 内）或图片网址；填写后只展示原图翻起效果"),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  highlightText: z.string().optional(),
  highlightWords: z.array(z.string()).optional(),
  style: z.enum(["old_paper", "book", "modern"]).optional(),
  highlightMode: z.enum(["underline", "box", "marker"]).optional(),
  maxSnippetChars: z.number().min(40).max(180).optional(),
  sealText: z.string().optional(),
  tone: z.enum(["aged", "historical", "dramatic", "dark", "clean"]).optional(),
});

const portraitFocusSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  roleTitle: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  era: z.string().optional(),
  body: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  tone: z.enum(["historical", "dark", "clean", "dramatic"]).optional(),
});

const quoteRevealSchema = z.object({
  quote: z.string().optional(),
  source: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  highlightWords: z.array(z.string()).optional(),
  tone: z.enum(["historical", "dark", "clean", "dramatic"]).optional(),
});

const conceptDiagramSchema = z.object({
  concept: z.string().optional(),
  title: z.string().optional(),
  definition: z.string().optional(),
  body: z.string().optional(),
  nodes: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  tone: z.enum(["historical", "dark", "clean", "dramatic"]).optional(),
});

const metaphorVisualSchema = z.object({
  metaphor: z.string().optional(),
  title: z.string().optional(),
  fromLabel: z.string().optional(),
  toLabel: z.string().optional(),
  objectLabel: z.string().optional(),
  body: z.string().optional(),
  tone: z.enum(["historical", "dark", "clean", "dramatic"]).optional(),
});

const mixkitRevealSchema = z.object({
  presetId: z.enum(MIXKIT_REVEAL_PRESET_IDS).optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  logoText: z.string().optional(),
  body: z.string().optional(),
  accentColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  intensity: z.number().min(0.2).max(2).optional(),
  showSourceLabel: z.boolean().optional(),
});

const multiSceneVideoSchema = z.object({
  title: z.string().optional(),
  scenes: z.any(),
  audioSrc: z.string().optional(),
  captions: z.any().optional(),
  enableAudio: z.boolean().optional(),
  showCaptions: z.boolean().optional(),
  showSceneLabels: z.boolean().optional(),
  captionStyle: captionStyleSchema.optional(),
  progressStyle: progressStyleSchema.optional(),
  ...videoInfrastructureLayoutSchema,
}).passthrough();

const multiSceneDefaultProps = {
  ...defaultMultiSceneVideoProps,
  ...currentMultiSceneDefaultProps,
  scenes: Array.isArray(currentMultiSceneDefaultProps.scenes) && currentMultiSceneDefaultProps.scenes.length > 0
    ? currentMultiSceneDefaultProps.scenes
    : defaultMultiSceneVideoProps.scenes,
} as z.input<typeof multiSceneVideoSchema>;

const narratedVideoSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  bodyText: z.string(),
  audioSrc: z.string().optional(),
  captions: z.any().optional(),
  durationSeconds: z.number().min(5).max(600).optional(),
  theme: z.enum(["historical", "clean"]).optional(),
  captionStyle: captionStyleSchema.optional(),
  progressStyle: progressStyleSchema.optional(),
  ...videoInfrastructureLayoutSchema,
}).passthrough();

const color = () => z.string();
const text = () => z.string();

const claudeTyperSchema = z.object({
  prompt: text(),
  backgroundColor: color(),
  panelColor: color(),
  textColor: color(),
});

const spotlightRevealSchema = z.object({
  title: text(),
  backgroundColor: color(),
  lightColor: text(),
  fontSize: z.number().min(24).max(180),
});

const proceduralFishSchema = z.object({
  fishCount: z.number().int().min(1).max(40),
  backgroundTop: color(),
  backgroundBottom: color(),
  primaryColor: color(),
  secondaryColor: color(),
});

const rulerProgressSchema = z.object({
  title: text(),
  targetProgress: z.number().min(0).max(1),
  backgroundColor: color(),
  fillColorA: color(),
  fillColorB: color(),
});

const svgAssemblySchema = z.object({
  title: text(),
  backgroundColor: color(),
  glowColor: text(),
  partColorA: color(),
  partColorB: color(),
});

const wechat2DSchema = z.object({
  contactName: text(),
  leftMessageA: text(),
  rightMessageA: text(),
  leftMessageB: text(),
  rightMessageB: text(),
});

const threeDTickerSchema = z.object({
  backgroundColor: color(),
  perspective: z.number().min(300).max(1800),
  columnGap: z.number().min(0).max(120),
});

const vinylPlayerSchema = z.object({
  title: text(),
  subtitle: text(),
  coverImage: text(),
  backgroundColor: color(),
});

const promptTextRotationSchema = z.object({
  words: text(),
  backgroundColor: color(),
  textColor: color(),
  fontSize: z.number().min(32).max(180),
});

const promptProgressBarSchema = z.object({
  label: text(),
  backgroundColor: color(),
  barColorA: color(),
  barColorB: color(),
});

const promptHistogramSchema = z.object({
  title: text(),
  backgroundColor: color(),
  firstLabel: text(),
  secondLabel: text(),
  thirdLabel: text(),
  fourthLabel: text(),
  fifthLabel: text(),
});

const promptAnimatedShapesSchema = z.object({
  backgroundColor: color(),
  gap: z.number().min(0).max(160),
  size: z.number().min(32).max(220),
  spinSpeed: z.number().min(-3).max(3),
});

const threeProductStageSchema = z.object({
  title: text(),
  backgroundColor: color(),
  objectColor: color(),
  accentColor: color(),
  rotationSpeed: z.number().min(-0.1).max(0.1),
});

const threeBouncingSpheresSchema = z.object({
  sphereCount: z.number().int().min(1).max(4),
  backgroundColor: color(),
  bounceStrength: z.number().min(0).max(6),
  cameraDistance: z.number().min(4).max(12),
});

const threeParticleNebulaSchema = z.object({
  particleCount: z.number().int().min(10).max(240),
  backgroundColor: color(),
  coreColor: color(),
  orbitSpeed: z.number().min(-0.05).max(0.05),
});

const threeCardCascadeSchema = z.object({
  titleLine1: text(),
  titleLine2: text(),
  cardCount: z.number().int().min(1).max(30),
  backgroundColor: color(),
});

const mapRouteFlyoverSchema = z.object({
  title: text(),
  subtitle: text(),
  backgroundColor: color(),
  routeColor: color(),
  glowColor: color(),
});

// 地球画面的分层导出：full 完整；globe 只有基础地球；overlay 只有图层（透明背景）；labels 只有文字（透明背景）
const renderPassSchema = z.enum(["full", "globe", "overlay", "labels"]);

const earthFlyoverSchema = z.object({
  title: text(),
  subtitle: text(),
  from: z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]),
  to: z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]),
  fromLabel: text(),
  toLabel: text(),
  routeColor: color(),
  overlayOpacity: z.number().min(0).max(1),
  layers: z.object({
    rivers: z.boolean(),
    borders: z.boolean(),
    route: z.boolean(),
    pins: z.boolean(),
  }),
  pass: renderPassSchema,
});

const sinoJapaneseWarDemoSchema = z.object({
  title: text(),
  subtitle: text(),
  cardLeft: z.number().min(0).max(900),
  cardBottom: z.number().min(0).max(500),
  progressTop: z.number().min(0).max(160),
  showProgressBar: z.boolean(),
  layers: z.object({
    rivers: z.boolean(),
    borders: z.boolean(),
    territory: z.boolean(),
    frontlines: z.boolean(),
    arrows: z.boolean(),
    cities: z.boolean(),
    regions: z.boolean(),
  }),
  pass: renderPassSchema,
});

const geoCameraSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  rangeKm: z.number().min(0.5).max(40000),
  pitchDeg: z.number().min(0).max(89),
  headingDeg: z.number().min(-360).max(360),
});

const earth3DPreviewSchema = z.object({
  view: geoCameraSchema,
  keyframes: z.array(z.object({ frame: z.number().min(0), camera: geoCameraSchema })),
  exaggeration: z.number().min(0.5).max(5),
  layers: z.object({ rivers: z.boolean(), buildings: z.boolean(), borders: z.boolean() }),
  pixelError: z.number().min(0.5).max(8),
  hazeDensity: z.number().min(0).max(0.1),
  pass: renderPassSchema,
});

const defaultNarratedVideoProps = {
  title: "一键文本生成视频和语音",
  subtitle: "Qwen TTS 旁白 + Remotion 动画渲染",
  bodyText:
    "输入文本后，脚本会调用 Qwen TTS 生成旁白音频，并把音频、字幕和文本送入 Remotion 渲染成视频。",
  audioSrc: "",
  captions: [],
  durationSeconds: 12,
  theme: "historical",
  captionStyle: "typewriter" as const,
  progressStyle: "gradient" as const,
  captionLeft: 78,
  captionRight: 78,
  captionBottom: 34,
  captionMinHeight: 0,
  captionPaddingX: 24,
  captionPaddingY: 4,
  captionFontSize: 30,
  captionBorderRadius: 0,
  captionTextColor: "#f8fafc",
  captionBackgroundColor: "transparent",
  captionFontWeight: 850,
  captionLineHeight: 1.22,
  progressLeft: 0,
  progressRight: 0,
  progressBottom: 0,
  progressHeight: 30,
  progressGap: 4,
  progressPaddingX: 0,
  progressLabelFontSize: 14,
  progressMinSegmentWidth: 36,
} satisfies NarratedVideoProps;

const documentRevealDefaultProps: z.input<typeof documentRevealSchema> = {
  imageSrc: "images/e482890f4ab4a35e7ea701ce43c81147.jpg",
  title: "《朴茨茅斯和约》",
  subtitle: "历史文件",
  body: "条约上用词谨慎，所谓“转让”遮住了更复杂的权力关系。关东州租借地与南满铁路，成为战后日本经营大陆的新支点。",
  highlightText: "所谓“转让”遮住了更复杂的权力关系",
  highlightWords: ["转让", "关东州", "南满铁路"],
  style: "old_paper",
  highlightMode: "underline",
  maxSnippetChars: 120,
  sealText: "ARCHIVE",
  tone: "aged",
};

const portraitFocusDefaultProps: z.input<typeof portraitFocusSchema> = {
  name: "宇都宫太郎",
  roleTitle: "参谋本部作战课长",
  description: "战后经营策论中的关键人物，代表军事视角下的大陆经营想象。",
  era: "明治三十八年",
  keywords: ["参谋本部", "作战课长"],
  tone: "historical",
};

const quoteRevealDefaultProps: z.input<typeof quoteRevealSchema> = {
  quote: "战争所获之利权，犹如新得之刃。",
  source: "《日俄战后经营策论》",
  highlightWords: ["利权", "新得之刃"],
  tone: "dark",
};

const conceptDiagramDefaultProps: z.input<typeof conceptDiagramSchema> = {
  concept: "铁路附属地",
  definition: "铁路沿线形成的特殊权益空间，连接港口、租借地与军政控制。",
  nodes: ["铁路", "港口", "租借地", "利权", "军政控制"],
  tone: "dark",
};

const metaphorVisualDefaultProps: z.input<typeof metaphorVisualSchema> = {
  metaphor: "怀表易手",
  fromLabel: "俄国",
  toLabel: "日本",
  objectLabel: "南满铁路与关东州权益",
  tone: "historical",
};

const mixkitRevealDefaultProps: z.input<typeof mixkitRevealSchema> = {
  presetId: "bar-transition-text-625",
  title: "VideoLab",
  subtitle: "26 Mixkit reveal assets rebuilt as Remotion presets",
  logoText: "VL",
  body: "A single reusable composition can switch between bars, lower thirds, particles, neon, glitch, seasonal, sports, news, and logo reveal styles.",
  intensity: 1,
  showSourceLabel: true,
};

const claudeTyperDefaultProps: z.input<typeof claudeTyperSchema> = {
  prompt: "生成一套可复用的 Remotion 动画模板系统。",
  backgroundColor: "#15130f",
  panelColor: "#211f1a",
  textColor: "#c9c2b2",
};

const spotlightRevealDefaultProps: z.input<typeof spotlightRevealSchema> = {
  title: "动画模板库",
  backgroundColor: "#050505",
  lightColor: "255,241,184",
  fontSize: 112,
};

const proceduralFishDefaultProps: z.input<typeof proceduralFishSchema> = {
  fishCount: 16,
  backgroundTop: "#062b45",
  backgroundBottom: "#03121e",
  primaryColor: "#65f5ff",
  secondaryColor: "#ff7fd7",
};

const rulerProgressDefaultProps: z.input<typeof rulerProgressSchema> = {
  title: "项目进度",
  targetProgress: 0.82,
  backgroundColor: "#f4efe5",
  fillColorA: "#21a87a",
  fillColorB: "#5ee7ac",
};

const svgAssemblyDefaultProps: z.input<typeof svgAssemblySchema> = {
  title: "SVG 组装动画",
  backgroundColor: "#070914",
  glowColor: "rgba(94,231,255,0.7)",
  partColorA: "#5ee7ff",
  partColorB: "#ff5ec4",
};

const wechat2DDefaultProps: z.input<typeof wechat2DSchema> = {
  contactName: "动画模板",
  leftMessageA: "这个动画能直接做成模板吗？",
  rightMessageA: "可以，已经放进 Remotion 工作台。",
  leftMessageB: "后面还能改文字和节奏？",
  rightMessageB: "可以，参数都在组件里。",
};

const threeDTickerDefaultProps: z.input<typeof threeDTickerSchema> = {
  backgroundColor: "#050711",
  perspective: 1000,
  columnGap: 34,
};

const vinylPlayerDefaultProps: z.input<typeof vinylPlayerSchema> = {
  title: "午夜模板系统",
  subtitle: "动态图形模板库",
  coverImage: "images/vinyl-cover.jpg",
  backgroundColor: "#080b0c",
};

const promptTextRotationDefaultProps: z.input<typeof promptTextRotationSchema> =
  {
    words: "提示词,动画,图形,模板",
    backgroundColor: "#111827",
    textColor: "#f8fafc",
    fontSize: 116,
  };

const promptProgressBarDefaultProps: z.input<typeof promptProgressBarSchema> = {
  label: "生成动画中",
  backgroundColor: "#0f172a",
  barColorA: "#34d399",
  barColorB: "#38bdf8",
};

const promptHistogramDefaultProps: z.input<typeof promptHistogramSchema> = {
  title: "能力覆盖",
  backgroundColor: "#050505",
  firstLabel: "文本",
  secondLabel: "图表",
  thirdLabel: "三维",
  fourthLabel: "社媒",
  fifthLabel: "界面",
};

const promptAnimatedShapesDefaultProps: z.input<
  typeof promptAnimatedShapesSchema
> = {
  backgroundColor: "#0b0b0f",
  gap: 78,
  size: 128,
  spinSpeed: 0.8,
};

const threeProductStageDefaultProps: z.input<typeof threeProductStageSchema> = {
  title: "三维产品舞台",
  backgroundColor: "#020617",
  objectColor: "#dbeafe",
  accentColor: "#38bdf8",
  rotationSpeed: 0.025,
};

const threeBouncingSpheresDefaultProps: z.input<
  typeof threeBouncingSpheresSchema
> = {
  sphereCount: 4,
  backgroundColor: "#030712",
  bounceStrength: 3.2,
  cameraDistance: 8,
};

const threeParticleNebulaDefaultProps: z.input<
  typeof threeParticleNebulaSchema
> = {
  particleCount: 90,
  backgroundColor: "#020617",
  coreColor: "#67e8f9",
  orbitSpeed: 0.012,
};

const threeCardCascadeDefaultProps: z.input<typeof threeCardCascadeSchema> = {
  titleLine1: "三维卡片",
  titleLine2: "级联动画",
  cardCount: 12,
  backgroundColor: "#09090b",
};

const mapRouteFlyoverDefaultProps: z.input<typeof mapRouteFlyoverSchema> = {
  title: "路线飞越",
  subtitle: "地图导航风格动画",
  backgroundColor: "#09111f",
  routeColor: "#06b6d4",
  glowColor: "#0891b2",
};

const earthFlyoverDefaultProps: z.input<typeof earthFlyoverSchema> = {
  title: "关东州与南满铁路",
  subtitle: "从大连到长春",
  from: [121.6, 38.92],
  to: [125.32, 43.88],
  fromLabel: "大连",
  toLabel: "长春",
  routeColor: "#f97316",
  overlayOpacity: 0.86,
  layers: { rivers: true, borders: true, route: true, pins: true },
  pass: "full",
};

const sinoJapaneseWarDemoDefaultProps: z.input<
  typeof sinoJapaneseWarDemoSchema
> = {
  title: "1931-1945 中日战争演化",
  subtitle: "真实三维地球上的时间线、战线与占领区",
  cardLeft: 48,
  cardBottom: 42,
  progressTop: 34,
  showProgressBar: true,
  layers: {
    rivers: true,
    borders: true,
    territory: true,
    frontlines: true,
    arrows: true,
    cities: true,
    regions: true,
  },
  pass: "full",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DocumentReveal"
        component={DocumentReveal}
        schema={documentRevealSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        calculateMetadata={() => ({
          defaultCodec: "prores",
          defaultProResProfile: "4444",
          defaultPixelFormat: "yuva444p10le",
          defaultVideoImageFormat: "png",
        })}
        defaultProps={documentRevealDefaultProps}
      />
      <Composition
        id="QuoteReveal"
        component={QuoteReveal}
        schema={quoteRevealSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={quoteRevealDefaultProps}
      />
      <Composition
        id="PortraitFocus"
        component={PortraitFocus}
        schema={portraitFocusSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={portraitFocusDefaultProps}
      />
      <Composition
        id="ConceptDiagram"
        component={ConceptDiagram}
        schema={conceptDiagramSchema}
        durationInFrames={210}
        fps={30}
        width={1280}
        height={720}
        defaultProps={conceptDiagramDefaultProps}
      />
      <Composition
        id="MetaphorVisual"
        component={MetaphorVisual}
        schema={metaphorVisualSchema}
        durationInFrames={210}
        fps={30}
        width={1280}
        height={720}
        defaultProps={metaphorVisualDefaultProps}
      />
      <Composition
        id="MixkitReveal"
        component={MixkitReveal}
        schema={mixkitRevealSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={mixkitRevealDefaultProps}
      />
      <Composition
        id="MultiSceneVideo"
        component={MultiSceneVideo}
        schema={multiSceneVideoSchema}
        durationInFrames={390}
        fps={30}
        width={1280}
        height={720}
        defaultProps={multiSceneDefaultProps}
        calculateMetadata={({ props }) => {
          const scenes = props.scenes as Array<{fromFrame: number; durationInFrames: number}>;
          const endFrame = scenes.reduce(
            (max: number, scene) =>
              Math.max(max, scene.fromFrame + scene.durationInFrames),
            0,
          );
          return {
            durationInFrames: Math.max(150, endFrame || 390),
            props,
          };
        }}
      />
      <Composition
        id="GeneratedTemplateVideo"
        component={GeneratedTemplateVideo}
        schema={generatedTemplateVideoSchema}
        durationInFrames={360}
        fps={30}
        width={1280}
        height={720}
        defaultProps={defaultGeneratedTemplateProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(
            150,
            Math.ceil(Number(props.durationSeconds || 12) * 30),
          ),
          props,
        })}
      />
      <Composition
        id="NarratedVideo"
        component={NarratedVideo}
        schema={narratedVideoSchema}
        durationInFrames={360}
        fps={30}
        width={1280}
        height={720}
        defaultProps={defaultNarratedVideoProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(
            150,
            Math.ceil(Number(props.durationSeconds || 12) * 30),
          ),
          props,
        })}
      />
      <Composition
        id="ClaudeTyper"
        component={ClaudeTyperTemplate}
        schema={claudeTyperSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={claudeTyperDefaultProps}
      />
      <Composition
        id="SpotlightReveal"
        component={SpotlightRevealTemplate}
        schema={spotlightRevealSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={spotlightRevealDefaultProps}
      />
      <Composition
        id="ProceduralFish"
        component={ProceduralFishTemplate}
        schema={proceduralFishSchema}
        durationInFrames={240}
        fps={30}
        width={1280}
        height={720}
        defaultProps={proceduralFishDefaultProps}
      />
      <Composition
        id="RulerProgress"
        component={RulerProgressTemplate}
        schema={rulerProgressSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={rulerProgressDefaultProps}
      />
      <Composition
        id="SvgAssembly"
        component={SvgAssemblyTemplate}
        schema={svgAssemblySchema}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
        defaultProps={svgAssemblyDefaultProps}
      />
      <Composition
        id="Wechat2D"
        component={Wechat2DTemplate}
        schema={wechat2DSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={wechat2DDefaultProps}
      />
      <Composition
        id="ThreeDTicker"
        component={ThreeDTickerTemplate}
        schema={threeDTickerSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={threeDTickerDefaultProps}
      />
      <Composition
        id="VinylPlayer"
        component={VinylPlayerTemplate}
        schema={vinylPlayerSchema}
        durationInFrames={240}
        fps={30}
        width={1280}
        height={720}
        defaultProps={vinylPlayerDefaultProps}
      />
      <Composition
        id="PromptTextRotation"
        component={PromptTextRotation}
        schema={promptTextRotationSchema}
        durationInFrames={200}
        fps={30}
        width={1280}
        height={720}
        defaultProps={promptTextRotationDefaultProps}
      />
      <Composition
        id="PromptProgressBar"
        component={PromptProgressBar}
        schema={promptProgressBarSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={promptProgressBarDefaultProps}
      />
      <Composition
        id="PromptHistogram"
        component={PromptHistogram}
        schema={promptHistogramSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={promptHistogramDefaultProps}
      />
      <Composition
        id="PromptAnimatedShapes"
        component={PromptAnimatedShapes}
        schema={promptAnimatedShapesSchema}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={promptAnimatedShapesDefaultProps}
      />
      <Composition
        id="ThreeProductStage"
        component={ThreeProductStage}
        schema={threeProductStageSchema}
        durationInFrames={240}
        fps={30}
        width={1280}
        height={720}
        defaultProps={threeProductStageDefaultProps}
      />
      <Composition
        id="ThreeBouncingSpheres"
        component={ThreeBouncingSpheres}
        schema={threeBouncingSpheresSchema}
        durationInFrames={240}
        fps={30}
        width={1280}
        height={720}
        defaultProps={threeBouncingSpheresDefaultProps}
      />
      <Composition
        id="ThreeParticleNebula"
        component={ThreeParticleNebula}
        schema={threeParticleNebulaSchema}
        durationInFrames={240}
        fps={30}
        width={1280}
        height={720}
        defaultProps={threeParticleNebulaDefaultProps}
      />
      <Composition
        id="ThreeCardCascade"
        component={ThreeCardCascade}
        schema={threeCardCascadeSchema}
        durationInFrames={240}
        fps={30}
        width={1280}
        height={720}
        defaultProps={threeCardCascadeDefaultProps}
      />
      <Composition
        id="MapRouteFlyover"
        component={MapRouteFlyover}
        schema={mapRouteFlyoverSchema}
        durationInFrames={240}
        fps={30}
        width={1280}
        height={720}
        defaultProps={mapRouteFlyoverDefaultProps}
      />
      <Composition
        id="EarthFlyover"
        component={EarthFlyover}
        schema={earthFlyoverSchema}
        durationInFrames={240}
        fps={30}
        width={1280}
        height={720}
        defaultProps={earthFlyoverDefaultProps}
      />
      <Composition
        id="Earth3DPreview"
        component={Earth3DPreview}
        schema={earth3DPreviewSchema}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          keyframes: [
            { frame: 0, camera: { lon: 116, lat: 33, rangeKm: 14000, pitchDeg: 0, headingDeg: 0 } },
            { frame: 150, camera: { lon: 118.4, lat: 32.4, rangeKm: 900, pitchDeg: 35, headingDeg: 0 } },
            { frame: 299, camera: { lon: 118.78, lat: 32.04, rangeKm: 40, pitchDeg: 62, headingDeg: 20 } },
          ],
          view: { lon: 116, lat: 33, rangeKm: 14000, pitchDeg: 0, headingDeg: 0 },
          exaggeration: 1,
          layers: { rivers: true, buildings: true, borders: true },
          pixelError: 1.5,
          hazeDensity: 1 / 140,
          pass: "full",
        }}
      />
      <Composition
        id="SinoJapaneseWarDemo"
        component={SinoJapaneseWarDemo}
        schema={sinoJapaneseWarDemoSchema}
        durationInFrames={SINO_JAPANESE_WAR_DURATION}
        fps={30}
        width={1280}
        height={720}
        defaultProps={sinoJapaneseWarDemoDefaultProps}
      />
    </>
  );
};


