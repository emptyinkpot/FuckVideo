import * as THREE from "three";

/**
 * 所有地球材质共享的 uniform。每帧由场景更新一次，各材质引用同一批对象。
 * uStyle* 等风格参数由 styles/index.ts 的 applyStyleUniforms 写入；这里的初始值就是默认风格。
 */
export const earthUniforms = {
  uCameraPos: { value: new THREE.Vector3() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  /** 海平面处每公里的消光系数；1/140 约等于 550 公里的能见度。 */
  uHazeDensity: { value: 1 / 140 },
  uTime: { value: 0 },
  /** 屏幕上一个像素对应的角度（弧度），用于河流最小线宽。 */
  uPixelAngle: { value: 0.001 },

  // ---- 风格（见 styles/types.ts） ----
  uStyleSurface: { value: 0 },
  uStyleLow: { value: new THREE.Vector3() },
  uStyleHigh: { value: new THREE.Vector3() },
  uStyleRock: { value: new THREE.Vector3() },
  uStyleHeights: { value: new THREE.Vector2(200, 2500) },
  uStyleVariation: { value: 0.3 },
  uStyleSnow: { value: 1 },
  uSunGain: { value: 1.45 },
  uSkyGain: { value: 0.24 },
  uRidge: { value: 0 },
  uValley: { value: 0 },
  uCurvatureTexels: { value: 1.5 },
  uHazeMix: { value: 0 },
  uHazeTint: { value: new THREE.Vector3() },
  uSkyMix: { value: 0 },
  uSkyTint: { value: new THREE.Vector3() },
  uWaterTint: { value: new THREE.Vector3(1, 1, 1) },
  uRiverColor: { value: new THREE.Vector3(1, 1, 1) },
  uRiverMix: { value: 0 },
  // 国家层（styles/types.ts 的 political）：x 为填充不透明度
  uPolFill: { value: new THREE.Vector4() },
  uPolEmissive: { value: 0 },
  // 占领层（styles/types.ts 的 occupation）
  /** stripeSpacingPx、stripeWidthPx、stripeAlpha、fill */
  uOccStripe: { value: new THREE.Vector4() },
  /** dashPx、dashSpeed */
  uOccDash: { value: new THREE.Vector2() },
  uOccEmissive: { value: 0 },
};
