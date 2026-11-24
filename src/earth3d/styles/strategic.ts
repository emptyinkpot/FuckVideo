import type { EarthStyle } from "./types";

/**
 * 态势图风格：纪录片、军事题材里常见的暗调三维态势图。
 * - 地形高度放大，山体尖锐；
 * - 低角度侧光、深阴影，立体感主要来自明暗对比；
 * - 山脊棱线提亮、沟底压暗，轮廓清楚；
 * - 地表不用真实分类的色斑，统一暗青灰底色，光影不受干扰；
 * - 控制区着色接近直接把地形染色，山体明暗保留；
 * - 远处沉进暗色雾里，四周暗角，视线集中在画面中间。
 */
export const strategicStyle: EarthStyle = {
  id: "strategic",
  label: "态势图",
  exaggeration: 3.5,
  // 光从西北来（北朝上的画面里是左上方），近处压得很低
  sun: { azimuthDeg: 300, elevationNearDeg: 14, elevationFarDeg: 32 },
  surface: {
    stylized: 1,
    low: [0.16, 0.25, 0.25],
    high: [0.31, 0.33, 0.29],
    rock: [0.36, 0.35, 0.32],
    lowHeightM: 150,
    highHeightM: 2200,
    variation: 0.18,
    snow: 0,
  },
  light: { sun: 2.0, sky: 0.34, ridge: 1.1, valley: 0.5, curvatureTexels: 1.5 },
  haze: { density: 1 / 55, mix: 1, color: [0.035, 0.05, 0.06] },
  sky: { mix: 1, color: [0.02, 0.03, 0.04] },
  // 河流换成发亮的浅蓝
  water: { tint: [0.45, 0.55, 0.65], river: [0.5, 0.82, 1], riverMix: 0.9 },
  grade: { brightness: 1, contrast: 1.12, saturation: 1.05, vignette: 0.6 },
  // 政权底色较浓，国界是带光晕的亮线
  political: {
    colors: {
      // 日本阵营：白色系
      japan: [0.93, 0.94, 0.96],
      manchukuo: [0.96, 0.91, 0.78],
      // 国民政府阵营：蓝色系（中央标准蓝，各地军阀不同深浅的蓝和青）
      roc: [0.27, 0.46, 0.8],
      fengtian: [0.33, 0.55, 0.69],
      jinsui: [0.45, 0.52, 0.84],
      jicha: [0.46, 0.68, 0.88],
      shandong: [0.24, 0.6, 0.72],
      yuegang: [0.36, 0.64, 0.9],
      guixi: [0.2, 0.36, 0.62],
      dian: [0.27, 0.64, 0.66],
      chuan: [0.52, 0.6, 0.88],
      majia: [0.4, 0.73, 0.82],
      xinjiang: [0.5, 0.58, 0.72],
      // 社会主义阵营：红色系
      ussr: [0.74, 0.12, 0.12],
      mongolia: [0.88, 0.4, 0.22],
      ccp: [0.84, 0.36, 0.4],
      // 其他：中性色
      tibet: [0.8, 0.72, 0.52],
      uk: [0.72, 0.62, 0.5],
      france: [0.62, 0.58, 0.7],
      usa: [0.52, 0.66, 0.5],
      netherlands: [0.8, 0.62, 0.42],
      portugal: [0.62, 0.7, 0.55],
      siam: [0.72, 0.69, 0.45],
    },
    slots: [
      [0.72, 0.65, 0.52],
      [0.58, 0.67, 0.52],
      [0.67, 0.58, 0.67],
      [0.76, 0.63, 0.46],
      [0.56, 0.62, 0.68],
      [0.71, 0.7, 0.55],
      [0.64, 0.55, 0.48],
      [0.52, 0.65, 0.62],
    ],
    fill: 0.5,
    international: { color: [0.92, 0.95, 1], widthPx: 1.8, alpha: 0.9, glowPx: 2.5, glowAlpha: 0.2 },
    internal: { color: [0.62, 0.76, 0.96], widthPx: 1.1, alpha: 0.55 },
    emissive: 0.55,
  },
  occupation: {
    stripeSpacingPx: 10,
    stripeWidthPx: 2.4,
    stripeAlpha: 0.85,
    fill: 0.08,
    frontWidthPx: 2.2,
    frontAlpha: 1,
    frontGlowPx: 2.5,
    frontGlowAlpha: 0.25,
    dashPx: 12,
    dashSpeed: 30,
    emissive: 0.85,
  },
  cities: { text: [0.88, 0.94, 0.97], dot: [0.62, 0.88, 1], capital: [1, 0.78, 0.38], halo: [0, 0.02, 0.04], glow: 0.7, fontScale: 1 },
  // 细亮线带光晕；焦点线路更粗、更亮，有光点沿线流动
  railways: {
    ownerShade: 1,
    casing: [0.02, 0.03, 0.04],
    widthPx: 1.6,
    alpha: 0.85,
    dashPx: 0,
    dashColor: [1, 1, 1],
    glowPx: 3,
    glowAlpha: 0.3,
    focusWidth: 1.8,
    focusGlowAlpha: 0.7,
    flowPxPerSec: 90,
  },
  regions: { text: [0.85, 0.92, 0.96], halo: [0, 0.02, 0.04], glow: 0.6 },
  // 箭头、战线是带光晕的亮线
  events: {
    actors: {
      japan: [1, 0.29, 0.24],
      manchukuo: [1, 0.29, 0.24],
      china: [0.29, 0.64, 1],
      soviet: [1, 0.7, 0.3],
      other: [1, 0.29, 0.24],
    },
    route: [1, 0.62, 0.25],
    arrowWidthPx: 10,
    arrowGlowPx: 5,
    arrowGlowAlpha: 0.6,
    frontline: [1, 0.93, 0.82],
    frontlineWidthPx: 2.8,
    frontlineGlowPx: 5,
    frontlineGlowAlpha: 0.55,
    pulse: [1, 0.67, 0.24],
    placeText: [0.92, 0.95, 0.97],
    placeHalo: [0, 0.02, 0.04],
  },
  // 暗色半透明底板、金色细边框
  ui: {
    panel: [0.02, 0.04, 0.055],
    panelAlpha: 0.76,
    text: [0.91, 0.93, 0.95],
    muted: [0.7, 0.78, 0.82],
    accent: [0.84, 0.7, 0.37],
    border: [0.84, 0.7, 0.37],
    borderAlpha: 0.55,
    glow: 0.6,
  },
};
