import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export interface ProductStageProps {
  title?: string;
  backgroundColor?: string;
  objectColor?: string;
  accentColor?: string;
  rotationSpeed?: number;
}

export function ProductStage({
  title = '三维产品舞台',
  backgroundColor = '#020617',
  objectColor = '#dbeafe',
  accentColor = '#38bdf8',
  rotationSpeed = 0.025,
}: ProductStageProps) {
  const frame = useCurrentFrame();
  const rotation = frame * rotationSpeed * 40;
  const floatY = Math.sin(frame / 18) * 14;
  const scale = interpolate(Math.sin(frame / 32), [-1, 1], [0.96, 1.04]);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle, #172554, ${backgroundColor})`, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '44%',
          width: 240,
          height: 240,
          marginLeft: -120,
          marginTop: -120 + floatY,
          transform: `rotateX(58deg) rotateZ(${rotation}deg) scale(${scale})`,
          transformStyle: 'preserve-3d',
          background: `linear-gradient(135deg, ${objectColor}, ${accentColor})`,
          borderRadius: 28,
          boxShadow: `0 38px 90px ${accentColor}66, inset 0 0 42px rgba(255,255,255,0.32)`,
          border: '1px solid rgba(255,255,255,0.24)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '44%',
          width: 420,
          height: 420,
          marginLeft: -210,
          marginTop: -210,
          borderRadius: '50%',
          border: `2px solid ${accentColor}`,
          opacity: 0.42,
          transform: `rotate(${frame * 0.35}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 72,
          textAlign: 'center',
          color: 'white',
          fontFamily: 'Inter, sans-serif',
          fontSize: 42,
          fontWeight: 900,
          textShadow: `0 0 24px ${accentColor}aa`,
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
}
