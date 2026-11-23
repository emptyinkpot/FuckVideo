import * as THREE from "three";
import type { CameraPose } from "../core/camera";
import { lonLatToVector } from "../core/geo";
import { sampleHeight } from "../globe/terrain/tileStore";

const projector = new THREE.PerspectiveCamera(35, 16 / 9, 0.0005, 400000);

/**
 * 把经纬度投影到画面像素坐标，用来在三维地球上方放 HTML 文字（地名、标签）。
 * 地球背面的点、离画面边缘小于 margin 的点返回 null，文字不会半截露在边上。
 */
export const screenProjector = (pose: CameraPose, width: number, height: number, margin = 70) => {
  projector.fov = pose.fovDeg;
  projector.aspect = width / height;
  projector.position.copy(pose.position);
  projector.up.copy(pose.up);
  projector.lookAt(pose.target);
  projector.updateProjectionMatrix();
  projector.updateMatrixWorld(true);
  return (lon: number, lat: number): { x: number; y: number } | null => {
    const point = lonLatToVector(lon, lat, Math.max(0, sampleHeight(lon, lat)) / 1000);
    if (pose.position.clone().sub(point).dot(point.clone().normalize()) <= 0) return null;
    const ndc = point.project(projector);
    if (ndc.z > 1) return null;
    const x = ((ndc.x + 1) / 2) * width;
    const y = ((1 - ndc.y) / 2) * height;
    if (x < margin || x > width - margin || y < 50 || y > height - 30) return null;
    return { x, y };
  };
};
