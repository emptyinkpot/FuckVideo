import { ThreeCanvas } from "@remotion/three";
import { useLoader } from "@react-three/fiber";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

type GlobeRoute = {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  color?: string;
  startFrame?: number;
  endFrame?: number;
};

type GlobePin = {
  lat: number;
  lon: number;
  label: string;
  color?: string;
};

type ConflictZone = {
  label: string;
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
  color?: string;
  opacity?: number;
};

export type EarthGlobeProps = {
  textureSrc?: string;
  title?: string;
  subtitle?: string;
  rotationSpeed?: number;
  startRotation?: number;
  axialTiltDegrees?: number;
  globeRadius?: number;
  cameraDistance?: number;
  cameraFov?: number;
  ambientIntensity?: number;
  sunIntensity?: number;
  sunColor?: string;
  atmosphereColor?: string;
  atmosphereOpacity?: number;
  routeAltitude?: number;
  routeThickness?: number;
  pins?: GlobePin[];
  routes?: GlobeRoute[];
  conflictZones?: ConflictZone[];
  conflictLineThickness?: number;
  conflictAltitude?: number;
  pinSize?: number;
  pinPulseSize?: number;
  showStars?: boolean;
  showParticles?: boolean;
  particleCount?: number;
  particleColor?: string;
  rimLightColor?: string;
  rimLightIntensity?: number;
  showOverlayText?: boolean;
};

const DEFAULT_PINS: GlobePin[] = [
  { lat: 40.7128, lon: -74.006, label: "纽约", color: "#38bdf8" },
  { lat: 51.5074, lon: -0.1278, label: "伦敦", color: "#f97316" },
  { lat: 35.6762, lon: 139.6503, label: "东京", color: "#a78bfa" },
];

const DEFAULT_ROUTES: GlobeRoute[] = [
  {
    fromLat: 40.7128,
    fromLon: -74.006,
    toLat: 51.5074,
    toLon: -0.1278,
    color: "#f97316",
    startFrame: 28,
    endFrame: 132,
  },
  {
    fromLat: 51.5074,
    fromLon: -0.1278,
    toLat: 35.6762,
    toLon: 139.6503,
    color: "#38bdf8",
    startFrame: 104,
    endFrame: 214,
  },
];

const latLonToVector = (lat: number, lon: number, radius: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
};

const makeArcPoints = (
  route: GlobeRoute,
  radius: number,
  altitude: number,
  progress: number,
) => {
  const from = latLonToVector(route.fromLat, route.fromLon, radius);
  const to = latLonToVector(route.toLat, route.toLon, radius);
  const segments = 96;
  const visibleSegments = Math.max(2, Math.floor(segments * progress));
  const points: THREE.Vector3[] = [];

  for (let index = 0; index <= visibleSegments; index++) {
    const t = index / segments;
    const point = from.clone().lerp(to, t).normalize();
    const arcLift = Math.sin(Math.PI * t) * altitude;
    points.push(point.multiplyScalar(radius + arcLift));
  }

  return points;
};

const makeSurfaceLine = (
  points: Array<{ lat: number; lon: number }>,
  radius: number,
  altitude: number,
) => points.map((point) => latLonToVector(point.lat, point.lon, radius + altitude));

const makeConflictZoneSegments = (zone: ConflictZone, radius: number, altitude: number) => {
  const steps = 26;
  const top = Array.from({ length: steps + 1 }, (_, index) => ({
    lat: zone.latMax,
    lon: zone.lonMin + ((zone.lonMax - zone.lonMin) * index) / steps,
  }));
  const right = Array.from({ length: steps + 1 }, (_, index) => ({
    lat: zone.latMax + ((zone.latMin - zone.latMax) * index) / steps,
    lon: zone.lonMax,
  }));
  const bottom = Array.from({ length: steps + 1 }, (_, index) => ({
    lat: zone.latMin,
    lon: zone.lonMax + ((zone.lonMin - zone.lonMax) * index) / steps,
  }));
  const left = Array.from({ length: steps + 1 }, (_, index) => ({
    lat: zone.latMin + ((zone.latMax - zone.latMin) * index) / steps,
    lon: zone.lonMin,
  }));
  const lines = [top, right, bottom, left];

  return lines.map((line) => makeSurfaceLine(line, radius, altitude));
};

const DashedSurfaceLine = ({
  points,
  color,
  opacity,
  thickness,
}: {
  points: THREE.Vector3[];
  color: string;
  opacity: number;
  thickness: number;
}) => {
  const dashMeshes: React.ReactNode[] = [];

  for (let index = 0; index < points.length - 1; index += 2) {
    const segment = [points[index], points[index + 1]];
    dashMeshes.push(
      <mesh key={index}>
        <tubeGeometry args={[new THREE.CatmullRomCurve3(segment), 4, thickness, 6, false]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>,
    );
  }

  return <>{dashMeshes}</>;
};

const Stars = ({ count = 140 }: { count?: number }) => {
  const stars = Array.from({ length: count }, (_, index) => {
    const angle = index * 2.399963229728653;
    const y = -1 + (2 * index) / count;
    const radius = Math.sqrt(1 - y * y);

    return {
      x: Math.cos(angle) * radius * 18,
      y: y * 10,
      z: Math.sin(angle) * radius * 18,
      size: 0.014 + (index % 5) * 0.004,
    };
  });

  return (
    <>
      {stars.map((star, index) => (
        <mesh key={index} position={[star.x, star.y, star.z]}>
          <sphereGeometry args={[star.size, 8, 8]} />
          <meshBasicMaterial color="#e5f2ff" />
        </mesh>
      ))}
    </>
  );
};

const OrbitalParticles = ({
  count = 80,
  color = "#fbbf24",
  radius = 3.15,
}: {
  count?: number;
  color?: string;
  radius?: number;
}) => {
  const frame = useCurrentFrame();
  const particles = Array.from({ length: count }, (_, index) => {
    const lane = (index % 7) - 3;
    const angle = index * 1.618 + frame * 0.014 * (1 + (index % 5) * 0.12);
    const orbitRadius = radius + (index % 5) * 0.08;

    return {
      x: Math.cos(angle) * orbitRadius,
      y: lane * 0.18 + Math.sin(angle * 0.7) * 0.08,
      z: Math.sin(angle) * orbitRadius,
      size: 0.018 + (index % 4) * 0.006,
    };
  });

  return (
    <>
      {particles.map((particle, index) => (
        <mesh key={index} position={[particle.x, particle.y, particle.z]}>
          <sphereGeometry args={[particle.size, 10, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0.78} />
        </mesh>
      ))}
    </>
  );
};

const GlobeScene = ({
  textureSrc = "maps/natural-earth-world-8192.jpg",
  rotationSpeed = 0.006,
  startRotation = -0.7,
  axialTiltDegrees = 23.5,
  globeRadius = 2.25,
  ambientIntensity = 0.6,
  sunIntensity = 2.2,
  sunColor = "#ffffff",
  atmosphereColor = "#60a5fa",
  atmosphereOpacity = 0.18,
  routeAltitude = 0.72,
  routeThickness = 0.018,
  pins = DEFAULT_PINS,
  routes = DEFAULT_ROUTES,
  conflictZones = [],
  conflictLineThickness = 0.014,
  conflictAltitude = 0.08,
  pinSize = 0.045,
  pinPulseSize = 0.08,
  showStars = true,
  showParticles = false,
  particleCount = 80,
  particleColor = "#fbbf24",
  rimLightColor = "#60a5fa",
  rimLightIntensity = 1.1,
}: EarthGlobeProps) => {
  const frame = useCurrentFrame();
  const texture = useLoader(THREE.TextureLoader, staticFile(textureSrc));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const tilt = axialTiltDegrees * (Math.PI / 180);
  const rotationY = startRotation + frame * rotationSpeed;

  return (
    <>
      {showStars ? <Stars /> : null}
      {showParticles ? <OrbitalParticles count={particleCount} color={particleColor} radius={globeRadius * 1.42} /> : null}
      <ambientLight intensity={ambientIntensity} />
      <directionalLight position={[5, 3, 5]} intensity={sunIntensity} color={sunColor} />
      <pointLight position={[-4, -2, 4]} intensity={0.8} color="#38bdf8" />
      <pointLight position={[-5, 2, -4]} intensity={rimLightIntensity} color={rimLightColor} />
      <group rotation={[tilt, rotationY, 0]}>
        <mesh>
          <sphereGeometry args={[globeRadius, 128, 128]} />
          <meshStandardMaterial map={texture} roughness={0.82} metalness={0.02} />
        </mesh>
        <mesh scale={1.018}>
          <sphereGeometry args={[globeRadius, 128, 128]} />
          <meshBasicMaterial color={atmosphereColor} transparent opacity={atmosphereOpacity} side={THREE.BackSide} />
        </mesh>
        {routes.map((route, index) => {
          const startFrame = route.startFrame ?? 30;
          const endFrame = route.endFrame ?? 170;
          const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const points = makeArcPoints(route, globeRadius * 1.01, routeAltitude, progress);

          if (points.length < 2) {
            return null;
          }

          return (
            <mesh key={`${route.fromLon}-${route.toLon}-${index}`}>
              <tubeGeometry args={[new THREE.CatmullRomCurve3(points), 72, routeThickness, 8, false]} />
              <meshBasicMaterial color={route.color ?? "#f97316"} />
            </mesh>
          );
        })}
        {conflictZones.map((zone) => {
          const lines = makeConflictZoneSegments(zone, globeRadius * 1.012, conflictAltitude);

          return (
            <group key={zone.label}>
              {lines.map((line, index) => (
                <DashedSurfaceLine
                  key={`${zone.label}-${index}`}
                  points={line}
                  color={zone.color ?? "#ef4444"}
                  opacity={zone.opacity ?? 0.9}
                  thickness={conflictLineThickness}
                />
              ))}
            </group>
          );
        })}
        {pins.map((pin) => {
          const position = latLonToVector(pin.lat, pin.lon, globeRadius * 1.045);

          return (
            <group key={pin.label} position={position}>
              <mesh>
                <sphereGeometry args={[pinSize, 16, 16]} />
                <meshBasicMaterial color={pin.color ?? "#f97316"} />
              </mesh>
              <mesh position={[0, 0.085, 0]}>
                <sphereGeometry args={[pinPulseSize, 16, 16]} />
                <meshBasicMaterial color={pin.color ?? "#f97316"} transparent opacity={0.22} />
              </mesh>
            </group>
          );
        })}
      </group>
    </>
  );
};

export const EarthGlobe = ({
  title = "全球航线网络",
  subtitle = "Natural Earth 球面地图纹理",
  cameraDistance = 6.2,
  cameraFov = 36,
  showOverlayText = true,
  ...sceneProps
}: EarthGlobeProps) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const textOpacity = interpolate(frame, [12, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 45%, #172554 0%, #020617 62%, #000 100%)",
        overflow: "hidden",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 0.15, cameraDistance], fov: cameraFov }}>
        <GlobeScene {...sceneProps} />
      </ThreeCanvas>
      {showOverlayText ? (
        <div
          style={{
            position: "absolute",
            left: 70,
            bottom: 58,
            color: "white",
            opacity: textOpacity,
            textShadow: "0 0 30px rgba(0,0,0,0.65)",
          }}
        >
          <div style={{ fontSize: 54, fontWeight: 900, lineHeight: 1 }}>{title}</div>
          <div style={{ marginTop: 14, fontSize: 23, color: "#bfdbfe", fontWeight: 800 }}>
            {subtitle}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
