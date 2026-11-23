import * as THREE from "three";
import { EARTH_RADIUS_KM, lonLatToVector, tileBounds } from "../core/geo";
import { gridForZoom, hasTile, tileKey } from "./tileStore";

export type TileRef = { z: number; x: number; y: number; key: string };

export type TileView = {
  position: THREE.Vector3;
  frustum: THREE.Frustum;
  /** 视口高度 / (2 * tan(fov / 2))：一公里在一公里外占多少像素。 */
  pixelsPerUnit: number;
};

const MIN_ZOOM = 2;
const MAX_ZOOM = 9;
/** 地表最高点留量（公里），用于包围球和地平线判断。 */
const RELIEF_MARGIN_KM = 9;

const sphere = new THREE.Sphere();
const scratch = new THREE.Vector3();

const boundingSphere = (z: number, x: number, y: number) => {
  const b = tileBounds(z, x, y);
  const center = lonLatToVector((b.west + b.east) / 2, (b.north + b.south) / 2, 0);
  let radius = 0;
  for (const [lon, lat] of [
    [b.west, b.north], [b.east, b.north], [b.west, b.south], [b.east, b.south],
    [(b.west + b.east) / 2, b.north], [(b.west + b.east) / 2, b.south],
  ]) {
    radius = Math.max(radius, lonLatToVector(lon, lat, 0, scratch).distanceTo(center));
  }
  return { center, radius: radius + RELIEF_MARGIN_KM, bounds: b };
};

/** 分块网格的几何误差（公里）：网格间距的一半，代表被省略的地形起伏。 */
const geometricError = (z: number, bounds: ReturnType<typeof tileBounds>) => {
  const midLat = ((bounds.north + bounds.south) / 2) * (Math.PI / 180);
  const widthKm = ((bounds.east - bounds.west) / 360) * 2 * Math.PI * EARTH_RADIUS_KM * Math.cos(midLat);
  const heightKm = ((bounds.north - bounds.south) / 360) * 2 * Math.PI * EARTH_RADIUS_KM;
  return (Math.max(widthKm, heightKm) / (gridForZoom(z) - 1)) * 0.5;
};

const childrenAvailable = (z: number, x: number, y: number) =>
  z < MAX_ZOOM &&
  hasTile(z + 1, 2 * x, 2 * y) &&
  hasTile(z + 1, 2 * x + 1, 2 * y) &&
  hasTile(z + 1, 2 * x, 2 * y + 1) &&
  hasTile(z + 1, 2 * x + 1, 2 * y + 1);

/**
 * 四叉树选块：从第 0 级开始，屏幕误差超过 pixelError 且有下一级数据就细分。
 * 视锥外、地平线背后的分块直接剔除。
 */
export const selectTiles = (view: TileView, pixelError = 1.5): TileRef[] => {
  const result: TileRef[] = [];
  const cameraDistance = view.position.length();
  const cameraDir = view.position.clone().normalize();
  // 从地心看，相机到地平线的张角
  const horizonAngle = Math.acos(Math.min(1, EARTH_RADIUS_KM / Math.max(cameraDistance, EARTH_RADIUS_KM + 0.001)));
  const reliefAngle = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + RELIEF_MARGIN_KM));

  const visit = (z: number, x: number, y: number) => {
    const { center, radius, bounds } = boundingSphere(z, x, y);
    if (z >= MIN_ZOOM) {
      sphere.set(center, radius);
      if (!view.frustum.intersectsSphere(sphere)) return;
      const tileAngle = Math.asin(Math.min(1, radius / EARTH_RADIUS_KM));
      const angleToTile = Math.acos(Math.max(-1, Math.min(1, center.clone().normalize().dot(cameraDir))));
      if (angleToTile > horizonAngle + reliefAngle + tileAngle) return;
    }
    const distance = Math.max(0.001, view.position.distanceTo(center) - radius);
    const screenError = (geometricError(z, bounds) * view.pixelsPerUnit) / distance;
    if ((z < MIN_ZOOM || screenError > pixelError) && childrenAvailable(z, x, y)) {
      visit(z + 1, 2 * x, 2 * y);
      visit(z + 1, 2 * x + 1, 2 * y);
      visit(z + 1, 2 * x, 2 * y + 1);
      visit(z + 1, 2 * x + 1, 2 * y + 1);
      return;
    }
    result.push({ z, x, y, key: tileKey(z, x, y) });
  };

  visit(0, 0, 0);
  return result;
};
