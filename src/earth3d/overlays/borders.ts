import type * as THREE from "three";
import bordersUrl from "../assets/borders-1938.bin";
import { lonLatToVector } from "../core/geo";
import { gunzip, holdUntilDrawn } from "../terrain/tileStore";
import { buildLineGeometry, type PolylineSet } from "./geoLines";

/** 国界线的网格原点（东亚中部）。 */
export const BORDER_ORIGIN = lonLatToVector(110, 35, 0);

let borders: PolylineSet | null = null;
let promise: Promise<PolylineSet> | null = null;
const geometries = new Map<number, THREE.BufferGeometry>();

/** 1938 年陆上国界（海岸线已剔除），由 scripts/build_borders.py 生成，带地面高度。 */
export const loadBorders = () => {
  if (!promise) {
    promise = holdUntilDrawn(
      "loading 1938 borders",
      gunzip(bordersUrl).then((buffer) => {
        const [lineCount, vertexCount] = new Uint32Array(buffer, 0, 2);
        let offset = 8;
        const offsets = new Uint32Array(buffer, offset, lineCount + 1);
        offset += (lineCount + 1) * 4 + lineCount * 4;
        const lon = new Float32Array(buffer, offset, vertexCount);
        offset += vertexCount * 4;
        const lat = new Float32Array(buffer, offset, vertexCount);
        offset += vertexCount * 4;
        const height = new Float32Array(buffer, offset, vertexCount);
        borders = { offsets, lon, lat, height };
        return borders;
      }),
    );
  }
  return promise;
};

export const getBorderGeometry = (exaggeration = 1) => {
  if (!borders) return null;
  let geometry = geometries.get(exaggeration);
  if (!geometry) {
    geometry = buildLineGeometry(borders, BORDER_ORIGIN, exaggeration);
    geometries.set(exaggeration, geometry);
  }
  return geometry;
};
