import * as THREE from "three";

/**
 * 所有地球材质共享的 uniform。每帧由场景更新一次，各材质引用同一批对象。
 */
export const earthUniforms = {
  uCameraPos: { value: new THREE.Vector3() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  /** 海平面处每公里的消光系数；1/140 约等于 550 公里的能见度。 */
  uHazeDensity: { value: 1 / 140 },
  uTime: { value: 0 },
  /** 屏幕上一个像素对应的角度（弧度），用于河流最小线宽。 */
  uPixelAngle: { value: 0.001 },
};
