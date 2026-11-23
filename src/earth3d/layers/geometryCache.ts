import type * as THREE from "three";
import type { LayerContext } from "./types";

type Entry = { version: string; geometry: THREE.BufferGeometry };
const entries = new Map<string, Entry>();

/**
 * 贴地几何的缓存：线条按已加载地形的高度贴地，地形分块变化时要重建。
 * 每个 key 只保留最新一份，旧的立即释放显存，不会随帧数累积。
 */
export const drapedGeometry = (key: string, context: LayerContext, build: () => THREE.BufferGeometry) => {
  const version = `${context.loadedTiles}@${context.exaggeration}`;
  const entry = entries.get(key);
  if (entry && entry.version === version) return entry.geometry;
  entry?.geometry.dispose();
  const geometry = build();
  entries.set(key, { version, geometry });
  return geometry;
};
