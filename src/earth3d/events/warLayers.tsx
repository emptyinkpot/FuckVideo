import type * as THREE from "three";
import { threeColor } from "../styles";
import type { EarthStyle } from "../styles/types";
import { drapedGeometry } from "../layers/geometryCache";
import { createLineMaterial } from "../layers/geoLines";
import type { EarthLayer } from "../layers/types";
import { WAR_ORIGIN, buildArrowGeometry, buildFrontlineGeometry, createArrowMaterial } from "./warLines";

type LonLat = [number, number];

/** 箭头的阵营；route 为没有阵营的路线（航线、行程），颜色取风格的 events.route。 */
export type ArrowActor = keyof EarthStyle["events"]["actors"] | "route";

const lineMaterials = new Map<string, ReturnType<typeof createLineMaterial>>();
const arrowMaterials = new Map<string, THREE.ShaderMaterial>();

export type FrontlinesLayerOptions = {
  id?: string;
  /** 每条战线是一串 [经度, 纬度] */
  lines: LonLat[][];
  /** 不填按风格（events.frontline） */
  color?: string;
  widthPx?: number;
  opacity?: number;
  order?: number;
};

/** 战线图层：贴着地形起伏的线；颜色、线宽、光晕按风格。 */
export const frontlinesLayer = ({ id = "frontlines", lines, color, widthPx, opacity = 0.95, order = 20 }: FrontlinesLayerOptions): EarthLayer => ({
  id,
  order,
  opacity,
  objects: (context) => {
    if (lines.length === 0 || opacity <= 0) return null;
    const look = context.style.events;
    let material = lineMaterials.get(id);
    if (!material) {
      material = createLineMaterial("#ffffff", 1);
      lineMaterials.set(id, material);
    }
    const u = material.uniforms;
    if (color) u.uColor.value.set(color);
    else u.uColor.value.copy(threeColor(look.frontline));
    u.uWidthPx.value = widthPx ?? look.frontlineWidthPx;
    u.uOpacity.value = opacity;
    u.uGlowPx.value = look.frontlineGlowPx;
    u.uGlowAlpha.value = look.frontlineGlowAlpha;
    const geometryKey = `${id}|${JSON.stringify(lines)}`;
    const geometry = drapedGeometry(geometryKey, context, () => buildFrontlineGeometry(lines, context.exaggeration));
    return <mesh geometry={geometry} material={material} position={WAR_ORIGIN} renderOrder={5} frustumCulled={false} />;
  },
});

/** actor 决定颜色（按风格）；color 只在需要固定颜色时填，会覆盖风格。 */
export type ArrowSpec = { id: string; from: LonLat; to: LonLat; actor?: ArrowActor; color?: string };

export type ArrowsLayerOptions = {
  id?: string;
  arrows: ArrowSpec[];
  /** 0..1：箭头从起点长到终点的进度 */
  progress?: number;
  /** 不填按风格（events.arrowWidthPx） */
  widthPx?: number;
  opacity?: number;
  order?: number;
};

/** 进攻箭头图层：沿大圆贴地，按进度从起点长到终点；颜色按阵营和风格，风格可加光晕。 */
export const arrowsLayer = ({ id = "arrows", arrows, progress = 1, widthPx, opacity = 0.92, order = 30 }: ArrowsLayerOptions): EarthLayer => ({
  id,
  order,
  opacity,
  objects: (context) => {
    if (arrows.length === 0 || opacity <= 0) return null;
    const look = context.style.events;
    return arrows.map((arrow) => {
      const materialKey = `${id}|${arrow.id}`;
      let material = arrowMaterials.get(materialKey);
      if (!material) {
        material = createArrowMaterial("#ffffff", 9);
        arrowMaterials.set(materialKey, material);
      }
      const u = material.uniforms;
      const actor = arrow.actor ?? "other";
      if (arrow.color) u.uColor.value.set(arrow.color);
      else u.uColor.value.copy(threeColor(actor === "route" ? look.route : look.actors[actor]));
      u.uWidthPx.value = widthPx ?? look.arrowWidthPx;
      u.uGlowPx.value = look.arrowGlowPx;
      u.uGlowAlpha.value = look.arrowGlowAlpha;
      u.uProgress.value = progress;
      u.uOpacity.value = opacity;
      const geometry = drapedGeometry(`${id}|${arrow.id}|${arrow.from}|${arrow.to}`, context, () =>
        buildArrowGeometry(arrow.from, arrow.to, context.exaggeration),
      );
      return <mesh key={arrow.id} geometry={geometry} material={material} position={WAR_ORIGIN} renderOrder={6} frustumCulled={false} />;
    });
  },
});
