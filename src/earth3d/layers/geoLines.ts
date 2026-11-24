import * as THREE from "three";
import { lonLatToVector } from "../core/geo";
import { earthUniforms } from "../globe/materials/earthUniforms";
import { ATMOSPHERE_GLSL } from "../globe/materials/shaderChunks";

/** 一组折线：offsets[i]..offsets[i+1] 是第 i 条线的顶点；高度单位米。 */
export type PolylineSet = {
  offsets: Uint32Array | number[];
  lon: Float32Array | number[];
  lat: Float32Array | number[];
  height: Float32Array | number[];
};

/**
 * 贴地带状线的几何：每个点左右各一个顶点，真正的宽度在着色器里按像素展开。
 * origin 是网格原点，顶点相对它存放，避免 float32 精度问题。
 */
export const buildLineGeometry = (lines: PolylineSet, origin: THREE.Vector3, exaggeration = 1) => {
  const vertexCount = lines.lon.length;
  const positions = new Float32Array(vertexCount * 2 * 3);
  const tangents = new Float32Array(vertexCount * 2 * 3);
  const sides = new Float32Array(vertexCount * 2);
  // 沿线累计距离（公里），铁路的虚线、流光按它计算
  const along = new Float32Array(vertexCount * 2);
  const indices: number[] = [];
  const world: THREE.Vector3[] = [];
  const tangent = new THREE.Vector3();
  for (let line = 0; line < lines.offsets.length - 1; line++) {
    const start = lines.offsets[line];
    const end = lines.offsets[line + 1];
    world.length = 0;
    for (let k = start; k < end; k++) {
      world.push(lonLatToVector(lines.lon[k], lines.lat[k], (lines.height[k] / 1000) * exaggeration));
    }
    let distance = 0;
    for (let k = start; k < end; k++) {
      const local = k - start;
      if (local > 0) distance += world[local].distanceTo(world[local - 1]);
      tangent.subVectors(world[Math.min(world.length - 1, local + 1)], world[Math.max(0, local - 1)]).normalize();
      for (let side = 0; side < 2; side++) {
        const v = k * 2 + side;
        positions[v * 3] = world[local].x - origin.x;
        positions[v * 3 + 1] = world[local].y - origin.y;
        positions[v * 3 + 2] = world[local].z - origin.z;
        tangents.set([tangent.x, tangent.y, tangent.z], v * 3);
        sides[v] = side === 0 ? -1 : 1;
        along[v] = distance;
      }
      if (k < end - 1) {
        const a = k * 2;
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aTangent", new THREE.BufferAttribute(tangents, 3));
  geometry.setAttribute("aSide", new THREE.BufferAttribute(sides, 1));
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
};

/**
 * 按像素宽度画的贴地线：国界、战线、铁路等。随距离抬离地面一点，避免被地形遮住。
 * glowPx > 0 时线外再加一圈按像素衰减的光晕（uGlowPx、uGlowAlpha 可以随时改）。
 */
export const createLineMaterial = (color: THREE.ColorRepresentation, widthPx: number, opacity = 1, glowPx = 0, glowAlpha = 0) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      ...earthUniforms,
      uColor: { value: new THREE.Color(color) },
      uWidthPx: { value: widthPx },
      uOpacity: { value: opacity },
      uGlowPx: { value: glowPx },
      uGlowAlpha: { value: glowAlpha },
      // 虚线：一段长 uDashPx 像素（0 为实线），以 uDashSpeed 像素/秒沿线流动
      uDashPx: { value: 0 },
      uDashSpeed: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSide;
      attribute vec3 aTangent;
      attribute float aAlong;
      uniform vec3 uCameraPos;
      uniform float uPixelAngle;
      uniform float uWidthPx;
      uniform float uGlowPx;
      varying vec3 vWorld;
      varying float vAcross;
      varying float vAlong;
      varying float vPixelKm;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 up = normalize(world);
        float dist = length(uCameraPos - world);
        float pixelKm = dist * uPixelAngle;
        vec3 side = normalize(cross(aTangent, up));
        // 带宽 = 线宽 + 两侧光晕（光晕约 3 倍衰减宽度后可以忽略）
        float total = uWidthPx + 6.0 * uGlowPx;
        vec3 offset = side * aSide * pixelKm * total * 0.5 + up * (0.01 + dist * 0.0008);
        vWorld = world + offset;
        vAcross = aSide;
        vAlong = aAlong;
        vPixelKm = pixelKm;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + inverse(mat3(modelMatrix)) * offset, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uWidthPx;
      uniform float uGlowPx;
      uniform float uGlowAlpha;
      uniform float uDashPx;
      uniform float uDashSpeed;
      uniform float uTime;
      varying vec3 vWorld;
      varying float vAcross;
      varying float vAlong;
      varying float vPixelKm;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      ${ATMOSPHERE_GLSL}
      void main() {
        #include <logdepthbuf_fragment>
        float edge = 1.0 - smoothstep(0.6, 1.0, abs(vAcross));
        if (uGlowPx > 0.0) {
          // 到线中心的距离（像素）：实线部分抗锯齿，外面按指数衰减的光晕
          float px = abs(vAcross) * (uWidthPx + 6.0 * uGlowPx) * 0.5;
          float halfWidth = uWidthPx * 0.5;
          float core = 1.0 - smoothstep(halfWidth - 0.6, halfWidth + 0.6, px);
          float glow = exp(-max(px - halfWidth, 0.0) / uGlowPx) * uGlowAlpha;
          edge = max(core, glow);
        }
        if (uDashPx > 0.0) {
          float alongPx = vAlong / max(vPixelKm, 1e-6);
          edge *= step(fract((alongPx - uTime * uDashSpeed) / (2.0 * uDashPx)), 0.5);
        }
        // 线条也受空气透视影响，但只取一半，保证远处仍然清楚
        vec3 color = mix(uColor, e3dApplyHaze(uColor, vWorld), 0.5);
        gl_FragColor = vec4(color, uOpacity * edge);
        #include <colorspace_fragment>
      }
    `,
  });
