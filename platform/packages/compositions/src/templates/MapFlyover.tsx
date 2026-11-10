import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const roads = [
  'M60 420 C180 360 210 240 360 220 C520 198 590 120 760 150 C910 178 970 310 1210 280',
  'M110 150 C260 210 330 315 455 332 C610 354 680 250 830 250 C990 250 1050 390 1190 430',
  'M180 620 C300 510 410 500 520 540 C650 588 745 494 820 410 C910 310 1040 230 1200 160',
  'M40 310 C220 330 320 410 420 480 C560 580 720 650 910 610 C1040 582 1110 520 1240 550',
];

export interface MapFlyoverProps {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  routeColor?: string;
}

export function MapFlyover({
  title = '路线飞越',
  subtitle = '地图导航风格动画',
  backgroundColor = '#09111f',
  routeColor = '#06b6d4',
}: MapFlyoverProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = spring({ frame, fps, config: { damping: 90, stiffness: 120 } });
  const routeProgress = interpolate(frame, [32, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoom = interpolate(frame, [0, 210], [1.16, 0.96], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: backgroundColor, overflow: 'hidden', fontFamily: 'Inter, Arial, sans-serif' }}>
      <div
        style={{
          position: 'absolute',
          inset: -90,
          background:
            'radial-gradient(circle at 50% 45%, rgba(56,189,248,0.22), transparent 42%), linear-gradient(135deg, #0f766e, #172554 52%, #111827)',
        }}
      />
      <svg
        viewBox="0 0 1280 720"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          transform: `perspective(900px) rotateX(50deg) rotateZ(-7deg) scale(${zoom})`,
          transformOrigin: '50% 58%',
          opacity: intro,
        }}
      >
        <rect x="0" y="0" width="1280" height="720" fill="#d9eee7" />
        {roads.map((road) => (
          <path key={road} d={road} fill="none" stroke="#f8fafc" strokeWidth="34" strokeLinecap="round" opacity="0.82" />
        ))}
        {roads.map((road) => (
          <path
            key={`${road}-line`}
            d={road}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="3"
            strokeDasharray="12 16"
            strokeLinecap="round"
            opacity="0.56"
          />
        ))}
        <path
          d="M210 424 C320 382 400 332 510 332 C640 332 698 252 820 252 C960 252 1008 340 1080 388"
          fill="none"
          stroke={routeColor}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - routeProgress}
        />
      </svg>
      <div style={{ position: 'absolute', left: 76, top: 64, color: 'white', opacity: intro }}>
        <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1 }}>{title}</div>
        <div style={{ marginTop: 14, fontSize: 24, color: '#bae6fd', fontWeight: 700 }}>{subtitle}</div>
      </div>
    </AbsoluteFill>
  );
}
