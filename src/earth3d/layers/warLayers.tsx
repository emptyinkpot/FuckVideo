import type * as THREE from "three";
import { drapedGeometry } from "./geometryCache";
import { createLineMaterial } from "./geoLines";
import type { EarthLayer } from "./types";
import { WAR_ORIGIN, buildArrowGeometry, buildFrontlineGeometry, createArrowMaterial } from "./warLines";

type LonLat = [number, number];

const lineMaterials = new Map<string, ReturnType<typeof createLineMaterial>>();
const arrowMaterials = new Map<string, THREE.ShaderMaterial>();

export type FrontlinesLayerOptions = {
  id?: string;
  /** 每条战线是一串 [经度, 纬度] */
  lines: LonLat[][];
  color?: string;
  widthPx?: number;
  opacity?: number;
  order?: number;
};

/** 战线图层：贴着地形起伏的线。 */
export const frontlinesLayer = ({
  id = "frontlines",
  lines,
  color = "#ffffff",
  widthPx = 3.6,
  opacity = 0.95,
  order = 20,
}: FrontlinesLayerOptions): EarthLayer => ({
  id,
  order,
  opacity,
  objects: (context) => {
    if (lines.length === 0 || opacity <= 0) return null;
    const materialKey = `${id}|${color}|${widthPx}`;
    let material = lineMaterials.get(materialKey);
    if (!material) {
      material = createLineMaterial(color, widthPx, opacity);
      lineMaterials.set(materialKey, material);
    }
    material.uniforms.uOpacity.value = opacity;
    const geometryKey = `${id}|${JSON.stringify(lines)}`;
    const geometry = drapedGeometry(geometryKey, context, () => buildFrontlineGeometry(lines, context.exaggeration));
    return (
      <mesh geometry={geometry} material={material} position={WAR_ORIGIN} renderOrder={5} frustumCulled={false} />
    );
  },
});

export type ArrowSpec = { id: string; from: LonLat; to: LonLat; color?: string };

export type ArrowsLayerOptions = {
  id?: string;
  arrows: ArrowSpec[];
  /** 0..1：箭头从起点长到终点的进度 */
  progress?: number;
  widthPx?: number;
  opacity?: number;
  order?: number;
};

/** 进攻箭头图层：沿大圆贴地，按进度从起点长到终点。 */
export const arrowsLayer = ({
  id = "arrows",
  arrows,
  progress = 1,
  widthPx = 9,
  opacity = 0.92,
  order = 30,
}: ArrowsLayerOptions): EarthLayer => ({
  id,
  order,
  opacity,
  objects: (context) => {
    if (arrows.length === 0 || opacity <= 0) return null;
    return arrows.map((arrow) => {
      const color = arrow.color ?? "#e8473a";
      const materialKey = `${id}|${arrow.id}|${color}|${widthPx}`;
      let material = arrowMaterials.get(materialKey);
      if (!material) {
        material = createArrowMaterial(color, widthPx);
        arrowMaterials.set(materialKey, material);
      }
      material.uniforms.uProgress.value = progress;
      material.uniforms.uOpacity.value = opacity;
      const geometry = drapedGeometry(`${id}|${arrow.id}|${arrow.from}|${arrow.to}`, context, () =>
        buildArrowGeometry(arrow.from, arrow.to, context.exaggeration),
      );
      return (
        <mesh
          key={arrow.id}
          geometry={geometry}
          material={material}
          position={WAR_ORIGIN}
          renderOrder={6}
          frustumCulled={false}
        />
      );
    });
  },
});
