import type { EarthStyle } from "./types";

/**
 * 默认风格：写实。真实比例的地形、真实地表分类、物理天空和空气透视。
 * 数值就是风格系统建立之前着色器里写死的常量，画面与之前完全一致。
 */
export const defaultStyle: EarthStyle = {
  id: "default",
  label: "默认（写实）",
  exaggeration: 1,
  sun: { azimuthDeg: 210, elevationNearDeg: 18, elevationFarDeg: 60 },
  surface: {
    stylized: 0,
    low: [0.3, 0.36, 0.25],
    high: [0.45, 0.42, 0.34],
    rock: [0.42, 0.39, 0.35],
    lowHeightM: 200,
    highHeightM: 2500,
    variation: 0.3,
    snow: 1,
  },
  light: { sun: 1.45, sky: 0.24, ridge: 0, valley: 0, curvatureTexels: 1.5 },
  haze: { density: 1 / 140, mix: 0, color: [0.42, 0.55, 0.76] },
  sky: { mix: 0, color: [0, 0, 0] },
  water: { tint: [1, 1, 1], river: [0.45, 0.75, 1], riverMix: 0 },
  decalStrength: 1,
  grade: { brightness: 1, contrast: 1, saturation: 1, vignette: 0 },
};
