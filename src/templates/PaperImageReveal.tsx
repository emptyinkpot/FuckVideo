import { useLoader, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

const move = (frame: number, fps: number, start: number, end: number) =>
  interpolate(frame / fps, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.2, 1),
  });

function PaperSurface({ imageSrc }: { imageSrc: string }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { camera, gl } = useThree();
  const src = /^(https?:|data:|blob:)/i.test(imageSrc) ? imageSrc : staticFile(imageSrc);
  const texture = useLoader(THREE.TextureLoader, src);
  const image = texture.image as HTMLImageElement;
  const aspect = image.naturalWidth / image.naturalHeight;
  const paperHeight = Math.min(4.28, (4.28 * width) / height / aspect);
  const paperWidth = paperHeight * aspect;
  const rise = move(frame, fps, 0, 1.85);
  const unfold = move(frame, fps, 0.12, 2.25);
  const settle = move(frame, fps, 1.15, 2.9);
  const dolly = move(frame, fps, 0.35, 2.9);
  const time = frame / fps;

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(paperWidth, paperHeight, 96, 128),
    [paperWidth, paperHeight],
  );
  const fiber = useMemo(() => {
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const grain = ((Math.imul(i + 1, 1664525) + 1013904223) >>> 12) & 63;
        const value = 112 + grain * 0.5 + Math.sin(x * 0.48 + y * 2.7) * 8;
        data.set([value, value, value, 255], i * 4);
      }
    }
    const map = new THREE.DataTexture(data, size, size);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(7, 7);
    map.needsUpdate = true;
    return map;
  }, []);

  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
  }, [texture, gl]);

  useLayoutEffect(() => {
    // A diagonal cylindrical bend preserves the paper's surface length.
    // The moving bend line releases the top edge gradually.
    const vertices = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const nx = 0.15;
    const ny = Math.sqrt(1 - nx * nx);
    const crease = paperHeight * (-0.08 + 1.25 * unfold);
    const curvature = (3.05 / paperHeight) * (1 - 0.58 * unfold);
    const flexWindow = Math.sin(
      Math.PI * interpolate(time, [0.65, 2.9], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ) ** 2;

    for (let i = 0; i < vertices.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      const x = (u - 0.5) * paperWidth;
      const y = (v - 0.5) * paperHeight;
      if (settle === 1) {
        vertices.setXYZ(i, x, y, 0);
        continue;
      }
      const distance = nx * x + ny * (y + paperHeight / 2);
      const rolled = Math.max(0, distance - crease);
      const angle = rolled * curvature;
      const along = Math.sin(angle) / curvature - rolled;
      const curl = (1 - Math.cos(angle)) / curvature;
      const flex = Math.sin(v * Math.PI) * Math.sin(time * 7 - v * 3 + u)
        * paperHeight * 0.012 * flexWindow;
      vertices.setXYZ(i, x + nx * along, y + ny * along, curl + flex);
    }
    vertices.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }, [geometry, paperWidth, paperHeight, unfold, settle, time]);

  useLayoutEffect(() => {
    camera.position.set(0.32 * (1 - dolly), 0.18 * (1 - dolly), 7.9 - dolly * 0.8);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }, [camera, dolly]);

  return (
    <>
      <ambientLight intensity={1.2} />
      <hemisphereLight args={["#ffffff", "#b9b0a1", 0.55]} />
      <directionalLight
        position={[-3.5 + dolly * 0.6, 5, 6]}
        intensity={2.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
        shadow-bias={-0.0003}
        shadow-normalBias={0.015}
        shadow-radius={3}
      />
      <directionalLight position={[4, -1, 3]} intensity={0.35} />
      <group
        name="paper-image-reveal"
        position={[-0.28 * (1 - rise), -paperHeight * 1.12 * (1 - rise), -0.45 * (1 - rise)]}
        rotation={[-1.05 * (1 - rise), 0.16 * (1 - settle), -0.055 * (1 - settle)]}
      >
        <mesh position={[0, 0, -0.055]} receiveShadow name="paper-soft-shadow">
          <planeGeometry args={[paperWidth * 1.55, paperHeight * 1.4]} />
          <shadowMaterial transparent opacity={0.24} />
        </mesh>
        <mesh geometry={geometry} castShadow receiveShadow name="paper-front">
          <meshStandardMaterial
            map={texture}
            roughness={0.92}
            metalness={0}
            bumpMap={fiber}
            bumpScale={0.003}
            side={THREE.FrontSide}
            shadowSide={THREE.DoubleSide}
          />
        </mesh>
        <mesh geometry={geometry} receiveShadow name="paper-back">
          <meshStandardMaterial
            color="#f4ecd9"
            roughness={1}
            metalness={0}
            bumpMap={fiber}
            bumpScale={0.004}
            side={THREE.BackSide}
          />
        </mesh>
      </group>
    </>
  );
}

export function PaperImageReveal({ imageSrc }: { imageSrc: string }) {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "transparent", overflow: "hidden" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 0, 7.9], fov: 40, near: 0.1, far: 40 }}
        shadows="soft"
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NoToneMapping }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <PaperSurface imageSrc={imageSrc} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
}
