import * as THREE from "three";

/** 地球按真实比例建模：1 个场景单位 = 1 公里。 */
export const EARTH_RADIUS_KM = 6371;
export const MAX_MERCATOR_LAT = 85.0511287798066;

const DEG = Math.PI / 180;

/**
 * 经纬度 + 海拔（公里）-> 场景坐标。y 轴指向北极，经度 0 在 +x，东经向 -z 方向增加。
 */
export const lonLatToVector = (
  lon: number,
  lat: number,
  heightKm = 0,
  target = new THREE.Vector3(),
): THREE.Vector3 => {
  const r = EARTH_RADIUS_KM + heightKm;
  const phi = lat * DEG;
  const lambda = lon * DEG;
  const cosPhi = Math.cos(phi);
  return target.set(r * cosPhi * Math.cos(lambda), r * Math.sin(phi), -r * cosPhi * Math.sin(lambda));
};

export const vectorToLonLat = (v: THREE.Vector3): { lon: number; lat: number; heightKm: number } => {
  const r = v.length();
  return {
    lon: Math.atan2(-v.z, v.x) / DEG,
    lat: Math.asin(v.y / r) / DEG,
    heightKm: r - EARTH_RADIUS_KM,
  };
};

/** 某点的东、北、天三个单位方向。 */
export const enuFrame = (lon: number, lat: number) => {
  const up = lonLatToVector(lon, lat, 0).normalize();
  const lambda = lon * DEG;
  const east = new THREE.Vector3(-Math.sin(lambda), 0, -Math.cos(lambda));
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  return { up, east, north };
};

/** Web 墨卡托：瓦片内归一化的 y（0 在北边）-> 纬度。 */
export const mercatorYToLat = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / DEG;

export const latToMercatorY = (lat: number) => {
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  return (1 - Math.asinh(Math.tan(clamped * DEG)) / Math.PI) / 2;
};

export type TileBounds = { west: number; east: number; north: number; south: number };

export const tileBounds = (z: number, x: number, y: number): TileBounds => {
  const n = 2 ** z;
  return {
    west: (x / n) * 360 - 180,
    east: ((x + 1) / n) * 360 - 180,
    north: mercatorYToLat(y / n),
    south: mercatorYToLat((y + 1) / n),
  };
};

export const lonLatToTile = (lon: number, lat: number, z: number) => {
  const n = 2 ** z;
  const x = Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(latToMercatorY(lat) * n)));
  return { x, y };
};

/** 两点间大圆角距（弧度）。 */
export const angularDistance = (lon1: number, lat1: number, lon2: number, lat2: number) => {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dl = (lon2 - lon1) * DEG;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a)));
};
