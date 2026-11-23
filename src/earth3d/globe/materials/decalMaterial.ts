import * as THREE from "three";
import { earthUniforms } from "./earthUniforms";
import { ATMOSPHERE_GLSL, RELIEF_GLSL } from "./shaderChunks";
import { TERRAIN_VERTEX_SHADER, reliefUniforms, type TerrainRelief } from "./terrainMaterial";

/**
 * 贴地图层材质：把一张经纬度等距的透明图（RGB 颜色，A 强度）画在地形表面上。
 * - 顶点着色器与地形相同，深度完全一致，配合 LessEqual 深度比较贴在地表上；
 * - 颜色和地表用同一套起伏光照（细法线、山体阴影、天空可见度），再加空气透视，
 *   单独导出的透明图层叠回去时，明暗和底下的地形对得上；
 * - 同一图层在 A、B 两张图之间按 uMix 过渡（例如两个日期的控制区）。
 * 每个分块各有一份材质（起伏数据按分块），图层参数用同一组 uniform 对象共享。
 */
const fragmentShader = /* glsl */ `
uniform sampler2D uDecalA;
uniform sampler2D uDecalB;
uniform float uMix;
uniform float uOpacity;
uniform vec4 uBounds;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vHeight;
#include <common>
#include <logdepthbuf_pars_fragment>
${ATMOSPHERE_GLSL}
${RELIEF_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  vec3 up = normalize(vWorld);
  float lon = degrees(atan(-up.z, up.x));
  float lat = degrees(asin(clamp(up.y, -1.0, 1.0)));
  vec2 uv = vec2((lon - uBounds.x) / (uBounds.z - uBounds.x), (lat - uBounds.y) / (uBounds.w - uBounds.y));
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
  vec4 decal = mix(texture2D(uDecalA, uv), texture2D(uDecalB, uv), uMix);
  float alpha = decal.a * uOpacity;
  if (alpha < 0.002) discard;
  vec3 n = gl_FrontFacing ? e3dReliefNormal(up) : up;
  vec3 color = decal.rgb * e3dReliefLight(n, up, step(-2.0, vHeight));
  color = e3dApplyHaze(color, vWorld);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
empty.needsUpdate = true;

/** 一个贴地图层的参数（所有分块共享同一组对象）。 */
export type DecalUniforms = {
  uDecalA: { value: THREE.Texture };
  uDecalB: { value: THREE.Texture };
  uMix: { value: number };
  uOpacity: { value: number };
  uBounds: { value: THREE.Vector4 };
};

export const createDecalUniforms = (): DecalUniforms => ({
  uDecalA: { value: empty },
  uDecalB: { value: empty },
  uMix: { value: 0 },
  uOpacity: { value: 1 },
  uBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
});

export const createDecalMaterial = (layer: DecalUniforms, relief: TerrainRelief, exaggeration: number) =>
  new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERTEX_SHADER,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    side: THREE.DoubleSide,
    uniforms: { ...earthUniforms, ...reliefUniforms(relief, exaggeration), ...layer },
  });
