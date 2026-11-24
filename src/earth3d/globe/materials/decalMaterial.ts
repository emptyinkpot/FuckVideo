import * as THREE from "three";
import { earthUniforms } from "./earthUniforms";
import { ATMOSPHERE_GLSL, RELIEF_GLSL } from "./shaderChunks";
import { TERRAIN_VERTEX_SHADER, reliefUniforms, type TerrainRelief } from "./terrainMaterial";

/**
 * 贴地图层材质：全球地块系统（map/provinceStore.ts）画在地形表面上。
 * 按经纬度从地块编号图取地块（东亚范围内用约 2.2 公里一像素的细图，范围外用约 10 公里的全球图），
 * 在当天的对照表里查领有者、控制者，再从政权色板取颜色。两种模式：
 * - 国家层（uMode = 1）：按领有政权涂色；相邻四个像素的颜色双线性混合，交界处没有锯齿；
 * - 占领层（uMode = 2）：被占领处画控制者颜色的斜纹，争夺处画进攻方颜色的流动虚线。
 * 国界、前线是另外的贴地线条（map/borderLines.tsx），这里不画。
 * 两个日期之间按 uMix 混合前后两张对照表的颜色。
 */
const fragmentShader = /* glsl */ `
uniform sampler2D uProvGlobal;
uniform sampler2D uProvDetail;
uniform vec4 uProvGlobalBounds;
uniform vec4 uProvDetailBounds;
uniform vec2 uProvGlobalSize;
uniform vec2 uProvDetailSize;
uniform sampler2D uLookupA;
uniform sampler2D uLookupB;
uniform float uLookupWidth;
uniform sampler2D uPalette;
uniform float uMix;
uniform float uOpacity;
uniform float uMode;
uniform vec4 uPolFill;
uniform float uPolEmissive;
uniform vec4 uOccStripe;
uniform vec2 uOccDash;
uniform float uOccEmissive;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vHeight;
#include <common>
#include <logdepthbuf_pars_fragment>
${ATMOSPHERE_GLSL}
${RELIEF_GLSL}

void over(inout vec4 acc, vec3 color, float alpha) {
  acc.rgb = color * alpha + acc.rgb * (1.0 - alpha);
  acc.a = alpha + acc.a * (1.0 - alpha);
}

int provinceId(sampler2D raster, ivec2 texel, vec2 size) {
  vec2 v = texelFetch(raster, clamp(texel, ivec2(0), ivec2(size) - 1), 0).rg;
  return int(v.r * 255.0 + 0.5) + int(v.g * 255.0 + 0.5) * 256;
}

// 对照表：领有者（R、G）、控制者（B 和 A 的低 4 位）、状态（A 的高 2 位）
ivec3 lookup(sampler2D table, int id) {
  int w = int(uLookupWidth);
  vec4 v = texelFetch(table, ivec2(id - (id / w) * w, id / w), 0);
  int a = int(v.a * 255.0 + 0.5);
  int owner = int(v.r * 255.0 + 0.5) + int(v.g * 255.0 + 0.5) * 256;
  int controller = int(v.b * 255.0 + 0.5) + (a - (a / 16) * 16) * 256;
  return ivec3(owner, controller, a / 64);
}

vec4 polityColor(int index) {
  return texelFetch(uPalette, ivec2(index, 0), 0);
}

// 领有政权的颜色：相邻四个地块像素各自的颜色双线性混合（两个日期之间再按 uMix 混合）
vec4 ownerColorAt(sampler2D raster, vec2 size, vec2 f) {
  ivec2 i = ivec2(floor(f));
  vec2 w = fract(f);
  vec4 c[4];
  for (int k = 0; k < 4; k++) {
    int id = provinceId(raster, i + ivec2(k - (k / 2) * 2, k / 2), size);
    c[k] = mix(polityColor(lookup(uLookupA, id).x), polityColor(lookup(uLookupB, id).x), uMix);
  }
  return mix(mix(c[0], c[1], w.x), mix(c[2], c[3], w.x), w.y);
}

float quantizedKm(float px, float kmPerPx, int step) {
  return exp2(floor(log2(px * kmPerPx)) + float(step));
}

// 斜纹：间距按屏幕像素固定，按 2 的幂分级渐变；dashed 时断成沿斜纹流动的虚线
float stripesAt(vec2 plane, float kmPerPx, float scale, float dashed) {
  float f = fract(log2(uOccStripe.x * scale * kmPerPx));
  float halfWidth = uOccStripe.y * 0.5;
  float across = (plane.x + plane.y) * 0.70710678;
  float along = (plane.x - plane.y) * 0.70710678;
  float result = 0.0;
  for (int i = 0; i < 2; i++) {
    float spacing = quantizedKm(uOccStripe.x * scale, kmPerPx, i);
    float distPx = abs(fract(across / spacing + 0.5) - 0.5) * spacing / kmPerPx;
    float line = 1.0 - smoothstep(halfWidth - 0.7, halfWidth + 0.7, distPx);
    if (dashed > 0.5) {
      float dash = quantizedKm(uOccDash.x, kmPerPx, i);
      float phase = fract((along - uTime * uOccDash.y * dash / uOccDash.x) / (2.0 * dash));
      line *= smoothstep(0.0, 0.05, phase) * (1.0 - smoothstep(0.45, 0.5, phase));
    }
    result += line * (i == 0 ? 1.0 - f : f);
  }
  return result;
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 up = normalize(vWorld);
  vec2 lonlat = vec2(degrees(atan(-up.z, up.x)), degrees(asin(clamp(up.y, -1.0, 1.0))));
  // 屏幕导数必须在任何 discard 之前算（ANGLE/D3D 下 discard 之后的导数没有定义）；用面积缩放估计每像素公里数
  float latR = radians(lonlat.y);
  vec2 plane = vec2(radians(lonlat.x) * 6371.0 * cos(latR), latR * 6371.0);
  vec2 qx = dFdx(plane);
  vec2 qy = dFdy(plane);
  float kmPerPx = sqrt(max(abs(qx.x * qy.y - qx.y * qy.x), 1e-8));

  // 东亚范围内用细图，范围外用全球图
  vec4 b = uProvDetailBounds;
  bool detail = lonlat.x > b.x && lonlat.x < b.z && lonlat.y > b.y && lonlat.y < b.w;
  vec4 bounds = detail ? uProvDetailBounds : uProvGlobalBounds;
  vec2 size = detail ? uProvDetailSize : uProvGlobalSize;
  vec2 f = vec2((lonlat.x - bounds.x) / (bounds.z - bounds.x), (lonlat.y - bounds.y) / (bounds.w - bounds.y)) * size - 0.5;
  if (f.y < -0.5 || f.y > size.y - 0.5) discard;

  vec3 n = gl_FrontFacing ? e3dReliefNormal(up) : up;
  vec3 light = e3dReliefLight(n, up, step(-2.0, vHeight));
  vec4 fill = vec4(0.0);
  float emissive;
  if (uMode < 1.5) {
    // 国家层
    vec4 owner = detail ? ownerColorAt(uProvDetail, uProvDetailSize, f) : ownerColorAt(uProvGlobal, uProvGlobalSize, f);
    if (owner.a < 0.002) discard;
    over(fill, owner.rgb / owner.a, uPolFill.x * owner.a);
    emissive = uPolEmissive;
  } else {
    // 占领层：取最近的地块
    ivec2 texel = ivec2(floor(f + 0.5));
    int id = detail ? provinceId(uProvDetail, texel, uProvDetailSize) : provinceId(uProvGlobal, texel, uProvGlobalSize);
    ivec3 state = uMix < 0.5 ? lookup(uLookupA, id) : lookup(uLookupB, id);
    if (state.z == 0 || state.y == 0) discard;
    vec3 ruler = polityColor(state.y).rgb;
    if (state.z == 1) {
      over(fill, ruler, uOccStripe.w);
      over(fill, ruler, stripesAt(plane, kmPerPx, 1.0, 0.0) * uOccStripe.z);
    } else {
      // 争夺区比占领区淡、稀：间距 1.6 倍、不透明度 0.6 倍，流动的虚线
      over(fill, ruler, stripesAt(plane, kmPerPx, 1.6, 1.0) * uOccStripe.z * 0.6);
    }
    emissive = uOccEmissive;
  }

  vec3 color = fill.rgb / max(fill.a, 1e-4) * mix(light, vec3(1.0), emissive * 0.4);
  float alpha = fill.a * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(e3dApplyHaze(color, vWorld), alpha);
  #include <colorspace_fragment>
}
`;

const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
empty.needsUpdate = true;

/** 一个贴地图层的参数（所有分块共享同一组对象）。 */
export type DecalUniforms = {
  uProvGlobal: { value: THREE.Texture };
  uProvDetail: { value: THREE.Texture };
  uProvGlobalBounds: { value: THREE.Vector4 };
  uProvDetailBounds: { value: THREE.Vector4 };
  uProvGlobalSize: { value: THREE.Vector2 };
  uProvDetailSize: { value: THREE.Vector2 };
  uLookupA: { value: THREE.Texture };
  uLookupB: { value: THREE.Texture };
  uLookupWidth: { value: number };
  uPalette: { value: THREE.Texture };
  uMix: { value: number };
  uOpacity: { value: number };
  uMode: { value: number };
};

export const createDecalUniforms = (): DecalUniforms => ({
  uProvGlobal: { value: empty },
  uProvDetail: { value: empty },
  uProvGlobalBounds: { value: new THREE.Vector4(-180, -90, 180, 90) },
  uProvDetailBounds: { value: new THREE.Vector4(0, 0, 0, 0) },
  uProvGlobalSize: { value: new THREE.Vector2(1, 1) },
  uProvDetailSize: { value: new THREE.Vector2(1, 1) },
  uLookupA: { value: empty },
  uLookupB: { value: empty },
  uLookupWidth: { value: 1 },
  uPalette: { value: empty },
  uMix: { value: 0 },
  uOpacity: { value: 1 },
  uMode: { value: 1 },
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
