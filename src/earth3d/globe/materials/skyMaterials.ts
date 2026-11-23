import * as THREE from "three";
import { EARTH_RADIUS_KM } from "../../core/geo";
import { earthUniforms } from "./earthUniforms";

/** 围绕相机的天空球：低空时是蓝天，升到太空后渐变为黑色。 */
export const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  depthTest: false,
  uniforms: { ...earthUniforms },
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    void main() {
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position.z = gl_Position.w * 0.9999;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uCameraPos;
    uniform vec3 uSunDir;
    varying vec3 vWorld;
    #include <common>
    vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
    void main() {
      float radius = ${EARTH_RADIUS_KM.toFixed(1)};
      vec3 dir = normalize(vWorld - uCameraPos);
      vec3 up = normalize(uCameraPos);
      float altitude = max(length(uCameraPos) - radius, 0.0);
      float mu = dot(dir, up);
      // 地平线随高度下沉
      float dip = -sqrt(2.0 * altitude / radius);
      float t = clamp((mu - dip) / (1.0 - dip), 0.0, 1.0);
      vec3 zenith = srgb(vec3(0.25, 0.43, 0.72));
      vec3 horizon = srgb(vec3(0.72, 0.80, 0.89));
      vec3 sky = mix(horizon, zenith, pow(t, 0.42));
      float sunUp = dot(up, uSunDir);
      vec3 dusk = srgb(vec3(0.85, 0.55, 0.35));
      sky = mix(mix(dusk, sky, smoothstep(0.0, 0.3, sunUp)), sky, t);
      float sunAmount = max(dot(dir, uSunDir), 0.0);
      sky += vec3(1.0, 0.85, 0.65) * pow(sunAmount, 10.0) * 0.25;
      sky += vec3(1.0, 0.95, 0.85) * smoothstep(0.99985, 0.99995, sunAmount) * 6.0;
      sky *= smoothstep(-0.25, 0.1, sunUp);
      float space = smoothstep(15.0, 90.0, altitude);
      vec3 color = mix(sky, vec3(0.0), space);
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }
  `,
});

/** 太空视角下地球边缘的大气辉光，只在受光一侧出现。 */
export const atmosphereMaterial = new THREE.ShaderMaterial({
  side: THREE.FrontSide,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { ...earthUniforms },
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uCameraPos;
    uniform vec3 uSunDir;
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      float radius = ${EARTH_RADIUS_KM.toFixed(1)};
      vec3 v = normalize(vWorld - uCameraPos);
      // 视线到地心的最近距离：越贴近地球边缘，穿过的大气越厚
      float closest = length(cross(uCameraPos, v));
      float glow = smoothstep(radius + 70.0, radius + 2.0, closest) * smoothstep(radius - 250.0, radius, closest);
      float lit = smoothstep(-0.3, 0.35, dot(normalize(vWorld), uSunDir));
      float altitude = length(uCameraPos) - radius;
      float fade = smoothstep(80.0, 400.0, altitude);
      vec3 color = vec3(0.30, 0.52, 1.0) * glow * lit * fade * 0.9;
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }
  `,
});

export const createStars = (count = 4000, seed = 7) => {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const z = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    positions.set([r * Math.cos(theta) * 150000, z * 150000, r * Math.sin(theta) * 150000], i * 3);
    const brightness = Math.pow(random(), 3) * 0.9 + 0.1;
    colors.set([brightness, brightness, brightness * (0.9 + random() * 0.2)], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
};
