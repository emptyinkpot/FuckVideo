import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import type { NarratedCaption } from "./NarratedVideo";
import {
  VideoInfrastructure,
  type CaptionLayout,
  type CaptionStyle,
  type ProgressLayout,
  type ProgressSegment,
  type ProgressStyle,
} from "../video-infrastructure/VideoInfrastructure";
import { isLikelyMediaFile, normalizeStaticMediaPath } from "./mediaSource";
import { type AutoScene, renderSceneTemplate } from "./sceneRegistry";

export const defaultCaptionLayout = {
  left: 78,
  right: 78,
  bottom: 34,
  minHeight: 0,
  paddingX: 24,
  paddingY: 4,
  fontSize: 30,
  borderRadius: 0,
  textColor: "#f8fafc",
  backgroundColor: "transparent",
  fontWeight: 850,
  lineHeight: 1.22,
} satisfies Required<CaptionLayout>;

export const defaultProgressLayout = {
  left: 0,
  right: 0,
  bottom: 0,
  height: 30,
  gap: 4,
  paddingX: 0,
  labelFontSize: 14,
  minSegmentWidth: 36,
} satisfies Required<ProgressLayout>;

export type VideoInfrastructureLayoutProps = {
  captionLayout?: CaptionLayout;
  progressLayout?: ProgressLayout;
  captionLeft?: number;
  captionRight?: number;
  captionBottom?: number;
  captionMinHeight?: number;
  captionPaddingX?: number;
  captionPaddingY?: number;
  captionFontSize?: number;
  captionBorderRadius?: number;
  captionTextColor?: string;
  captionBackgroundColor?: string;
  captionFontWeight?: number;
  captionLineHeight?: number;
  progressLeft?: number;
  progressRight?: number;
  progressBottom?: number;
  progressHeight?: number;
  progressGap?: number;
  progressPaddingX?: number;
  progressLabelFontSize?: number;
  progressMinSegmentWidth?: number;
};

export const defaultVideoInfrastructureLayoutProps = {
  captionLeft: defaultCaptionLayout.left,
  captionRight: defaultCaptionLayout.right,
  captionBottom: defaultCaptionLayout.bottom,
  captionMinHeight: defaultCaptionLayout.minHeight,
  captionPaddingX: defaultCaptionLayout.paddingX,
  captionPaddingY: defaultCaptionLayout.paddingY,
  captionFontSize: defaultCaptionLayout.fontSize,
  captionBorderRadius: defaultCaptionLayout.borderRadius,
  captionTextColor: defaultCaptionLayout.textColor,
  captionBackgroundColor: defaultCaptionLayout.backgroundColor,
  captionFontWeight: defaultCaptionLayout.fontWeight,
  captionLineHeight: defaultCaptionLayout.lineHeight,
  progressLeft: defaultProgressLayout.left,
  progressRight: defaultProgressLayout.right,
  progressBottom: defaultProgressLayout.bottom,
  progressHeight: defaultProgressLayout.height,
  progressGap: defaultProgressLayout.gap,
  progressPaddingX: defaultProgressLayout.paddingX,
  progressLabelFontSize: defaultProgressLayout.labelFontSize,
  progressMinSegmentWidth: defaultProgressLayout.minSegmentWidth,
} satisfies Required<Omit<VideoInfrastructureLayoutProps, "captionLayout" | "progressLayout">>;

export type MultiSceneVideoProps = {
  title?: string;
  scenes: AutoScene[];
  audioSrc?: string;
  captions?: NarratedCaption[];
  enableAudio?: boolean;
  showCaptions?: boolean;
  showSceneLabels?: boolean;
  captionStyle?: CaptionStyle;
  progressStyle?: ProgressStyle;
} & VideoInfrastructureLayoutProps;

export const defaultMultiSceneVideoProps = {
  title: "自动镜头视频",
  audioSrc: "",
  captions: [],
  enableAudio: false,
  showCaptions: true,
  showSceneLabels: true,
  captionStyle: "typewriter" as const,
  progressStyle: "gradient" as const,
  ...defaultVideoInfrastructureLayoutProps,
  scenes: [
    {
      id: "scene-001",
      index: 0,
      text: "《朴茨茅斯和约》悄然易手。",
      sceneType: "document_evidence",
      narrationText: "《朴茨茅斯和约》悄然易手。",
      visualIntent: "用条约纸张展示证据，强调权益转移。",
      visualIntentData: {
        type: "document_evidence",
        action: "show_evidence",
        evidenceType: "document",
        highlightWords: ["朴茨茅斯和约", "转让"],
      },
      templateId: "DocumentReveal",
      durationSec: 6,
      fromFrame: 0,
      durationInFrames: 180,
      keywords: ["朴茨茅斯和约", "转让"],
      visualLayer: {
        type: "template",
        templateId: "DocumentReveal",
        reason: "默认示例使用模板镜头",
      },
      props: {
        title: "朴茨茅斯和约",
        subtitle: "历史文件",
        body: "条约上用词谨慎，所谓“转让”遮住了更复杂的权力关系。",
        sealText: "ARCHIVE",
        highlightWords: ["转让"],
        tone: "aged",
      },
    },
    {
      id: "scene-002",
      index: 1,
      text: "关东州租借地与南满铁路成为新的叙事中心。",
      sceneType: "geo_context",
      narrationText: "关东州租借地与南满铁路成为新的叙事中心。",
      visualIntent: "用地图说明港口、铁路和权益空间之间的关系。",
      visualIntentData: {
        type: "geo_context",
        action: "route",
        locations: ["关东州", "南满铁路"],
      },
      templateId: "AtlasMapFlyover",
      durationSec: 7,
      fromFrame: 180,
      durationInFrames: 210,
      keywords: ["关东州", "南满铁路"],
      props: {
        title: "关东州与南满铁路",
        subtitle: "地理利益被重新组织",
        textureSrc: "maps/natural-earth-world-4096.jpg",
        routeColor: "#f4d35e",
        overlayOpacity: 0.78,
      },
    },
  ],
} satisfies MultiSceneVideoProps;

export const MultiSceneVideo = ({
  scenes,
  audioSrc,
  captions = [],
  enableAudio = false,
  showCaptions = true,
  showSceneLabels = false,
  captionStyle = "typewriter",
  progressStyle = "gradient",
  ...layoutProps
}: MultiSceneVideoProps) => {
  const safeAudioSrc = normalizeStaticMediaPath(audioSrc);
  const canRenderAudio = enableAudio && safeAudioSrc && isLikelyMediaFile(safeAudioSrc);
  const progressSegments = buildProgressSegments(scenes);
  const displayCaptions = buildDisplayCaptions(scenes, captions);
  const captionLayout = resolveCaptionLayout(layoutProps);
  const progressLayout = resolveProgressLayout(layoutProps);

  return (
    <AbsoluteFill style={{ background: "#050505", overflow: "hidden" }}>
      {canRenderAudio ? <Audio src={staticFile(safeAudioSrc)} /> : null}
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.fromFrame} durationInFrames={scene.durationInFrames}>
          {renderSceneTemplate(scene)}
          {showSceneLabels ? (
            <div
              style={{
                position: "absolute",
                left: 26,
                bottom: 22,
                color: "rgba(255,255,255,0.76)",
                fontSize: 16,
                fontFamily: "Inter, Arial, sans-serif",
                padding: "7px 10px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.42)",
              }}
            >
              {scene.index + 1}. {scene.templateId}
            </div>
          ) : null}
        </Sequence>
      ))}
      {showCaptions ? (
        <VideoInfrastructure
          captions={displayCaptions}
          captionStyle={captionStyle}
          progressStyle={progressStyle}
          progressSegments={progressSegments}
          captionLayout={captionLayout}
          progressLayout={progressLayout}
        />
      ) : (
        <VideoInfrastructure
          captions={[]}
          captionStyle="none"
          progressStyle={progressStyle}
          progressSegments={progressSegments}
          captionLayout={captionLayout}
          progressLayout={progressLayout}
        />
      )}
    </AbsoluteFill>
  );
};

export function resolveCaptionLayout(props: VideoInfrastructureLayoutProps): Required<CaptionLayout> {
  return {
    ...defaultCaptionLayout,
    ...definedLayout(props.captionLayout),
    ...definedLayout({
      left: props.captionLeft,
      right: props.captionRight,
      bottom: props.captionBottom,
      minHeight: props.captionMinHeight,
      paddingX: props.captionPaddingX,
      paddingY: props.captionPaddingY,
      fontSize: props.captionFontSize,
      borderRadius: props.captionBorderRadius,
      textColor: props.captionTextColor,
      backgroundColor: props.captionBackgroundColor,
      fontWeight: props.captionFontWeight,
      lineHeight: props.captionLineHeight,
    }),
  };
}

export function resolveProgressLayout(props: VideoInfrastructureLayoutProps): Required<ProgressLayout> {
  return {
    ...defaultProgressLayout,
    ...definedLayout(props.progressLayout),
    ...definedLayout({
      left: props.progressLeft,
      right: props.progressRight,
      bottom: props.progressBottom,
      height: props.progressHeight,
      gap: props.progressGap,
      paddingX: props.progressPaddingX,
      labelFontSize: props.progressLabelFontSize,
      minSegmentWidth: props.progressMinSegmentWidth,
    }),
  };
}

function definedLayout<T extends Record<string, number | string | undefined>>(value?: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, fieldValue] of Object.entries(value || {})) {
    if (typeof fieldValue === "string" && fieldValue.trim()) {
      out[key as keyof T] = fieldValue as T[keyof T];
    } else if (fieldValue != null && Number.isFinite(Number(fieldValue))) {
      out[key as keyof T] = Number(fieldValue) as T[keyof T];
    }
  }
  return out;
}

function buildProgressSegments(scenes: AutoScene[]): ProgressSegment[] {
  return scenes.map((scene, index) => {
    const startMs = Number(scene.audioStartMs ?? Math.round((scene.fromFrame / 30) * 1000));
    const endMs = Number(
      scene.audioEndMs ?? Math.round(((scene.fromFrame + scene.durationInFrames) / 30) * 1000),
    );
    return {
      id: scene.id,
      title: segmentTitle(scene, index),
      startMs,
      endMs: Math.max(endMs, startMs + 500),
      color: ["#f4d35e", "#4f8cff", "#7dd3fc", "#fca5a5", "#c4b5fd", "#86efac"][index % 6],
    };
  });
}

function buildDisplayCaptions(scenes: AutoScene[], captions: NarratedCaption[]): NarratedCaption[] {
  const sceneCaptions = scenes
    .map((scene, index) => {
      const startMs = Number(scene.audioStartMs ?? Math.round((scene.fromFrame / 30) * 1000));
      const endMs = Number(
        scene.audioEndMs ?? Math.round(((scene.fromFrame + scene.durationInFrames) / 30) * 1000),
      );
      const text = String(scene.narrationText || scene.text || "").trim();
      if (!text || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return null;
      }
      return {
        index: index + 1,
        startMs,
        endMs,
        text: normalizeCaptionText(text),
      };
    })
    .filter(Boolean) as NarratedCaption[];

  return sceneCaptions.length ? sceneCaptions : captions;
}

function segmentTitle(scene: AutoScene, index: number) {
  const title = String(scene.props?.title || scene.keywords?.[0] || scene.sceneType || `片段${index + 1}`)
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：,.!?;:]/g, "")
    .trim();
  return Array.from(title || `片段${index + 1}`).slice(0, 8).join("");
}

function normalizeCaptionText(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
