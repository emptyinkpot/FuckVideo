import { AbsoluteFill } from "remotion";
import { HistoricalGlobeTexture1938 } from "../historical-globe/compositions/HistoricalGlobeTexture1938";
import { AtlasMapFlyover, MapRouteFlyover } from "./MapTemplates";
import { PromptTextRotation } from "./PromptMotionExamples";
import { DocumentReveal, type DocumentRevealProps } from "./DocumentReveal";
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

export type AutoSceneTemplateId =
  | "DocumentReveal"
  | "QuoteReveal"
  | "PortraitFocus"
  | "ConceptDiagram"
  | "MetaphorVisual"
  | "AtlasMapFlyover"
  | "MapRouteFlyover"
  | "HistoricalGlobeTexture1938"
  | "PromptTextRotation"
  | "NarratedScene";

export type AutoScene = {
  id: string;
  index: number;
  text: string;
  sceneType?: string;
  narrationText?: string;
  visualIntent?: string;
  templateId: AutoSceneTemplateId;
  durationSec?: number;
  fromFrame: number;
  durationInFrames: number;
  keywords?: string[];
  decisionReason?: string;
  props: Record<string, unknown>;
};

const asProps = <Props extends object>(props: Record<string, unknown>) => props as Props;
const commonProps = (scene: AutoScene): CommonSceneProps => {
  const props = scene.props;
  return {
    title: (props.title as string | undefined) || `第 ${scene.index + 1} 镜`,
    subtitle: (props.subtitle as string | undefined) || scene.visualIntent,
    body: (props.body as string | undefined) || (props.bodyText as string | undefined) || scene.narrationText || scene.text,
    keywords: (props.keywords as string[] | undefined) || scene.keywords || [],
    highlightWords: (props.highlightWords as string[] | undefined) || scene.keywords?.slice(0, 3) || [],
    visualFocus: props.visualFocus as string | undefined,
    tone: props.tone as CommonSceneProps["tone"],
  };
};

const FallbackScene = ({ title, bodyText }: { title?: string; bodyText?: string }) => (
  <AbsoluteFill
    style={{
      background: "#101114",
      color: "#f8fafc",
      justifyContent: "center",
      padding: 82,
      fontFamily: "Inter, Arial, sans-serif",
    }}
  >
    <div style={{ fontSize: 54, fontWeight: 900, lineHeight: 1.08 }}>{title || "旁白镜头"}</div>
    <div style={{ marginTop: 28, maxWidth: 980, fontSize: 30, lineHeight: 1.55, color: "#d4d4d8" }}>
      {bodyText}
    </div>
  </AbsoluteFill>
);

export const renderSceneTemplate = (scene: AutoScene) => {
  switch (scene.templateId) {
    case "DocumentReveal":
      return <DocumentReveal {...asProps<DocumentRevealProps>({ ...commonProps(scene), ...scene.props })} />;
    case "QuoteReveal":
      return <QuoteReveal {...asProps<QuoteRevealProps>({ ...commonProps(scene), ...scene.props })} />;
    case "PortraitFocus":
      return <PortraitFocus {...asProps<PortraitFocusProps>({ ...commonProps(scene), ...scene.props })} />;
    case "ConceptDiagram":
      return <ConceptDiagram {...asProps<ConceptDiagramProps>({ ...commonProps(scene), ...scene.props })} />;
    case "MetaphorVisual":
      return <MetaphorVisual {...asProps<MetaphorVisualProps>({ ...commonProps(scene), ...scene.props })} />;
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
            words: (commonProps(scene).keywords || []).join(",") || commonProps(scene).title || "历史,利权,铁路,港口",
            backgroundColor: "#111111",
            textColor: "#f5f5f5",
            fontSize: 72,
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
