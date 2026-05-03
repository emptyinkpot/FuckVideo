import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
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

export type ExistingTemplateId =
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
};

const asTemplate = <Props extends object>(Component: React.ComponentType<Props>): React.FC =>
  function WrappedTemplate() {
    return <Component {...({} as Props)} />;
  };

const templates: Record<ExistingTemplateId, React.FC> = {
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

export const templateOptions: Array<{ id: ExistingTemplateId; label: string }> = [
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
} satisfies Required<GeneratedTemplateVideoProps>;

export const GeneratedTemplateVideo = ({
  templateId,
  audioSrc,
  captions = [],
  showCaptions = true,
}: GeneratedTemplateVideoProps) => {
  const frame = useCurrentFrame();
  const Template = templates[templateId] || templates.SinoJapaneseWarDemo;
  const timeMs = (frame / 30) * 1000;
  const caption = captions.find((item) => timeMs >= item.startMs && timeMs <= item.endMs);
  const captionOpacity = showCaptions && caption ? interpolate(frame % 12, [0, 6], [0.9, 1]) : 0;

  return (
    <AbsoluteFill style={{ background: "#050505", overflow: "hidden" }}>
      <Template />
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      {showCaptions && caption ? (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            bottom: 44,
            minHeight: 70,
            padding: "18px 22px",
            borderRadius: 12,
            background: "rgba(0,0,0,0.62)",
            border: "1px solid rgba(255,255,255,0.16)",
            color: "#fff",
            fontSize: 28,
            lineHeight: 1.35,
            fontWeight: 800,
            textAlign: "center",
            textShadow: "0 2px 12px rgba(0,0,0,0.82)",
            opacity: captionOpacity,
          }}
        >
          {caption.text}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
