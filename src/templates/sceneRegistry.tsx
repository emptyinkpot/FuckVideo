import { AbsoluteFill } from "remotion";
import { HistoricalGlobeTexture1938 } from "../historical-globe/compositions/HistoricalGlobeTexture1938";
import { AtlasMapFlyover, MapRouteFlyover } from "./MapTemplates";
import { RulerProgressTemplate, SvgAssemblyTemplate } from "./MotionTemplates";
import { PromptHistogram, PromptTextRotation } from "./PromptMotionExamples";
import { DocumentReveal, type DocumentRevealProps } from "./DocumentReveal";
import { MixkitReveal, type MixkitRevealProps } from "./MixkitReveal";
import {
  ConceptDiagram,
  MetaphorVisual,
  PortraitFocus,
  QuoteReveal,
  type CommonSceneProps,
  type ConceptDiagramProps,
  type MetaphorVisualProps,
  type PortraitFocusProps,
  type QuoteRevealProps,
} from "./AutoSceneTemplates";
import { FootageScene, type FootageSceneProps } from "./FootageScene";

export type AutoSceneTemplateId =
  | "DocumentReveal"
  | "QuoteReveal"
  | "PortraitFocus"
  | "ConceptDiagram"
  | "MetaphorVisual"
  | "AtlasMapFlyover"
  | "MapRouteFlyover"
  | "HistoricalGlobeTexture1938"
  | "SvgAssembly"
  | "PromptHistogram"
  | "RulerProgress"
  | "PromptTextRotation"
  | "MixkitReveal"
  | "FootageScene"
  | "NarratedScene";

export type AutoSceneVisualLayer =
  | {
      type: "template";
      templateId?: AutoSceneTemplateId;
      providerType?: string;
      confidence?: number;
      reason?: string;
    }
  | {
      type: "footage";
      providerType?: string;
      clipId?: string;
      path: string;
      title?: string;
      confidence?: number;
      reason?: string;
      fallbackTemplateId?: AutoSceneTemplateId;
    }
  | {
      type: "template_with_footage_hint";
      templateId?: AutoSceneTemplateId;
      providerType?: string;
      clipId?: string;
      path?: string;
      title?: string;
      confidence?: number;
      reason?: string;
    };

export type AutoScene = {
  id: string;
  index: number;
  text: string;
  sceneType?: string;
  narrationText?: string;
  visualIntent?: string;
  templateId: AutoSceneTemplateId;
  visualProviderId?: string;
  providerType?: string;
  durationSec?: number;
  fromFrame: number;
  durationInFrames: number;
  keywords?: string[];
  visualIntentData?: Record<string, unknown>;
  decisionReason?: string;
  visualLayer?: AutoSceneVisualLayer;
  props: Record<string, unknown>;
};

const asProps = <Props extends object>(props: Record<string, unknown>) =>
  props as Props;
const commonProps = (scene: AutoScene): CommonSceneProps => {
  const props = scene.props;
  return {
    title: (props.title as string | undefined) || `第 ${scene.index + 1} 镜`,
    subtitle: (props.subtitle as string | undefined) || scene.visualIntent,
    body:
      (props.body as string | undefined) ||
      (props.bodyText as string | undefined) ||
      scene.narrationText ||
      scene.text,
    keywords: (props.keywords as string[] | undefined) || scene.keywords || [],
    highlightWords:
      (props.highlightWords as string[] | undefined) ||
      scene.keywords?.slice(0, 3) ||
      [],
    visualFocus: props.visualFocus as string | undefined,
    tone: props.tone as CommonSceneProps["tone"],
  };
};

const FallbackScene = ({
  title,
  bodyText,
}: {
  title?: string;
  bodyText?: string;
}) => (
  <AbsoluteFill
    style={{
      background: "#101114",
      color: "#f8fafc",
      justifyContent: "center",
      padding: 82,
      fontFamily: "Inter, Arial, sans-serif",
    }}
  >
    <div style={{ fontSize: 54, fontWeight: 900, lineHeight: 1.08 }}>
      {title || "旁白镜头"}
    </div>
    <div
      style={{
        marginTop: 28,
        maxWidth: 980,
        fontSize: 30,
        lineHeight: 1.55,
        color: "#d4d4d8",
      }}
    >
      {bodyText}
    </div>
  </AbsoluteFill>
);

export const renderSceneTemplate = (scene: AutoScene) => {
  if (scene.visualLayer?.type === "footage") {
    return (
      <FootageScene
        src={scene.visualLayer.path}
        title={
          (scene.props.title as string | undefined) ||
          scene.visualLayer.title ||
          commonProps(scene).title
        }
        subtitle={
          scene.visualIntent ||
          scene.visualLayer.reason ||
          commonProps(scene).subtitle
        }
        darken={0.28}
        zoom={1.08}
      />
    );
  }

  switch (scene.templateId) {
    case "DocumentReveal":
      return (
        <DocumentReveal
          {...asProps<DocumentRevealProps>({
            ...commonProps(scene),
            ...scene.props,
          })}
        />
      );
    case "QuoteReveal":
      return (
        <QuoteReveal
          {...asProps<QuoteRevealProps>({
            ...commonProps(scene),
            ...scene.props,
          })}
        />
      );
    case "PortraitFocus":
      return (
        <PortraitFocus
          {...asProps<PortraitFocusProps>({
            ...commonProps(scene),
            ...scene.props,
          })}
        />
      );
    case "ConceptDiagram":
      return (
        <ConceptDiagram
          {...asProps<ConceptDiagramProps>({
            ...commonProps(scene),
            ...scene.props,
          })}
        />
      );
    case "MetaphorVisual":
      return (
        <MetaphorVisual
          {...asProps<MetaphorVisualProps>({
            ...commonProps(scene),
            ...scene.props,
          })}
        />
      );
    case "AtlasMapFlyover":
      return (
        <AtlasMapFlyover
          {...asProps<React.ComponentProps<typeof AtlasMapFlyover>>({
            title: commonProps(scene).title,
            subtitle: commonProps(scene).subtitle,
            textureSrc: "maps/natural-earth-world-4096.jpg",
            routeColor: "#f4d35e",
            overlayOpacity: 0.76,
            ...scene.props,
          })}
        />
      );
    case "MapRouteFlyover":
      return (
        <MapRouteFlyover
          {...asProps<React.ComponentProps<typeof MapRouteFlyover>>({
            title: commonProps(scene).title,
            subtitle: commonProps(scene).subtitle,
            backgroundColor: "#09111f",
            routeColor: "#06b6d4",
            glowColor: "#0891b2",
            ...scene.props,
          })}
        />
      );
    case "HistoricalGlobeTexture1938":
      return (
        <HistoricalGlobeTexture1938
          {...asProps<React.ComponentProps<typeof HistoricalGlobeTexture1938>>({
            title: commonProps(scene).title,
            subtitle: commonProps(scene).subtitle,
            startLongitude: -104,
            rotationDegreesPerFrame: 1.2,
            projectionScale: 292,
            projectionTranslateX: 0,
            projectionTranslateY: 12,
            showLabels: true,
            ...scene.props,
          })}
        />
      );
    case "PromptTextRotation":
      return (
        <PromptTextRotation
          {...asProps<React.ComponentProps<typeof PromptTextRotation>>({
            words:
              (commonProps(scene).keywords || []).join(",") ||
              commonProps(scene).title ||
              "历史,利权,铁路,港口",
            backgroundColor: "#111111",
            textColor: "#f5f5f5",
            fontSize: 72,
            ...scene.props,
          })}
        />
      );
    case "MixkitReveal":
      return (
        <MixkitReveal
          {...asProps<MixkitRevealProps>({
            title: commonProps(scene).title,
            subtitle: commonProps(scene).subtitle,
            logoText: (commonProps(scene).title || "VL")
              .slice(0, 2)
              .toUpperCase(),
            body: commonProps(scene).body,
            presetId: "bar-transition-text-625",
            intensity: 1,
            showSourceLabel: false,
            ...scene.props,
          })}
        />
      );
    case "SvgAssembly":
      return (
        <SvgAssemblyTemplate
          {...asProps<React.ComponentProps<typeof SvgAssemblyTemplate>>({
            title: commonProps(scene).title,
            backgroundColor: "#070914",
            glowColor: "rgba(94,231,255,0.7)",
            partColorA: "#d6b36a",
            partColorB: "#7ea7ff",
            ...scene.props,
          })}
        />
      );
    case "PromptHistogram":
      return (
        <PromptHistogram
          {...asProps<React.ComponentProps<typeof PromptHistogram>>({
            title: commonProps(scene).title,
            backgroundColor: "#050505",
            firstLabel: commonProps(scene).keywords?.[0] || "文本",
            secondLabel: commonProps(scene).keywords?.[1] || "地点",
            thirdLabel: commonProps(scene).keywords?.[2] || "组织",
            fourthLabel: commonProps(scene).keywords?.[3] || "文件",
            fifthLabel: commonProps(scene).keywords?.[4] || "概念",
            ...scene.props,
          })}
        />
      );
    case "RulerProgress":
      return (
        <RulerProgressTemplate
          {...asProps<React.ComponentProps<typeof RulerProgressTemplate>>({
            title: commonProps(scene).title,
            targetProgress: 0.72,
            backgroundColor: "#f4efe5",
            fillColorA: "#21a87a",
            fillColorB: "#5ee7ac",
            ...scene.props,
          })}
        />
      );
    case "FootageScene":
      return (
        <FootageScene
          {...asProps<FootageSceneProps>({
            title: commonProps(scene).title,
            subtitle: commonProps(scene).subtitle,
            ...scene.props,
          })}
        />
      );
    case "NarratedScene":
    default:
      return (
        <FallbackScene
          title={commonProps(scene).title}
          bodyText={commonProps(scene).body || scene.text}
        />
      );
  }
};
