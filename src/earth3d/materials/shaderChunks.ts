/**
 * 各个着色器共用的 GLSL 片段：噪声、空气透视、光照参数。
 * 所有世界坐标单位都是公里。
 */

export const NOISE_GLSL = /* glsl */ `
float e3dHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float e3dNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(e3dHash(i), e3dHash(i + vec3(1, 0, 0)), f.x),
        mix(e3dHash(i + vec3(0, 1, 0)), e3dHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(e3dHash(i + vec3(0, 0, 1)), e3dHash(i + vec3(1, 0, 1)), f.x),
        mix(e3dHash(i + vec3(0, 1, 1)), e3dHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

// 多尺度噪声；footprint 是当前像素覆盖的地面宽度（公里），比像素还小的细节自动淡出，避免闪烁
float e3dDetail(vec3 p, float wavelength, float footprint) {
  float sum = 0.0;
  float amp = 0.5;
  float total = 0.0;
  for (int i = 0; i < 4; i++) {
    float fade = 1.0 - smoothstep(wavelength * 0.25, wavelength, footprint);
    sum += (e3dNoise(p / wavelength) - 0.5) * amp * fade;
    total += amp;
    wavelength *= 0.43;
    amp *= 0.55;
  }
  return sum / total;
}
`;

export const ATMOSPHERE_GLSL = /* glsl */ `
uniform vec3 uCameraPos;
uniform vec3 uSunDir;
uniform float uHazeDensity;

const float E3D_RADIUS = 6371.0;
const float E3D_SCALE_HEIGHT = 8.0;

float e3dAltitude(vec3 p) {
  return max(length(p) - E3D_RADIUS, 0.0);
}

// 指数大气中两点之间的光学厚度（以海平面密度折算的公里数）
float e3dOpticalDepth(vec3 a, vec3 b) {
  float dist = length(b - a);
  float h1 = e3dAltitude(a);
  float h2 = e3dAltitude(b);
  float dh = h2 - h1;
  if (abs(dh) < 0.02 * dist + 0.001) {
    return dist * exp(-0.5 * (h1 + h2) / E3D_SCALE_HEIGHT);
  }
  return dist * E3D_SCALE_HEIGHT * abs(exp(-h1 / E3D_SCALE_HEIGHT) - exp(-h2 / E3D_SCALE_HEIGHT)) / abs(dh);
}

vec3 e3dHazeColor(vec3 p) {
  float sunUp = dot(normalize(p), uSunDir);
  vec3 day = vec3(0.42, 0.55, 0.76);
  vec3 dusk = vec3(0.50, 0.48, 0.50);
  vec3 color = mix(dusk, day, smoothstep(0.0, 0.35, sunUp));
  return color * smoothstep(-0.25, 0.1, sunUp);
}

vec3 e3dApplyHaze(vec3 color, vec3 worldPos) {
  float tau = e3dOpticalDepth(uCameraPos, worldPos) * uHazeDensity;
  float haze = 1.0 - exp(-tau);
  return mix(color, e3dHazeColor(worldPos), haze);
}

vec3 e3dSunLight(vec3 normal, vec3 up) {
  float diffuse = max(dot(normal, uSunDir), 0.0);
  float sunUp = dot(up, uSunDir);
  // 太阳贴近地平线时光线穿过更厚的大气，偏暖、变弱
  vec3 sunColor = mix(vec3(1.0, 0.62, 0.38), vec3(1.0, 0.96, 0.90), smoothstep(0.0, 0.4, sunUp));
  sunColor *= smoothstep(-0.05, 0.08, sunUp);
  vec3 sky = vec3(0.30, 0.38, 0.52) * (0.55 + 0.45 * dot(normal, up)) * smoothstep(-0.25, 0.1, sunUp);
  return sunColor * diffuse * 1.4 + sky * 0.22;
}
`;
