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
  decalStrength: 2.3,
  grade: { brightness: 1, contrast: 1.12, saturation: 1.05, vignette: 0.6 },
};
