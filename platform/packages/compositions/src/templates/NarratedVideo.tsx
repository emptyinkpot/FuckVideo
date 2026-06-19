import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export interface NarratedVideoProps {
  title?: string;
  subtitle?: string;
  bodyText?: string;
  theme?: 'historical' | 'clean';
}

const fallbackText =
  '输入文本后，系统会生成旁白、字幕和镜头，再由 Remotion 渲染成视频。';

export function NarratedVideo({
  title = 'AI 视频创作智能体',
  subtitle = '文本生成分镜、配音与画面',
  bodyText = fallbackText,
  theme = 'historical',
}: NarratedVideoProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames - 1);
  const lines = splitText(bodyText);
  const isHistorical = theme === 'historical';
  const headlineIn = interpolate(frame, [0, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: isHistorical ? '#090b0d' : '#f5f2eb',
        color: isHistorical ? '#f8fafc' : '#171717',
        fontFamily: 'Inter, Microsoft YaHei, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <AbsoluteFill
        style={{
          background: isHistorical
            ? 'radial-gradient(circle at 72% 28%, rgba(250,204,21,0.24), transparent 30%), linear-gradient(90deg, rgba(3,7,18,0.96) 0%, rgba(3,7,18,0.72) 48%, rgba(3,7,18,0.28) 100%)'
            : 'radial-gradient(circle at 72% 28%, rgba(244,63,94,0.18), transparent 32%), linear-gradient(90deg, rgba(245,242,235,0.97) 0%, rgba(245,242,235,0.8) 46%, rgba(245,242,235,0.3) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 62,
          top: 54,
          width: 760,
          opacity: headlineIn,
          transform: `translateY(${interpolate(headlineIn, [0, 1], [24, 0])}px)`,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: isHistorical ? '#facc15' : '#8a5a20',
            marginBottom: 16,
          }}
        >
          智能分镜
        </div>
        <h1 style={{ margin: 0, fontSize: 62, lineHeight: 1.05, letterSpacing: 0, fontWeight: 950 }}>
          {title}
        </h1>
        {subtitle ? (
          <div
            style={{
              marginTop: 18,
              fontSize: 26,
              lineHeight: 1.35,
              color: isHistorical ? '#bfdbfe' : '#5f5547',
              fontWeight: 750,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ position: 'absolute', left: 64, top: 318, width: 740, display: 'grid', gap: 14 }}>
        {lines.map((line, index) => {
          const from = 42 + index * 14;
          const opacity = interpolate(frame, [from, from + 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={`${line}-${index}`}
              style={{
                opacity,
                transform: `translateY(${interpolate(opacity, [0, 1], [18, 0])}px)`,
                fontSize: 24,
                lineHeight: 1.55,
                color: isHistorical ? 'rgba(248,250,252,0.86)' : 'rgba(23,23,23,0.78)',
                textShadow: isHistorical ? '0 0 20px rgba(0,0,0,0.82)' : 'none',
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 86,
          bottom: 88,
          width: 300,
          height: 300,
          borderRadius: '50%',
          border: `2px solid ${isHistorical ? 'rgba(250,204,21,0.36)' : 'rgba(138,90,32,0.28)'}`,
          transform: `scale(${interpolate(progress, [0, 1], [0.9, 1.08])}) rotate(${progress * 24}deg)`,
          boxShadow: isHistorical ? '0 0 80px rgba(250,204,21,0.18)' : '0 0 80px rgba(138,90,32,0.12)',
        }}
      />
    </AbsoluteFill>
  );
}

function splitText(value: string): string[] {
  const text = (value || fallbackText).replace(/\s+/g, '');
  const chunks = text.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [text];
  return chunks.map((chunk) => chunk.trim()).filter(Boolean).slice(0, 8);
}
