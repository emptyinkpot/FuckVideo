import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const orbit = (frame: number, radius: number, speed: number, offset = 0) => {
  const angle = frame * speed + offset;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
};

export type ThreeProductStageProps = {
  title?: string;
  backgroundColor?: string;
  objectColor?: string;
  accentColor?: string;
  rotationSpeed?: number;
};

export const ThreeProductStage = ({
  title = "三维产品舞台",
  backgroundColor = "#020617",
  objectColor = "#dbeafe",
  accentColor = "#38bdf8",
  rotationSpeed = 0.025,
}: ThreeProductStageProps) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const rotation = frame * rotationSpeed;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle, #172554, ${backgroundColor})` }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 1.6, 7], fov: 42 }}>
        <ambientLight intensity={0.42} />
        <directionalLight position={[4, 6, 4]} intensity={1.4} />
        <pointLight position={[-3, 2, 4]} intensity={2} color={accentColor} />
        <pointLight position={[3, -1, 2]} intensity={2.4} color="#f472b6" />
        <mesh rotation={[0.45, rotation, 0.15]}>
          <boxGeometry args={[2.2, 2.2, 2.2]} />
          <meshStandardMaterial color={objectColor} roughness={0.25} metalness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.55, 0]}>
          <torusGeometry args={[2.4, 0.035, 12, 128]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
      </ThreeCanvas>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 72,
          textAlign: "center",
          color: "white",
          fontFamily: "Inter, sans-serif",
          fontSize: 42,
          fontWeight: 900,
          textShadow: `0 0 24px ${accentColor}aa`,
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};

export type ThreeBouncingSpheresProps = {
  sphereCount?: number;
  backgroundColor?: string;
  bounceStrength?: number;
  cameraDistance?: number;
};

export const ThreeBouncingSpheres = ({
  sphereCount = 4,
  backgroundColor = "#030712",
  bounceStrength = 3.2,
  cameraDistance = 8,
}: ThreeBouncingSpheresProps) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const spheres = [
    { x: -2.1, z: 0, delay: 0, color: "#38bdf8" },
    { x: -0.7, z: -0.4, delay: 14, color: "#a78bfa" },
    { x: 0.8, z: 0.25, delay: 28, color: "#fb7185" },
    { x: 2.1, z: -0.2, delay: 42, color: "#34d399" },
  ].slice(0, sphereCount);

  return (
    <AbsoluteFill style={{ background: backgroundColor }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 2.2, cameraDistance], fov: 42 }}>
        <ambientLight intensity={0.16} />
        <directionalLight position={[5, 7, 6]} intensity={1.2} />
        <pointLight position={[0, 2, 3]} intensity={2.4} color="#ffffff" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.7, 0]}>
          <planeGeometry args={[8, 4]} />
          <meshStandardMaterial color="#111827" roughness={0.6} metalness={0.2} />
        </mesh>
        {spheres.map((sphere) => {
          const t = Math.max(0, (frame - sphere.delay) / fps);
          const bounce = Math.abs(Math.sin(t * 3.2));
          const y = -1.15 + bounce * bounceStrength * Math.exp(-t * 0.07);
          const squash = interpolate(bounce, [0, 0.18, 1], [0.72, 1, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <mesh
              key={sphere.color}
              position={[sphere.x, y, sphere.z]}
              scale={[1.1 / squash, squash, 1.1 / squash]}
            >
              <sphereGeometry args={[0.48, 48, 48]} />
              <meshStandardMaterial color={sphere.color} roughness={0.18} metalness={0.55} />
            </mesh>
          );
        })}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export type ThreeParticleNebulaProps = {
  particleCount?: number;
  backgroundColor?: string;
  coreColor?: string;
  orbitSpeed?: number;
};

export const ThreeParticleNebula = ({
  particleCount = 90,
  backgroundColor = "#020617",
  coreColor = "#67e8f9",
  orbitSpeed = 0.012,
}: ThreeParticleNebulaProps) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const points = Array.from({ length: particleCount }, (_, index) => ({
    radius: 0.8 + (index % 18) * 0.16,
    y: -2.1 + (index % 15) * 0.3,
    offset: index * 0.71,
    color: index % 3 === 0 ? "#22d3ee" : index % 3 === 1 ? "#e879f9" : "#fde047",
  }));

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle, #111827, ${backgroundColor})` }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 0.2, 7.2], fov: 48 }}>
        <ambientLight intensity={0.55} />
        <pointLight position={[0, 0, 2]} intensity={2.1} color="#ffffff" />
        {points.map((point, index) => {
          const [x, z] = orbit(frame, point.radius, orbitSpeed + (index % 7) * 0.001, point.offset);

          return (
            <mesh key={`${point.offset}-${point.radius}`} position={[x, point.y, z]}>
              <sphereGeometry args={[0.045 + (index % 4) * 0.012, 16, 16]} />
              <meshBasicMaterial color={point.color} />
            </mesh>
          );
        })}
        <mesh rotation={[frame * 0.006, frame * 0.014, 0]}>
          <torusKnotGeometry args={[1.2, 0.08, 180, 12]} />
          <meshStandardMaterial color={coreColor} roughness={0.25} metalness={0.9} />
        </mesh>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export type ThreeCardCascadeProps = {
  titleLine1?: string;
  titleLine2?: string;
  cardCount?: number;
  backgroundColor?: string;
};

export const ThreeCardCascade = ({
  titleLine1 = "三维卡片",
  titleLine2 = "级联动画",
  cardCount = 12,
  backgroundColor = "#09090b",
}: ThreeCardCascadeProps) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cards = Array.from({ length: cardCount }, (_, index) => index);

  return (
    <AbsoluteFill style={{ background: backgroundColor }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 0, 8], fov: 46 }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[0, 4, 6]} intensity={1.4} />
        {cards.map((card) => {
          const y = ((frame * 0.018 + card * 0.72) % 8) - 4;
          const x = card % 2 === 0 ? -1.45 : 1.45;
          const z = -((card % 6) * 0.35);
          const rotationY = (card % 2 === 0 ? 0.45 : -0.45) + Math.sin(frame / 40 + card) * 0.08;
          const color = card % 3 === 0 ? "#38bdf8" : card % 3 === 1 ? "#a78bfa" : "#fb7185";

          return (
            <mesh key={card} position={[x, y, z]} rotation={[0.15, rotationY, 0]}>
              <boxGeometry args={[2.0, 0.72, 0.045]} />
              <meshStandardMaterial color={color} roughness={0.28} metalness={0.35} />
            </mesh>
          );
        })}
      </ThreeCanvas>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 86,
          color: "white",
          fontFamily: "Inter, sans-serif",
          fontSize: 58,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {titleLine1}
        <br />
        {titleLine2}
      </div>
    </AbsoluteFill>
  );
};
