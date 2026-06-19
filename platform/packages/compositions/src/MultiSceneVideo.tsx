import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import type { Scene } from '@huasheng-clone/schemas';
import { CaptionOverlay, ProgressBar, type Caption, type ProgressSegment } from './infrastructure';
import { normalizeStaticMediaPath } from './media';
import { FootageScene } from './templates/FootageScene';
import { MapFlyover } from './templates/MapFlyover';
import { NarratedVideo } from './templates/NarratedVideo';
import { ProductStage } from './templates/ProductStage';

export interface MultiSceneVideoProps {
  title?: string;
  scenes: Scene[];
  audioSrc?: string;
  enableAudio?: boolean;
  showCaptions?: boolean;
  showSceneLabels?: boolean;
  captionStyle?: 'typewriter' | 'classic' | 'none';
  progressStyle?: 'gradient' | 'thin' | 'none';
}

export const defaultMultiSceneVideoProps: MultiSceneVideoProps = {
  title: '自动镜头视频',
  audioSrc: '',
  enableAudio: false,
  showCaptions: true,
  showSceneLabels: true,
  captionStyle: 'typewriter',
  progressStyle: 'gradient',
  scenes: [
    {
      id: 'scene-001',
      text: '花生 AI 的核心体验，是把一段文字拆成可视化镜头。',
      durationFrames: 150,
      templateId: 'narrated-video',
      templateProps: {
        title: '文本生成视频',
        subtitle: 'Stage 1 核心容器',
        bodyText: '花生 AI 的核心体验，是把一段文字拆成可视化镜头。',
      },
      visualHint: 'AI video storyboard',
      keywords: ['AI', '分镜', '视频'],
      matchedAssets: [],
      subtitles: [{ startMs: 0, endMs: 5000, text: '花生 AI 的核心体验，是把一段文字拆成可视化镜头。' }],
    },
    {
      id: 'scene-002',
      text: 'Remotion 负责把这些镜头合成为稳定的 1080P 视频。',
      durationFrames: 150,
      templateId: 'product-stage',
      templateProps: { title: 'Remotion 渲染' },
      visualHint: 'render pipeline',
      keywords: ['Remotion', '渲染'],
      matchedAssets: [],
      subtitles: [{ startMs: 0, endMs: 5000, text: 'Remotion 负责把这些镜头合成为稳定的 1080P 视频。' }],
    },
  ],
};

export function MultiSceneVideo({
  scenes,
  audioSrc,
  enableAudio = false,
  showCaptions = true,
  showSceneLabels = false,
  captionStyle = 'typewriter',
  progressStyle = 'gradient',
}: MultiSceneVideoProps) {
  const safeAudioSrc = normalizeStaticMediaPath(audioSrc);
  const timeline = buildTimeline(scenes);

  return (
    <AbsoluteFill style={{ background: '#050505', overflow: 'hidden' }}>
      {enableAudio && safeAudioSrc ? <Audio src={staticFile(safeAudioSrc)} /> : null}
      {timeline.map(({ scene, from, durationInFrames }) => (
        <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
          {renderScene(scene)}
          {showSceneLabels ? <SceneLabel scene={scene} /> : null}
        </Sequence>
      ))}
      {showCaptions ? <CaptionOverlay captions={buildCaptions(timeline)} style={captionStyle} /> : null}
      <ProgressBar segments={buildProgressSegments(timeline)} style={progressStyle} />
    </AbsoluteFill>
  );
}

function renderScene(scene: Scene) {
  const props = scene.templateProps || {};
  switch (scene.templateId) {
    case 'footage-scene':
      return <FootageScene {...props} title={String(props.title || scene.keywords[0] || '素材镜头')} />;
    case 'map-flyover':
    case 'atlas-map-flyover':
      return <MapFlyover {...props} title={String(props.title || scene.keywords[0] || '地图镜头')} />;
    case 'product-stage':
    case 'three-product-stage':
      return <ProductStage {...props} title={String(props.title || scene.keywords[0] || '三维镜头')} />;
    case 'narrated-video':
    default:
      return (
        <NarratedVideo
          {...props}
          title={String(props.title || scene.keywords[0] || '叙事镜头')}
          bodyText={String(props.bodyText || scene.text)}
        />
      );
  }
}

function SceneLabel({ scene }: { scene: Scene }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 26,
        bottom: 22,
        color: 'rgba(255,255,255,0.76)',
        fontSize: 16,
        fontFamily: 'Inter, Arial, sans-serif',
        padding: '7px 10px',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.42)',
      }}
    >
      {scene.id} · {scene.templateId}
    </div>
  );
}

function buildTimeline(scenes: Scene[]) {
  let cursor = 0;
  return scenes.map((scene) => {
    const durationInFrames = Math.max(30, scene.durationFrames);
    const item = { scene, from: cursor, durationInFrames };
    cursor += durationInFrames;
    return item;
  });
}

function buildCaptions(timeline: ReturnType<typeof buildTimeline>): Caption[] {
  const out: Caption[] = [];
  for (const item of timeline) {
    const sceneStartMs = Math.round((item.from / 30) * 1000);
    if (item.scene.subtitles.length > 0) {
      for (const subtitle of item.scene.subtitles) {
        out.push({
          startMs: sceneStartMs + subtitle.startMs,
          endMs: sceneStartMs + subtitle.endMs,
          text: subtitle.text,
        });
      }
      continue;
    }
    out.push({
      startMs: sceneStartMs,
      endMs: sceneStartMs + Math.round((item.durationInFrames / 30) * 1000),
      text: item.scene.text,
    });
  }
  return out;
}

function buildProgressSegments(timeline: ReturnType<typeof buildTimeline>): ProgressSegment[] {
  const colors = ['#f4d35e', '#4f8cff', '#7dd3fc', '#fca5a5', '#c4b5fd', '#86efac'] as const;
  return timeline.map((item, index) => {
    const startMs = Math.round((item.from / 30) * 1000);
    const endMs = Math.round(((item.from + item.durationInFrames) / 30) * 1000);
    return {
      id: item.scene.id,
      title: segmentTitle(item.scene, index),
      startMs,
      endMs,
      color: colors[index % colors.length] ?? '#f4d35e',
    };
  });
}

function segmentTitle(scene: Scene, index: number) {
  const raw = String(scene.templateProps?.title || scene.keywords[0] || scene.templateId || `片段${index + 1}`);
  return Array.from(raw.replace(/[，。！？、；：,.!?;:\s]/g, '') || `片段${index + 1}`)
    .slice(0, 8)
    .join('');
}
