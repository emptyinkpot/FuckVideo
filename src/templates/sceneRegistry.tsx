import { AbsoluteFill } from "remotion";
import { HistoricalGlobeTexture1938 } from "../historical-globe/compositions/HistoricalGlobeTexture1938";
import { AtlasMapFlyover, MapRouteFlyover } from "./MapTemplates";
import { PromptTextRotation } from "./PromptMotionExamples";
import { DocumentReveal, type DocumentRevealProps } from "./DocumentReveal";

export type AutoSceneTemplateId =
  | "DocumentReveal"
  | "AtlasMapFlyover"
  | "MapRouteFlyover"
  | "HistoricalGlobeTexture1938"
  | "PromptTextRotation"
  | "NarratedScene";

export type AutoScene = {
  id: string;
  index: number;
  text: string;
  templateId: AutoSceneTemplateId;
  fromFrame: number;
  durationInFrames: number;
  keywords?: string[];
  props: Record<string, unknown>;
};

const asProps = <Props extends object>(props: Record<string, unknown>) => props as Props;

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
      return <DocumentReveal {...asProps<DocumentRevealProps>(scene.props)} />;
    case "AtlasMapFlyover":
      return <AtlasMapFlyover {...asProps<React.ComponentProps<typeof AtlasMapFlyover>>(scene.props)} />;
    case "MapRouteFlyover":
      return <MapRouteFlyover {...asProps<React.ComponentProps<typeof MapRouteFlyover>>(scene.props)} />;
    case "HistoricalGlobeTexture1938":
      return (
        <HistoricalGlobeTexture1938
          {...asProps<React.ComponentProps<typeof HistoricalGlobeTexture1938>>(scene.props)}
        />
      );
    case "PromptTextRotation":
      return <PromptTextRotation {...asProps<React.ComponentProps<typeof PromptTextRotation>>(scene.props)} />;
    case "NarratedScene":
    default:
      return (
        <FallbackScene
          title={(scene.props.title as string | undefined) || `第 ${scene.index + 1} 镜`}
          bodyText={(scene.props.bodyText as string | undefined) || scene.text}
        />
      );
  }
};
