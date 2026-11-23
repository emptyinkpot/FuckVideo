import * as THREE from "three";
import { EARTH_RADIUS_KM, angularDistance, enuFrame, lonLatToVector, vectorToLonLat } from "./geo";

/**
 * 地理相机：盯住地面上一点，从一定距离、俯仰和朝向去看。
 * - rangeKm：相机到目标点的直线距离
 * - pitchDeg：0 为垂直向下俯视，越大越倾斜，接近 90 为平视
 * - headingDeg：画面上方朝向，0 为正北，90 为正东
 */
export type GeoCamera = {
  lon: number;
  lat: number;
  rangeKm: number;
  pitchDeg: number;
  headingDeg: number;
  /** 目标点的海拔（公里），一般取地面高度 */
  targetHeightKm?: number;
  fovDeg?: number;
};

export type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  fovDeg: number;
};

const DEG = Math.PI / 180;

export const cameraPose = (camera: GeoCamera): CameraPose => {
  const { up, east, north } = enuFrame(camera.lon, camera.lat);
  const target = lonLatToVector(camera.lon, camera.lat, camera.targetHeightKm ?? 0);
  const heading = camera.headingDeg * DEG;
  const pitch = camera.pitchDeg * DEG;
  const forward = north.clone().multiplyScalar(Math.cos(heading)).addScaledVector(east, Math.sin(heading));
  const offset = up
    .clone()
    .multiplyScalar(Math.cos(pitch))
    .addScaledVector(forward, -Math.sin(pitch))
    .multiplyScalar(camera.rangeKm);
  const screenUp = forward.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
  return {
    position: target.clone().add(offset),
    target,
    up: screenUp,
    fovDeg: camera.fovDeg ?? 35,
  };
};

export const altitudeKm = (pose: CameraPose) => pose.position.length() - EARTH_RADIUS_KM;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const lerpAngle = (a: number, b: number, t: number) => {
  let delta = ((b - a + 540) % 360) - 180;
  if (delta < -180) delta += 360;
  return a + delta * t;
};

/**
 * 两个镜头之间的过渡：目标点沿大圆移动，距离按对数插值；
 * 两地相距较远时中途拉高，像飞机先爬升再下降。
 */
export const interpolateCamera = (from: GeoCamera, to: GeoCamera, rawT: number): GeoCamera => {
  const t = easeInOut(Math.min(1, Math.max(0, rawT)));
  const a = lonLatToVector(from.lon, from.lat).normalize();
  const b = lonLatToVector(to.lon, to.lat).normalize();
  const omega = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  const point =
    omega < 1e-6
      ? a.clone()
      : a
          .clone()
          .multiplyScalar(Math.sin((1 - t) * omega) / Math.sin(omega))
          .addScaledVector(b, Math.sin(t * omega) / Math.sin(omega));
  const { lon, lat } = vectorToLonLat(point.multiplyScalar(EARTH_RADIUS_KM));
  const travelKm = angularDistance(from.lon, from.lat, to.lon, to.lat) * EARTH_RADIUS_KM;
  const logFrom = Math.log(from.rangeKm);
  const logTo = Math.log(to.rangeKm);
  const apex = Math.log(Math.max(from.rangeKm, to.rangeKm, travelKm * 1.1));
  const lift = Math.max(0, apex - Math.max(logFrom, logTo));
  const logRange = logFrom + (logTo - logFrom) * t + 4 * t * (1 - t) * lift;
  return {
    lon,
    lat,
    rangeKm: Math.exp(logRange),
    pitchDeg: from.pitchDeg + (to.pitchDeg - from.pitchDeg) * t,
    headingDeg: lerpAngle(from.headingDeg, to.headingDeg, t),
    targetHeightKm: (from.targetHeightKm ?? 0) + ((to.targetHeightKm ?? 0) - (from.targetHeightKm ?? 0)) * t,
    fovDeg: (from.fovDeg ?? 35) + ((to.fovDeg ?? 35) - (from.fovDeg ?? 35)) * t,
  };
};

export type CameraKeyframe = { frame: number; camera: GeoCamera };

/** 按帧在关键帧之间取镜头；关键帧之间都用 interpolateCamera 过渡。 */
export const cameraAtFrame = (keyframes: CameraKeyframe[], frame: number): GeoCamera => {
  if (keyframes.length === 0) throw new Error("earth3d: no camera keyframes");
  if (frame <= keyframes[0].frame) return keyframes[0].camera;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const current = keyframes[i];
    const next = keyframes[i + 1];
    if (frame <= next.frame) {
      return interpolateCamera(current.camera, next.camera, (frame - current.frame) / (next.frame - current.frame));
    }
  }
  return keyframes[keyframes.length - 1].camera;
};

/** 以目标点为参照摆放太阳：方位角从正北顺时针，高度角为太阳离地平线的角度。 */
export const sunDirection = (lon: number, lat: number, azimuthDeg: number, elevationDeg: number) => {
  const { up, east, north } = enuFrame(lon, lat);
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return north
    .multiplyScalar(Math.cos(az) * Math.cos(el))
    .addScaledVector(east, Math.sin(az) * Math.cos(el))
    .addScaledVector(up, Math.sin(el))
    .normalize();
};
