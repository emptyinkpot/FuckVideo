import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { NarratedCaption } from "./NarratedVideo";
import { type AutoScene, renderSceneTemplate } from "./sceneRegistry";

export type MultiSceneVideoProps = {
  title?: string;
  scenes: AutoScene[];
  audioSrc?: string;
  captions?: NarratedCaption[];
  showCaptions?: boolean;
  showSceneLabels?: boolean;
};

export const defaultMultiSceneVideoProps = {
  title: "自动镜头视频",
  audioSrc: "",
  captions: [],
  showCaptions: true,
  showSceneLabels: true,
  scenes: [
    {
      id: "scene-001",
      index: 0,
      text: "《朴茨茅斯和约》悄然易手。",
      sceneType: "document_evidence",
      narrationText: "《朴茨茅斯和约》悄然易手。",
      visualIntent: "用条约纸张展示证据，强调权益转移。",
      templateId: "DocumentReveal",
      durationSec: 6,
      fromFrame: 0,
      durationInFrames: 180,
      keywords: ["朴茨茅斯和约", "转让"],
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
} satisfies Required<MultiSceneVideoProps>;

export const MultiSceneVideo = ({
  scenes,
  audioSrc,
  captions = [],
  showCaptions = true,
  showSceneLabels = false,
}: MultiSceneVideoProps) => {
  const frame = useCurrentFrame();
  const timeMs = (frame / 30) * 1000;
  const caption = captions.find((item) => timeMs >= item.startMs && timeMs <= item.endMs);
  const captionOpacity = showCaptions && caption ? interpolate(frame % 12, [0, 6], [0.92, 1]) : 0;

  return (
    <AbsoluteFill style={{ background: "#050505", overflow: "hidden" }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
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
