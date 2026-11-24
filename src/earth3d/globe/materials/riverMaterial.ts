import * as THREE from "three";
import { earthUniforms } from "./earthUniforms";
import { ATMOSPHERE_GLSL, NOISE_GLSL } from "./shaderChunks";
import { WATER_SHADING_GLSL } from "./waterMaterial";

const vertexShader = /* glsl */ `
attribute float aSide;
attribute vec3 aTangent;
attribute float aWidth;
uniform vec3 uCameraPos;
uniform float uPixelAngle;
varying vec3 vWorld;
varying float vAlpha;
varying float vAcross;
#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
  vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 up = normalize(world);
  float dist = length(uCameraPos - world);
  float pixelKm = dist * uPixelAngle;
  // 真实宽度不足一个像素时按一个像素画，同时按比例降低不透明度
  float halfWidth = max(aWidth, pixelKm * 1.1) * 0.5;
  vAlpha = clamp(aWidth / (pixelKm * 0.6), 0.0, 1.0);
  vec3 side = normalize(cross(aTangent, up));
  // 微微抬离地面，避免被地形网格插值遮住；抬高量随距离增大，近处几乎为零
  vec3 offset = side * aSide * halfWidth + up * (0.003 + dist * 0.0005);
  vec3 local = position + (inverse(mat3(modelMatrix)) * offset);
  vWorld = world + offset;
  vAcross = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(local, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uWaterTint;
uniform vec3 uRiverColor;
uniform float uRiverMix;
varying vec3 vWorld;
varying float vAlpha;
varying float vAcross;
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
${ATMOSPHERE_GLSL}
${WATER_SHADING_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  vec3 shallow = pow(vec3(0.38, 0.40, 0.32), vec3(2.2));
  vec3 deep = pow(vec3(0.20, 0.27, 0.27), vec3(2.2));
  float depth = 4.0 * (1.0 - abs(vAcross));
  vec3 color = e3dWaterColor(vWorld, depth, shallow * uWaterTint, deep * uWaterTint);
  // 风格可以把河流换成单独的颜色（中间亮、两边暗，像发光的细线）
  color = mix(color, uRiverColor * (0.75 + 0.5 * (1.0 - abs(vAcross))), uRiverMix);
  float edge = 1.0 - smoothstep(0.75, 1.0, abs(vAcross));
  gl_FragColor = vec4(color, vAlpha * edge);
  #include <colorspace_fragment>
}
`;

export const riverMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: { ...earthUniforms },
});
