import * as THREE from "three";
import riversUrl from "../assets/rivers.bin";
import { lonLatToVector } from "../core/geo";
import { gunzip, holdUntilDrawn } from "../terrain/tileStore";

export type RiverData = {
  offsets: Uint32Array;
  widths: Float32Array;
  lon: Float32Array;
  lat: Float32Array;
  height: Float32Array;
};

let riverData: RiverData | null = null;
let riverPromise: Promise<RiverData> | null = null;

export const getRivers = () => riverData;

export const loadRivers = (): Promise<RiverData> => {
  if (!riverPromise) {
    riverPromise = holdUntilDrawn(
      "loading rivers",
      gunzip(riversUrl).then((buffer) => {
        const header = new Uint32Array(buffer, 0, 2);
        const [reachCount, vertexCount] = [header[0], header[1]];
        let offset = 8;
        const offsets = new Uint32Array(buffer, offset, reachCount + 1);
        offset += (reachCount + 1) * 4;
        const widths = new Float32Array(buffer, offset, reachCount);
        offset += reachCount * 4;
        const lon = new Float32Array(buffer, offset, vertexCount);
        offset += vertexCount * 4;
        const lat = new Float32Array(buffer, offset, vertexCount);
        offset += vertexCount * 4;
        const height = new Float32Array(buffer, offset, vertexCount);
        riverData = { offsets, widths, lon, lat, height };
        return riverData;
      }),
    );
  }
  return riverPromise;
};

/** 河网的原点（战区中部），顶点相对它存放。 */
export const RIVER_ORIGIN = lonLatToVector(121.5, 36, 0);

const meshCache = new Map<number, THREE.BufferGeometry>();

/**
 * 把河网做成贴地的带状网格。每个顶点成对出现（左岸、右岸），
 * 真正的宽度在顶点着色器里按河宽和镜头距离展开。
 */
export const buildRiverGeometry = (data: RiverData, exaggeration = 1) => {
  const cached = meshCache.get(exaggeration);
  if (cached) return cached;
  const reachCount = data.widths.length;
  const vertexCount = data.lon.length;
  const positions = new Float32Array(vertexCount * 2 * 3);
  const tangents = new Float32Array(vertexCount * 2 * 3);
  const sides = new Float32Array(vertexCount * 2);
  const widths = new Float32Array(vertexCount * 2);
  const indices: number[] = [];
  const world: THREE.Vector3[] = [];
  const tangent = new THREE.Vector3();
  for (let r = 0; r < reachCount; r++) {
    const start = data.offsets[r];
    const end = data.offsets[r + 1];
    world.length = 0;
    for (let k = start; k < end; k++) {
      world.push(lonLatToVector(data.lon[k], data.lat[k], (data.height[k] / 1000) * exaggeration));
    }
    for (let k = start; k < end; k++) {
      const local = k - start;
      const prev = world[Math.max(0, local - 1)];
      const next = world[Math.min(world.length - 1, local + 1)];
      tangent.subVectors(next, prev).normalize();
      for (let side = 0; side < 2; side++) {
        const v = k * 2 + side;
        positions[v * 3] = world[local].x - RIVER_ORIGIN.x;
        positions[v * 3 + 1] = world[local].y - RIVER_ORIGIN.y;
        positions[v * 3 + 2] = world[local].z - RIVER_ORIGIN.z;
        tangents[v * 3] = tangent.x;
        tangents[v * 3 + 1] = tangent.y;
        tangents[v * 3 + 2] = tangent.z;
        sides[v] = side === 0 ? -1 : 1;
        widths[v] = data.widths[r] / 1000;
      }
      if (k < end - 1) {
        const a = k * 2;
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aTangent", new THREE.BufferAttribute(tangents, 3));
  geometry.setAttribute("aSide", new THREE.BufferAttribute(sides, 1));
  geometry.setAttribute("aWidth", new THREE.BufferAttribute(widths, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  meshCache.set(exaggeration, geometry);
  return geometry;
};
