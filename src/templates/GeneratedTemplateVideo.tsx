import {
  AbsoluteFill,
  Audio,
  staticFile,
} from "remotion";
import { HistoricalGlobeTexture1938 } from "../historical-globe/compositions/HistoricalGlobeTexture1938";
import { SinoJapaneseWarDemo } from "../historical-globe/compositions/SinoJapaneseWarDemo";
import { AtlasMapFlyover, MapRouteFlyover } from "./MapTemplates";
import {
  ClaudeTyperTemplate,
  ProceduralFishTemplate,
  RulerProgressTemplate,
  SpotlightRevealTemplate,
  SvgAssemblyTemplate,
  ThreeDTickerTemplate,
  VinylPlayerTemplate,
  Wechat2DTemplate,
} from "./MotionTemplates";
import {
  PromptAnimatedShapes,
  PromptHistogram,
  PromptProgressBar,
  PromptTextRotation,
} from "./PromptMotionExamples";
import {
  ThreeBouncingSpheres,
  ThreeCardCascade,
  ThreeParticleNebula,
  ThreeProductStage,
} from "./ThreeDTemplates";
import type { NarratedCaption } from "./NarratedVideo";
import { DocumentReveal } from "./DocumentReveal";
import { MixkitReveal } from "./MixkitReveal";
import {
  ConceptDiagram,
  MetaphorVisual,
  PortraitFocus,
  QuoteReveal,
} from "./AutoSceneTemplates";
import { FootageScene } from "./FootageScene";
import {
  VideoInfrastructure,
  type CaptionStyle,
  type ProgressStyle,
} from "../video-infrastructure/VideoInfrastructure";
import {
  defaultVideoInfrastructureLayoutProps,
  resolveCaptionLayout,
  resolveProgressLayout,
  type VideoInfrastructureLayoutProps,
} from "./MultiSceneVideo";

export type ExistingTemplateId =
  | "DocumentReveal"
  | "QuoteReveal"
  | "PortraitFocus"
  | "ConceptDiagram"
  | "MetaphorVisual"
  | "FootageScene"
  | "MixkitReveal"
  | "SinoJapaneseWarDemo"
  | "HistoricalGlobeTexture1938"
  | "AtlasMapFlyover"
  | "MapRouteFlyover"
  | "ClaudeTyper"
  | "SpotlightReveal"
  | "ProceduralFish"
  | "RulerProgress"
  | "SvgAssembly"
  | "Wechat2D"
  | "ThreeDTicker"
  | "VinylPlayer"
  | "PromptTextRotation"
  | "PromptProgressBar"
  | "PromptHistogram"
  | "PromptAnimatedShapes"
  | "ThreeProductStage"
  | "ThreeBouncingSpheres"
  | "ThreeParticleNebula"
  | "ThreeCardCascade";

export type GeneratedTemplateVideoProps = {
  templateId: ExistingTemplateId;
  title?: string;
  audioSrc?: string;
  captions?: NarratedCaption[];
  durationSeconds?: number;
  showCaptions?: boolean;
  captionStyle?: CaptionStyle;
  progressStyle?: ProgressStyle;
} & VideoInfrastructureLayoutProps;

const asTemplate = <Props extends object>(
  Component: React.ComponentType<Props>,
): React.FC =>
  function WrappedTemplate() {
    return <Component {...({} as Props)} />;
  };

const templates: Record<ExistingTemplateId, React.FC> = {
  DocumentReveal: asTemplate(DocumentReveal),
  QuoteReveal: asTemplate(QuoteReveal),
  PortraitFocus: asTemplate(PortraitFocus),
  ConceptDiagram: asTemplate(ConceptDiagram),
  MetaphorVisual: asTemplate(MetaphorVisual),
  FootageScene: asTemplate(FootageScene),
  MixkitReveal: asTemplate(MixkitReveal),
  SinoJapaneseWarDemo: asTemplate(SinoJapaneseWarDemo),
  HistoricalGlobeTexture1938: asTemplate(HistoricalGlobeTexture1938),
  AtlasMapFlyover: asTemplate(AtlasMapFlyover),
  MapRouteFlyover: asTemplate(MapRouteFlyover),
  ClaudeTyper: asTemplate(ClaudeTyperTemplate),
  SpotlightReveal: asTemplate(SpotlightRevealTemplate),
  ProceduralFish: asTemplate(ProceduralFishTemplate),
  RulerProgress: asTemplate(RulerProgressTemplate),
  SvgAssembly: asTemplate(SvgAssemblyTemplate),
  Wechat2D: asTemplate(Wechat2DTemplate),
  ThreeDTicker: asTemplate(ThreeDTickerTemplate),
  VinylPlayer: asTemplate(VinylPlayerTemplate),
  PromptTextRotation: asTemplate(PromptTextRotation),
  PromptProgressBar: asTemplate(PromptProgressBar),
  PromptHistogram: asTemplate(PromptHistogram),
  PromptAnimatedShapes: asTemplate(PromptAnimatedShapes),
  ThreeProductStage: asTemplate(ThreeProductStage),
  ThreeBouncingSpheres: asTemplate(ThreeBouncingSpheres),
  ThreeParticleNebula: asTemplate(ThreeParticleNebula),
  ThreeCardCascade: asTemplate(ThreeCardCascade),
};

export const templateOptions: Array<{ id: ExistingTemplateId; label: string }> =
  [
    { id: "DocumentReveal", label: "历史文件揭示" },
    { id: "QuoteReveal", label: "引文揭示" },
    { id: "PortraitFocus", label: "人物身份卡" },
    { id: "ConceptDiagram", label: "概念关系图" },
    { id: "MetaphorVisual", label: "隐喻可视化" },
    { id: "FootageScene", label: "本地素材片段" },
    { id: "MixkitReveal", label: "Mixkit 揭示预设" },
    { id: "SinoJapaneseWarDemo", label: "中日战争历史地球" },
    { id: "HistoricalGlobeTexture1938", label: "1938 历史地球纹理" },
    { id: "AtlasMapFlyover", label: "世界地图飞越" },
    { id: "MapRouteFlyover", label: "路线地图飞越" },
    { id: "ThreeProductStage", label: "三维产品舞台" },
    { id: "ThreeParticleNebula", label: "三维粒子星云" },
    { id: "ThreeCardCascade", label: "三维卡片级联" },
    { id: "ThreeBouncingSpheres", label: "三维弹跳球" },
    { id: "ClaudeTyper", label: "命令行打字机" },
    { id: "SpotlightReveal", label: "聚光灯揭示" },
    { id: "ProceduralFish", label: "程序鱼群" },
    { id: "RulerProgress", label: "进度尺" },
    { id: "SvgAssembly", label: "SVG 组装" },
    { id: "Wechat2D", label: "微信对话" },
    { id: "ThreeDTicker", label: "3D 色块滚动" },
    { id: "VinylPlayer", label: "黑胶播放器" },
    { id: "PromptTextRotation", label: "提示词文本轮播" },
    { id: "PromptProgressBar", label: "提示词进度条" },
    { id: "PromptHistogram", label: "提示词柱状图" },
    { id: "PromptAnimatedShapes", label: "提示词动态图形" },
  ];

export const defaultGeneratedTemplateProps = {
  templateId: "SinoJapaneseWarDemo",
  title: "文本生成视频",
  audioSrc: "",
  captions: [],
  durationSeconds: 12,
  showCaptions: true,
  captionStyle: "typewriter" as const,
  progressStyle: "gradient" as const,
  ...defaultVideoInfrastructureLayoutProps,
} satisfies GeneratedTemplateVideoProps;

export const GeneratedTemplateVideo = ({
  templateId,
  audioSrc,
  captions = [],
  showCaptions = true,
  captionStyle = "typewriter",
  progressStyle = "gradient",
  ...layoutProps
}: GeneratedTemplateVideoProps) => {
  const Template = templates[templateId] || templates.SinoJapaneseWarDemo;
  const captionLayout = resolveCaptionLayout(layoutProps);
  const progressLayout = resolveProgressLayout(layoutProps);

  return (
    <AbsoluteFill style={{ background: "#050505", overflow: "hidden" }}>
      <Template />
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <VideoInfrastructure
        captions={showCaptions ? captions : []}
        captionStyle={showCaptions ? captionStyle : "none"}
        progressStyle={progressStyle}
        captionLayout={captionLayout}
        progressLayout={progressLayout}
      />
    </AbsoluteFill>
  );
};
