import { earthUniforms } from "../globe/materials/earthUniforms";
import { defaultStyle } from "./default";
import { strategicStyle } from "./strategic";
import type { EarthStyle, Rgb } from "./types";

export type { EarthStyle, Rgb } from "./types";
export { defaultStyle, strategicStyle };

/** 全部风格。新风格写好后加到这里，Studio 面板的下拉框会自动出现。 */
export const EARTH_STYLES = {
  default: defaultStyle,
  strategic: strategicStyle,
} as const satisfies Record<string, EarthStyle>;

export type EarthStyleId = keyof typeof EARTH_STYLES;
export const EARTH_STYLE_IDS = Object.keys(EARTH_STYLES) as [EarthStyleId, ...EarthStyleId[]];

/** 风格名或完整的风格对象 -> 风格对象；不认识的名字按默认风格。 */
export const resolveStyle = (style?: EarthStyleId | EarthStyle): EarthStyle =>
  typeof style === "object" ? style : (EARTH_STYLES[style ?? "default"] ?? defaultStyle);

const linear = (c: Rgb): Rgb => [c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2];

/** 把风格写进所有地球材质共享的 uniform（每帧调用一次）。 */
export const applyStyleUniforms = (style: EarthStyle) => {
  const u = earthUniforms;
  const { surface, light, haze, sky, water } = style;
  u.uStyleSurface.value = surface.stylized;
  u.uStyleLow.value.fromArray(linear(surface.low));
  u.uStyleHigh.value.fromArray(linear(surface.high));
  u.uStyleRock.value.fromArray(linear(surface.rock));
  u.uStyleHeights.value.set(surface.lowHeightM, surface.highHeightM);
  u.uStyleVariation.value = surface.variation;
  u.uStyleSnow.value = surface.snow;
  u.uSunGain.value = light.sun;
  u.uSkyGain.value = light.sky;
  u.uRidge.value = light.ridge;
  u.uValley.value = light.valley;
  u.uCurvatureTexels.value = light.curvatureTexels;
  u.uHazeMix.value = haze.mix;
  u.uHazeTint.value.fromArray(linear(haze.color));
  u.uSkyMix.value = sky.mix;
  u.uSkyTint.value.fromArray(linear(sky.color));
  u.uWaterTint.value.fromArray(water.tint);
  u.uRiverColor.value.fromArray(linear(water.river));
  u.uRiverMix.value = water.riverMix;
  u.uDecalStrength.value = style.decalStrength;
};

/** 整体调色：作用在三维画布上的 CSS 滤镜。 */
export const gradeFilter = (style: EarthStyle) => {
  const { brightness, contrast, saturation } = style.grade;
  return brightness === 1 && contrast === 1 && saturation === 1
    ? undefined
    : `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
};
