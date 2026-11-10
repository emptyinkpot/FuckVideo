import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export interface Caption {
  startMs: number;
  endMs: number;
  text: string;
}

export interface ProgressSegment {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  color: string;
}

export interface CaptionOverlayProps {
  captions?: Caption[];
  style?: 'typewriter' | 'classic' | 'none';
}

export function CaptionOverlay({ captions = [], style = 'typewriter' }: CaptionOverlayProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (style === 'none') return null;

  const timeMs = (frame / fps) * 1000;
  const active = captions.find((caption) => timeMs >= caption.startMs && timeMs <= caption.endMs);
  if (!active) return null;

  const localProgress = (timeMs - active.startMs) / Math.max(1, active.endMs - active.startMs);
  const text =
    style === 'typewriter'
      ? Array.from(active.text).slice(0, Math.max(1, Math.ceil(active.text.length * localProgress))).join('')
      : active.text;

  return (
    <div
      style={{
        position: 'absolute',
        left: 78,
        right: 78,
        bottom: 36,
        minHeight: 62,
        padding: '12px 22px',
        color: '#f8fafc',
        fontFamily: 'Inter, Microsoft YaHei, Arial, sans-serif',
        fontSize: 30,
        fontWeight: 850,
        lineHeight: 1.22,
        textAlign: 'center',
        textShadow: '0 2px 18px rgba(0,0,0,0.78)',
        background: style === 'classic' ? 'rgba(0,0,0,0.48)' : 'transparent',
        borderRadius: style === 'classic' ? 12 : 0,
      }}
    >
      {text}
    </div>
  );
}

export interface ProgressBarProps {
  segments: ProgressSegment[];
  style?: 'gradient' | 'thin' | 'none';
}

export function ProgressBar({ segments, style = 'gradient' }: ProgressBarProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (style === 'none' || segments.length === 0) return null;

  const currentMs = (frame / fps) * 1000;
  const totalMs = Math.max((durationInFrames / fps) * 1000, segments.at(-1)?.endMs || 1);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: style === 'thin' ? 8 : 30,
        display: 'flex',
        gap: style === 'thin' ? 0 : 4,
        padding: style === 'thin' ? 0 : '0 0',
        background: style === 'thin' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.24)',
      }}
    >
      {segments.map((segment) => {
        const width = `${Math.max(1, ((segment.endMs - segment.startMs) / totalMs) * 100)}%`;
        const fill = interpolate(
          currentMs,
          [segment.startMs, segment.endMs],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        return (
          <div key={segment.id} style={{ width, minWidth: style === 'thin' ? 0 : 36, position: 'relative' }}>
            <div
              style={{
                width: `${fill * 100}%`,
                height: '100%',
                background:
                  style === 'gradient'
                    ? `linear-gradient(90deg, ${segment.color}, #ffffff)`
                    : segment.color,
                opacity: 0.88,
              }}
            />
            {style === 'gradient' ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.82)',
                  fontFamily: 'Inter, Arial, sans-serif',
                  fontSize: 13,
                  fontWeight: 800,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {segment.title}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
