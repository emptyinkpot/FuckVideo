import * as THREE from "three";
import { EARTH_RADIUS_KM, lonLatToVector, vectorToLonLat } from "../core/geo";
import { earthUniforms } from "../globe/materials/earthUniforms";
import { ATMOSPHERE_GLSL } from "../globe/materials/shaderChunks";
import { sampleHeight } from "../globe/terrain/tileStore";
import { buildLineGeometry, type PolylineSet } from "../layers/geoLines";

/** 战线、箭头的网格原点（东亚中部）。 */
export const WAR_ORIGIN = lonLatToVector(115, 35, 0);

/** 沿大圆把两点之间加密，每段不超过 stepKm。 */
const greatCircle = (from: [number, number], to: [number, number], stepKm: number) => {
  const a = lonLatToVector(from[0], from[1]).normalize();
  const b = lonLatToVector(to[0], to[1]).normalize();
  const omega = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  const steps = Math.max(2, Math.ceil((omega * EARTH_RADIUS_KM) / stepKm));
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p =
      omega < 1e-9
        ? a.clone()
        : a
            .clone()
            .multiplyScalar(Math.sin((1 - t) * omega) / Math.sin(omega))
            .addScaledVector(b, Math.sin(t * omega) / Math.sin(omega));
    const { lon, lat } = vectorToLonLat(p.multiplyScalar(EARTH_RADIUS_KM));
    points.push([lon, lat]);
  }
  return points;
};

/** 折线逐段按大圆加密后贴地：高度取已加载的地形分块。 */
export const drapedPolylines = (lines: Array<Array<[number, number]>>, stepKm = 3): PolylineSet => {
  const offsets = [0];
  const lon: number[] = [];
  const lat: number[] = [];
  const height: number[] = [];
  for (const line of lines) {
    const dense: Array<[number, number]> = [];
    for (let i = 0; i < line.length - 1; i++) {
      const segment = greatCircle(line[i], line[i + 1], stepKm);
      dense.push(...(i === 0 ? segment : segment.slice(1)));
    }
    for (const [x, y] of dense) {
      lon.push(x);
      lat.push(y);
      height.push(Math.max(0, sampleHeight(x, y)));
    }
    offsets.push(lon.length);
  }
  return { offsets, lon, lat, height };
};

export const buildFrontlineGeometry = (lines: Array<Array<[number, number]>>, exaggeration = 1) =>
  buildLineGeometry(drapedPolylines(lines), WAR_ORIGIN, exaggeration);

/**
 * 进攻箭头：贴地的大圆带，aT 为沿线位置（0 起点、1 终点）。
 * 着色器按 uProgress 只画到当前进度，末端 uHeadLength 一段收成箭头，箭头随进度前移。
 */
export const buildArrowGeometry = (from: [number, number], to: [number, number], exaggeration = 1) => {
  const path = drapedPolylines([[from, to]], 2);
  const geometry = buildLineGeometry(path, WAR_ORIGIN, exaggeration);
  const count = path.lon.length;
  const along = new Float32Array(count * 2);
  for (let k = 0; k < count; k++) {
    along[k * 2] = k / (count - 1);
    along[k * 2 + 1] = k / (count - 1);
  }
  geometry.setAttribute("aT", new THREE.BufferAttribute(along, 1));
  return geometry;
};

/** 进攻箭头材质。颜色、线宽、光晕由图层每帧按风格设置（uColor、uWidthPx、uGlowPx、uGlowAlpha）。 */
export const createArrowMaterial = (color: THREE.ColorRepresentation, widthPx = 9) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      ...earthUniforms,
      uColor: { value: new THREE.Color(color) },
      uWidthPx: { value: widthPx },
      uProgress: { value: 1 },
      uHeadLength: { value: 0.14 },
      uOpacity: { value: 1 },
      uGlowPx: { value: 0 },
      uGlowAlpha: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSide;
      attribute float aT;
      attribute vec3 aTangent;
      uniform vec3 uCameraPos;
      uniform float uPixelAngle;
      uniform float uWidthPx;
      uniform float uProgress;
      uniform float uHeadLength;
      uniform float uGlowPx;
      varying vec3 vWorld;
      varying float vAcross;
      varying float vVisible;
      varying float vCore;
      varying float vTotal;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 up = normalize(world);
        float dist = length(uCameraPos - world);
        float pixelKm = dist * uPixelAngle;
        float headStart = uProgress - uHeadLength;
        float width = uWidthPx;
        if (aT > headStart) width = uWidthPx * 2.8 * clamp((uProgress - aT) / uHeadLength, 0.0, 1.0);
        vVisible = step(aT, uProgress);
        vec3 side = normalize(cross(aTangent, up));
        // 带宽 = 箭身 + 两侧光晕；vCore 为箭身占带宽的比例
        float total = width + 6.0 * uGlowPx;
        vCore = width / max(total, 1e-3);
        vTotal = total;
        vec3 offset = side * aSide * pixelKm * total * 0.5 + up * (0.02 + dist * 0.001);
        vWorld = world + offset;
        vAcross = aSide;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + inverse(mat3(modelMatrix)) * offset, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uGlowPx;
      uniform float uGlowAlpha;
      varying vec3 vWorld;
      varying float vAcross;
      varying float vVisible;
      varying float vCore;
      varying float vTotal;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      ${ATMOSPHERE_GLSL}
      void main() {
        #include <logdepthbuf_fragment>
        if (vVisible < 0.5) discard;
        float a = abs(vAcross) / max(vCore, 1e-3);
        if (a <= 1.0) {
          // 箭身：边缘一圈深色描边，在亮、暗地表上都看得清
          vec3 color = mix(uColor, uColor * 0.35, smoothstep(0.72, 0.9, a));
          color = mix(color, e3dApplyHaze(color, vWorld), 0.4);
          gl_FragColor = vec4(color, uOpacity * (1.0 - smoothstep(0.92, 1.0, a)));
        } else {
          // 箭身外的光晕
          float px = (abs(vAcross) - vCore) * vTotal * 0.5;
          float glow = uGlowPx > 0.0 ? exp(-px / uGlowPx) * uGlowAlpha : 0.0;
          if (glow < 0.003) discard;
          gl_FragColor = vec4(uColor, uOpacity * glow);
        }
        #include <colorspace_fragment>
      }
    `,
  });
