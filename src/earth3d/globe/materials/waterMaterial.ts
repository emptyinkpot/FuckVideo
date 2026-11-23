import * as THREE from "three";
import { earthUniforms } from "./earthUniforms";
import { ATMOSPHERE_GLSL, NOISE_GLSL } from "./shaderChunks";

const vertexShader = /* glsl */ `
attribute float aDepth;
varying vec3 vWorld;
varying float vDepth;
#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vDepth = aDepth;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

/** 水面颜色：近岸浑浊偏黄绿（东亚沿海多泥沙），深水偏蓝；叠加天空反射与阳光高光。 */
export const WATER_SHADING_GLSL = /* glsl */ `
uniform float uTime;

vec3 e3dWaterNormal(vec3 p, vec3 up, float footprint) {
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), up) + vec3(1e-6));
  vec3 north = cross(up, east);
  float t = uTime;
  float dx = 0.0;
  float dy = 0.0;
  float wavelength = 0.12;
  float amp = 0.10;
  for (int i = 0; i < 3; i++) {
    float fade = 1.0 - smoothstep(wavelength * 0.3, wavelength * 1.5, footprint);
    vec3 q = p / wavelength + vec3(t * 0.15, 0.0, t * 0.11);
    float e = 0.15;
    float h0 = e3dNoise(q);
    dx += (e3dNoise(q + east * e) - h0) / e * amp * fade;
    dy += (e3dNoise(q + north * e) - h0) / e * amp * fade;
    wavelength *= 2.7;
    amp *= 0.8;
  }
  return normalize(up - east * dx - north * dy);
}

vec3 e3dWaterColor(vec3 p, float depth, vec3 shallow, vec3 deep) {
  vec3 up = normalize(p);
  float footprint = length(fwidth(p));
  vec3 n = e3dWaterNormal(p, up, footprint);
  vec3 v = normalize(uCameraPos - p);
  vec3 body = mix(shallow, deep, 1.0 - exp(-max(depth, 0.0) / 45.0));
  vec3 lit = body * e3dSunLight(up, up);
  float cosTheta = max(dot(n, v), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - cosTheta, 5.0);
  vec3 sky = e3dHazeColor(p) * 1.05;
  vec3 color = mix(lit, sky, fresnel * 0.6);
  float sunUp = smoothstep(-0.05, 0.1, dot(up, uSunDir));
  // 远看时水面细节被平均掉，高光不该是一块刺眼的白斑
  float specScale = mix(1.2, 0.25, smoothstep(0.3, 4.0, footprint));
  float spec = pow(max(dot(reflect(-uSunDir, n), v), 0.0), 400.0) * specScale * sunUp;
  color += vec3(1.0, 0.95, 0.85) * spec;
  return e3dApplyHaze(color, p);
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vWorld;
varying float vDepth;
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
${ATMOSPHERE_GLSL}
${WATER_SHADING_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  vec3 shallow = pow(vec3(0.33, 0.42, 0.36), vec3(2.2));
  vec3 deep = pow(vec3(0.04, 0.13, 0.22), vec3(2.2));
  vec3 color = e3dWaterColor(vWorld, vDepth, shallow, deep);
  float alpha = mix(0.55, 1.0, smoothstep(0.0, 6.0, vDepth));
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

export const waterMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: true,
  uniforms: { ...earthUniforms },
});
