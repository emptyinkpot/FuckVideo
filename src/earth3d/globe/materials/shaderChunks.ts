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

// 空气透视：短波长散射更强（蓝光衰减快、散射进视线的也多），远山逐渐偏蓝灰；
// 朝太阳方向看时，大颗粒的前向散射让空气发亮（Henyey-Greenstein 相函数）
vec3 e3dApplyHaze(vec3 color, vec3 worldPos) {
  float tau = e3dOpticalDepth(uCameraPos, worldPos) * uHazeDensity;
  vec3 extinction = exp(-tau * vec3(0.72, 0.88, 1.12));
  vec3 view = normalize(worldPos - uCameraPos);
  float cosTheta = dot(view, uSunDir);
  float g = 0.72;
  float mie = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosTheta, 1.5) / 12.566;
  float sunUp = smoothstep(-0.05, 0.2, dot(normalize(worldPos), uSunDir));
  vec3 inscatter = e3dHazeColor(worldPos) + vec3(1.0, 0.86, 0.68) * mie * 0.55 * sunUp;
  return color * extinction + inscatter * (1.0 - extinction);
}

// 照到这一点的阳光颜色：太阳贴近地平线时光线穿过更厚的大气，偏暖、变弱
vec3 e3dSunColor(vec3 up) {
  float sunUp = dot(up, uSunDir);
  vec3 sunColor = mix(vec3(1.0, 0.62, 0.38), vec3(1.0, 0.96, 0.90), smoothstep(0.0, 0.4, sunUp));
  return sunColor * smoothstep(-0.05, 0.08, sunUp);
}

// 天光：朝天的面接收得多
vec3 e3dSkyLight(vec3 normal, vec3 up) {
  float sunUp = dot(up, uSunDir);
  return vec3(0.30, 0.38, 0.52) * (0.55 + 0.45 * dot(normal, up)) * smoothstep(-0.25, 0.1, sunUp);
}

vec3 e3dSunLight(vec3 normal, vec3 up) {
  float diffuse = max(dot(normal, uSunDir), 0.0);
  return e3dSunColor(up) * diffuse * 1.4 + e3dSkyLight(normal, up) * 0.22;
}
`;

/**
 * 地形起伏光照：逐像素细法线、地形投影阴影、天空可见度（环境光遮蔽）。
 * 数据来自分块的坡度图和 8 个方向地平线图（pipeline/relief.py），需要：
 * uniform sampler2D uSlope, uHorizonA, uHorizonB; uniform float uExaggeration; varying vec2 vUv;
 * 以及 ATMOSPHERE_GLSL 里的 uSunDir。
 */
export const RELIEF_GLSL = /* glsl */ `
uniform sampler2D uSlope;
uniform sampler2D uHorizonA;
uniform sampler2D uHorizonB;
uniform float uExaggeration;

vec3 e3dEast(vec3 up) { return normalize(cross(vec3(0.0, 1.0, 0.0), up) + vec3(1e-7, 0.0, 0.0)); }

// 坡度图里存的是 atan(坡度)，按高度倍数放大后组成法线
vec3 e3dReliefNormal(vec3 up) {
  vec2 encoded = clamp(texture2D(uSlope, vUv).rg, 0.004, 0.996);
  vec2 slope = tan((encoded - 0.5) * PI) * uExaggeration;
  vec3 east = e3dEast(up);
  vec3 north = cross(up, east);
  return normalize(up - east * slope.x - north * slope.y);
}

// 8 个方向的地平线仰角（度），北起顺时针；按高度倍数放大
void e3dHorizon(out vec4 first, out vec4 second) {
  vec4 a = texture2D(uHorizonA, vUv) * 63.75;
  vec4 b = texture2D(uHorizonB, vUv) * 63.75;
  first = degrees(atan(tan(radians(a)) * uExaggeration));
  second = degrees(atan(tan(radians(b)) * uExaggeration));
}

// 太阳是否被周围的山挡住：1 为照到，0 为在阴影里，边缘留 3° 的半影
float e3dSunVisibility(vec3 up) {
  vec3 east = e3dEast(up);
  vec3 north = cross(up, east);
  float elevation = degrees(asin(clamp(dot(uSunDir, up), -1.0, 1.0)));
  float azimuth = atan(dot(uSunDir, east), dot(uSunDir, north));
  float f = mod(azimuth / (PI * 0.25) + 8.0, 8.0);
  vec4 first;
  vec4 second;
  e3dHorizon(first, second);
  // 在最近的两个方向之间按角度插值（用权重代替动态下标）
  vec4 w1 = max(vec4(0.0), 1.0 - abs(vec4(0.0, 1.0, 2.0, 3.0) - f));
  vec4 w2 = max(vec4(0.0), 1.0 - abs(vec4(4.0, 5.0, 6.0, 7.0) - f));
  w1.x += max(0.0, f - 7.0);
  float horizon = dot(first, w1) + dot(second, w2);
  return smoothstep(horizon - 1.0, horizon + 2.0, elevation);
}

// 天空可见度：每个方向能看到的天空占 cos²(地平线仰角)，8 个方向平均
float e3dSkyVisibility() {
  vec4 first;
  vec4 second;
  e3dHorizon(first, second);
  vec4 c1 = cos(radians(first));
  vec4 c2 = cos(radians(second));
  return (dot(c1 * c1, vec4(1.0)) + dot(c2 * c2, vec4(1.0))) / 8.0;
}

// 地表受光：阳光（被山挡住的地方变暗）、天光（按天空可见度），陡坡略暗
vec3 e3dReliefLight(vec3 normal, vec3 up, float landFactor) {
  float shadow = mix(1.0, e3dSunVisibility(up), landFactor);
  float sky = mix(1.0, e3dSkyVisibility(), landFactor);
  float cavity = mix(0.78, 1.0, smoothstep(0.0, 0.25, dot(normal, up) - 0.7));
  float diffuse = max(dot(normal, uSunDir), 0.0);
  vec3 light = e3dSunColor(up) * diffuse * 1.45 * shadow + e3dSkyLight(normal, up) * 0.24 * sky * sky;
  return light * mix(1.0, cavity, landFactor);
}
`;
