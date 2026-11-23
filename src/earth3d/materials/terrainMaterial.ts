import * as THREE from "three";
import { earthUniforms } from "./earthUniforms";
import { ATMOSPHERE_GLSL, NOISE_GLSL } from "./shaderChunks";
import { WATER_SHADING_GLSL } from "./waterMaterial";

const vertexShader = /* glsl */ `
attribute float aHeight;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vHeight;
#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vHeight = aHeight;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uSurface;
uniform float uTexelKm;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vHeight;
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
${ATMOSPHERE_GLSL}
${WATER_SHADING_GLSL}

vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }

int surfaceAt(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(255));
  return int(texelFetch(uSurface, p, 0).r * 255.0 + 0.5);
}

// 地表类别 -> 基础反照率。颜色取自卫星影像中各类地表的典型色调，按纬度、海拔微调。
vec3 surfaceColor(int c, float alat, float h) {
  if (c == 1) {
    vec3 color = mix(srgb(vec3(0.21, 0.31, 0.17)), srgb(vec3(0.26, 0.32, 0.20)), smoothstep(20.0, 32.0, alat));
    return mix(color, srgb(vec3(0.23, 0.28, 0.20)), smoothstep(45.0, 55.0, alat));
  }
  if (c == 2) return srgb(vec3(0.42, 0.41, 0.29));
  if (c == 3) return srgb(vec3(0.49, 0.51, 0.33));
  if (c == 4) return mix(srgb(vec3(0.42, 0.49, 0.29)), srgb(vec3(0.56, 0.55, 0.39)), smoothstep(28.0, 36.0, alat));
  if (c == 5) return srgb(vec3(0.46, 0.44, 0.41));
  if (c == 6) return mix(srgb(vec3(0.76, 0.66, 0.51)), srgb(vec3(0.56, 0.51, 0.44)), smoothstep(2500.0, 4000.0, h));
  if (c == 7) return srgb(vec3(0.92, 0.93, 0.95));
  if (c == 8) return srgb(vec3(0.20, 0.26, 0.27));
  if (c == 9) return srgb(vec3(0.33, 0.38, 0.26));
  if (c == 10) return srgb(vec3(0.17, 0.26, 0.18));
  if (c == 11) return srgb(vec3(0.48, 0.47, 0.38));
  return srgb(vec3(0.37, 0.36, 0.31));
}

// 局部平面坐标（公里）：x 向东，y 向北。用于农田等需要贴着地面排布的图案。
vec2 localPlane(vec3 up) {
  float lat = asin(clamp(up.y, -1.0, 1.0));
  float lon = atan(-up.z, up.x);
  return vec2(lon * 6371.0 * cos(lat), lat * 6371.0);
}

// 农田：每 1.6 公里一片地块方向随机，里面是长条形田块，各块作物颜色不同
vec3 fieldColor(vec2 q, vec3 base) {
  vec2 plot = floor(q / 1.6);
  float angle = (e3dHash(vec3(plot, 3.0)) - 0.5) * 1.2;
  vec2 r = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * q;
  float rowHeight = 0.07 + 0.07 * e3dHash(vec3(plot, 5.0));
  float row = floor(r.y / rowHeight);
  float stripLength = 0.15 + 0.3 * e3dHash(vec3(plot, 7.0));
  float column = floor((r.x + e3dHash(vec3(row, plot)) * stripLength) / stripLength);
  float pick = e3dHash(vec3(column, row, plot.x * 31.0 + plot.y));
  // 作物颜色只在基础色上做小幅偏移：深绿、浅绿、泛黄、休耕的土色
  vec3 crop = base;
  if (pick < 0.35) crop *= vec3(0.84, 0.94, 0.82);
  else if (pick < 0.55) crop *= vec3(1.06, 1.08, 0.98);
  else if (pick < 0.72) crop *= vec3(1.22, 1.12, 0.90);
  else if (pick < 0.86) crop *= vec3(1.10, 0.96, 0.86);
  // 田埂、沟渠：田块边上一圈略暗
  vec2 inRow = vec2(fract((r.x + e3dHash(vec3(row, plot)) * stripLength) / stripLength) * stripLength, fract(r.y / rowHeight) * rowHeight);
  float border = min(min(inRow.x, stripLength - inRow.x), min(inRow.y, rowHeight - inRow.y));
  crop *= mix(0.82, 1.0, smoothstep(0.0, 0.006, border));
  return crop;
}

// 村庄：农田里大约每 1.3 公里一个，半径 70-170 米，灰褐色屋顶夹着树木和空地。
// 返回村庄覆盖程度（0-1），color 输出村庄颜色。
float village(vec2 q, float footprint, out vec3 color) {
  vec2 cell = floor(q / 1.3);
  float best = 0.0;
  color = vec3(0.0);
  for (int dx = -1; dx <= 1; dx++) {
    for (int dy = -1; dy <= 1; dy++) {
      vec2 id = cell + vec2(dx, dy);
      if (e3dHash(vec3(id, 41.0)) < 0.18) continue;
      vec2 center = (id + 0.2 + 0.6 * vec2(e3dHash(vec3(id, 43.0)), e3dHash(vec3(id, 47.0)))) * 1.3;
      float radius = 0.07 + 0.1 * e3dHash(vec3(id, 53.0));
      float d = length(q - center) / radius;
      float edgeNoise = e3dNoise(vec3(q * 18.0, id.x)) * 0.5;
      float cover = 1.0 - smoothstep(0.6, 1.0, d + edgeNoise * 0.4);
      if (cover > best) best = cover;
    }
  }
  // 屋顶和树木的细碎斑点，远处平均成灰褐色
  float speckle = e3dHash(vec3(floor(q / 0.012), 59.0));
  float fade = 1.0 - smoothstep(0.004, 0.02, footprint);
  vec3 roof = srgb(vec3(0.36, 0.35, 0.34));
  vec3 tree = srgb(vec3(0.22, 0.28, 0.18));
  vec3 yard = srgb(vec3(0.55, 0.50, 0.42));
  // 远处平均成偏亮的灰褐色，和周围农田的明度接近，不会像一个个黑洞
  vec3 mixed = mix(roof * 0.4 + tree * 0.3 + yard * 0.3, srgb(vec3(0.46, 0.44, 0.39)), 0.5);
  vec3 detail = speckle < 0.45 ? roof : (speckle < 0.8 ? tree : yard);
  color = mix(mixed, detail, fade);
  return best * (1.0 - smoothstep(0.12, 0.3, footprint));
}

// 城区（1930 年代旧城）：东西向胡同约 70 米一条、南北向街道约 350 米一条，
// 中间是深灰瓦顶和零星院落。镜头再近时由三维建筑接替。
vec3 urbanColor(vec2 q, vec3 base, float footprint) {
  float fade = 1.0 - smoothstep(0.006, 0.03, footprint);
  vec2 cell = vec2(q.x / 0.35, q.y / 0.07);
  vec2 f = fract(cell);
  vec2 id = floor(cell);
  float lane = 1.0 - smoothstep(0.0, 0.09, min(f.y, 1.0 - f.y));
  float street = 1.0 - smoothstep(0.0, 0.03, min(f.x, 1.0 - f.x));
  float lot = e3dHash(vec3(floor(q.x / 0.022), id.y, 61.0));
  // 院落天井：每个地块中间偏南一小块空地
  float court = step(abs(fract(q.x / 0.022) - 0.5), 0.22) * step(abs(f.y - 0.25), 0.07) * 0.6;
  vec3 roof = srgb(vec3(0.30, 0.30, 0.31)) * (0.85 + 0.3 * lot);
  vec3 ground = srgb(vec3(0.56, 0.52, 0.45));
  vec3 detail = mix(roof, ground, max(max(lane, street), court));
  // 中距离：街坊之间明暗不一，夹着成片的树木和空地
  float blockTone = e3dNoise(vec3(q / 0.12, 3.0));
  float greenery = smoothstep(0.72, 0.86, e3dNoise(vec3(q / 0.16, 7.0)));
  vec3 average = mix(srgb(vec3(0.37, 0.36, 0.34)), ground, 0.22) * (0.85 + 0.3 * blockTone);
  average = mix(average, srgb(vec3(0.27, 0.32, 0.22)), greenery * 0.5);
  return mix(mix(base, average, 0.85), detail, fade);
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 up = normalize(vWorld);
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = up;
  float footprint = length(fwidth(vWorld));
  float alat = abs(degrees(asin(clamp(up.y, -1.0, 1.0))));

  float macro = e3dDetail(vWorld, 30.0, footprint);
  float micro = e3dDetail(vWorld, 1.2, footprint);

  // 地表类别：4 个相邻格子按颜色插值。边界扰动的幅度按地面距离（公里）固定，
  // 不随分块精度变化，相邻不同精度的分块看起来一致。
  vec2 warpKm = vec2(e3dDetail(vWorld + 11.0, 1.8, footprint), e3dDetail(vWorld - 7.0, 1.8, footprint)) * 0.9;
  vec2 coord = vUv * 256.0 - 0.5 + warpKm / uTexelKm;
  ivec2 base = ivec2(floor(coord));
  vec2 f = smoothstep(0.0, 1.0, fract(coord));
  int c00 = surfaceAt(base);
  int c10 = surfaceAt(base + ivec2(1, 0));
  int c01 = surfaceAt(base + ivec2(0, 1));
  int c11 = surfaceAt(base + ivec2(1, 1));
  vec4 weights = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  vec3 albedo =
    surfaceColor(c00, alat, vHeight) * weights.x + surfaceColor(c10, alat, vHeight) * weights.y +
    surfaceColor(c01, alat, vHeight) * weights.z + surfaceColor(c11, alat, vHeight) * weights.w;
  float cropShare = dot(weights, vec4(float(c00 == 4), float(c10 == 4), float(c01 == 4), float(c11 == 4)));
  float waterShare = dot(weights, vec4(float(c00 == 8), float(c10 == 8), float(c01 == 8), float(c11 == 8)));

  // 农田图案在田块小于像素之前淡出，避免闪烁
  float fieldFade = 1.0 - smoothstep(0.025, 0.1, footprint);
  vec2 plane = localPlane(up);
  if (cropShare * fieldFade > 0.0) {
    albedo = mix(albedo, fieldColor(plane, albedo), cropShare * fieldFade);
  }
  float urbanShare = dot(weights, vec4(float(c00 == 5), float(c10 == 5), float(c01 == 5), float(c11 == 5)));
  if (urbanShare > 0.0) {
    // 城区边缘按噪声渐变到郊外，不留硬边
    float edgeNoise = e3dNoise(vec3(plane / 0.3, 11.0)) * 0.35;
    albedo = mix(albedo, urbanColor(plane, albedo, footprint), smoothstep(0.15, 0.85, urbanShare + edgeNoise - 0.17));
  }
  if (cropShare > 0.0) {
    vec3 villageColor;
    float cover = village(plane, footprint, villageColor) * cropShare;
    albedo = mix(albedo, villageColor, cover);
  }

  albedo *= 1.0 + macro * 0.32 + micro * 0.22;

  // 陡坡露出岩石，高处按纬度积雪
  float slope = 1.0 - dot(n, up);
  float landFactor = step(-2.0, vHeight);
  float rock = smoothstep(0.10, 0.28, slope + micro * 0.08) * landFactor;
  albedo = mix(albedo, srgb(vec3(0.42, 0.39, 0.35)) * (1.0 + micro * 0.3), rock);
  float snowline = mix(5600.0, 900.0, smoothstep(30.0, 65.0, alat)) + macro * 700.0;
  float snow = smoothstep(snowline - 200.0, snowline + 250.0, vHeight) * (1.0 - smoothstep(0.30, 0.5, slope));
  albedo = mix(albedo, srgb(vec3(0.92, 0.93, 0.95)), snow);

  // 陡坡整体略暗（坡面接收的天光更少），让山体轮廓在顺光时也能看出来
  float cavity = mix(0.72, 1.0, smoothstep(0.0, 0.25, dot(n, up) - 0.7));
  vec3 color = albedo * e3dSunLight(n, up) * mix(1.0, cavity, landFactor);
  color = e3dApplyHaze(color, vWorld);
  // WorldCover 标为水体但不在湖泊、海洋数据里的地方（河道、池塘）按水面着色
  if (waterShare > 0.0) {
    vec3 water = e3dWaterColor(vWorld, 3.0, srgb(vec3(0.33, 0.42, 0.44)), srgb(vec3(0.16, 0.26, 0.33)));
    color = mix(color, water, smoothstep(0.45, 0.75, waterShare));
  }
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/** texelKm：地表类别纹理一个格子对应的地面宽度（公里）。 */
export const createTerrainMaterial = (surface: THREE.DataTexture, texelKm = 1) =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    uniforms: {
      ...earthUniforms,
      uSurface: { value: surface },
      uTexelKm: { value: texelKm },
    },
  });
