import "./index.css";
import { Composition } from "remotion";
import { z } from "zod";
import { HistoricalGlobeTexture1938 } from "./historical-globe/compositions/HistoricalGlobeTexture1938";
import {
  SINO_JAPANESE_WAR_DURATION,
  SinoJapaneseWarDemo,
} from "./historical-globe/compositions/SinoJapaneseWarDemo";
import { EarthGlobe } from "./templates/EarthGlobeTemplate";
import {
  PromptAnimatedShapes,
  PromptHistogram,
  PromptProgressBar,
  PromptTextRotation,
} from "./templates/PromptMotionExamples";
import { AtlasMapFlyover, MapRouteFlyover } from "./templates/MapTemplates";
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
import { NarratedVideo, type NarratedVideoProps } from "./templates/NarratedVideo";

const templateIdSchema = z.enum([
  "SinoJapaneseWarDemo",
  "HistoricalGlobeTexture1938",
  "AtlasMapFlyover",
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

const captionSchema = z.object({
  index: z.number(),
  startMs: z.number(),
  endMs: z.number(),
  text: z.string(),
});

const generatedTemplateVideoSchema = z.object({
  templateId: templateIdSchema,
  title: z.string().optional(),
  audioSrc: z.string().optional(),
  captions: z.array(captionSchema).optional(),
  durationSeconds: z.number().min(5).max(600).optional(),
  showCaptions: z.boolean().optional(),
});

const narratedVideoSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  bodyText: z.string(),
  audioSrc: z.string().optional(),
  captions: z.array(captionSchema).optional(),
  durationSeconds: z.number().min(5).max(600).optional(),
  theme: z.enum(["historical", "clean"]).optional(),
});

const earthGlobeSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  rotationSpeed: z.number().min(-0.05).max(0.05),
  startRotation: z.number().min(-10).max(10),
  axialTiltDegrees: z.number().min(-90).max(90),
  globeRadius: z.number().min(0.5).max(5),
  cameraDistance: z.number().min(2).max(12),
  cameraFov: z.number().min(10).max(90),
  ambientIntensity: z.number().min(0).max(5),
  sunIntensity: z.number().min(0).max(8),
  sunColor: z.string(),
  atmosphereColor: z.string(),
  atmosphereOpacity: z.number().min(0).max(1),
  routeAltitude: z.number().min(0).max(2),
  routeThickness: z.number().min(0.001).max(0.08),
  showStars: z.boolean(),
  showOverlayText: z.boolean(),
});

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

const atlasMapFlyoverSchema = z.object({
  title: text(),
  subtitle: text(),
  textureSrc: text(),
  routeColor: color(),
  overlayOpacity: z.number().min(0).max(1),
});

const historicalGlobeTexture1938Schema = z.object({
  title: text(),
  subtitle: text(),
  startLongitude: z.number().min(-360).max(360),
  rotationDegreesPerFrame: z.number().min(-5).max(5),
  projectionScale: z.number().min(120).max(520),
  projectionTranslateX: z.number().min(-300).max(300),
  projectionTranslateY: z.number().min(-300).max(300),
  showLabels: z.boolean(),
});

const sinoJapaneseWarDemoSchema = z.object({
  title: text(),
  subtitle: text(),
  cardLeft: z.number().min(0).max(900),
  cardBottom: z.number().min(0).max(500),
  progressTop: z.number().min(0).max(160),
  showProgressBar: z.boolean(),
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
} satisfies Required<NarratedVideoProps>;

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
  coverImage:
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=400&auto=format&fit=crop",
  backgroundColor: "#080b0c",
};

const promptTextRotationDefaultProps: z.input<typeof promptTextRotationSchema> = {
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

const promptAnimatedShapesDefaultProps: z.input<typeof promptAnimatedShapesSchema> = {
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

const threeBouncingSpheresDefaultProps: z.input<typeof threeBouncingSpheresSchema> = {
  sphereCount: 4,
  backgroundColor: "#030712",
  bounceStrength: 3.2,
  cameraDistance: 8,
};

const threeParticleNebulaDefaultProps: z.input<typeof threeParticleNebulaSchema> = {
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

const atlasMapFlyoverDefaultProps: z.input<typeof atlasMapFlyoverSchema> = {
  title: "世界地图飞越",
  subtitle: "Natural Earth 真实地图纹理",
  textureSrc: "maps/natural-earth-world-4096.jpg",
  routeColor: "#f97316",
  overlayOpacity: 0.86,
};

const historicalGlobeTexture1938DefaultProps: z.input<typeof historicalGlobeTexture1938Schema> = {
  title: "1938 世界历史矢量地球",
  subtitle: "国家区块可编辑填色，争议区斜线被地块边界裁切",
  startLongitude: -104,
  rotationDegreesPerFrame: 360 / 300,
  projectionScale: 292,
  projectionTranslateX: 0,
  projectionTranslateY: 12,
  showLabels: true,
};

const sinoJapaneseWarDemoDefaultProps: z.input<typeof sinoJapaneseWarDemoSchema> = {
  title: "1931-1945 中日战争演化",
  subtitle: "时间线、镜头聚焦、战线与地图填色联动",
  cardLeft: 48,
  cardBottom: 42,
  progressTop: 34,
  showProgressBar: true,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
          durationInFrames: Math.max(150, Math.ceil(Number(props.durationSeconds || 12) * 30)),
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
          durationInFrames: Math.max(150, Math.ceil(Number(props.durationSeconds || 12) * 30)),
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
        id="AtlasMapFlyover"
        component={AtlasMapFlyover}
        schema={atlasMapFlyoverSchema}
        durationInFrames={240}
        fps={30}
        width={1280}
        height={720}
        defaultProps={atlasMapFlyoverDefaultProps}
      />
      <Composition
        id="EarthGlobe"
        component={EarthGlobe}
        schema={earthGlobeSchema}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          title: "全球航线网络",
          subtitle: "8192px Natural Earth 球面纹理",
          rotationSpeed: 0.006,
          startRotation: -0.7,
          axialTiltDegrees: 23.5,
          globeRadius: 2.25,
          cameraDistance: 6.2,
          cameraFov: 36,
          ambientIntensity: 0.6,
          sunIntensity: 2.2,
          sunColor: "#ffffff",
          atmosphereColor: "#60a5fa",
          atmosphereOpacity: 0.18,
          routeAltitude: 0.72,
          routeThickness: 0.018,
          showStars: true,
          showOverlayText: true,
        }}
      />
      <Composition
        id="HistoricalGlobeTexture1938"
        component={HistoricalGlobeTexture1938}
        schema={historicalGlobeTexture1938Schema}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={720}
        defaultProps={historicalGlobeTexture1938DefaultProps}
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
