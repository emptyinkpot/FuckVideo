import * as THREE from "three";
import { lonLatToVector } from "../core/geo";
import { POLITIES } from "../history/political/polities";
import { buildLineGeometry, createLineMaterial, type PolylineSet } from "../layers/geoLines";
import type { LayerContext } from "../layers/types";
import { threeColor } from "../styles";
import type { PoliticalDate } from "./political";
import { polityColor } from "./political";
import { POLITY_IDS, provinceData, provinceStateOn, type ProvinceState } from "./provinceStore";

/**
 * 国界和前线：从地块边界线（pipeline/build_provinces.py）里挑出当天两侧不同的，画成按屏幕像素宽度的贴地线。
 * - 国界：两侧领有者不同。不同国家之间粗线（风格的 political.international），同一国家内（中央与军阀）细线（internal）；
 * - 前线：一侧被占领或正在争夺、两侧控制者不同。颜色取占领方，占领为实线，争夺为流动虚线（风格的 occupation）。
 * 两个日期之间旧线淡出、新线淡入。
 */

const ORIGIN = lonLatToVector(110, 35, 0);

/** 政权所属的国家：整理的政权按政权表，世界其他国家各自一国。 */
const countryOf = (() => {
  const curated = new Map<string, string>(POLITIES.map((polity) => [polity.id, polity.country]));
  return POLITY_IDS.map((id) => curated.get(id) ?? id);
})();

type Groups = { international: number[]; internal: number[]; fronts: Map<string, { controller: number; dashed: boolean; lines: number[] }> };

const classify = (state: ProvinceState, pairs: Uint32Array): Groups => {
  const groups: Groups = { international: [], internal: [], fronts: new Map() };
  for (let i = 0; i < pairs.length; i++) {
    const a = pairs[i] & 0xffff;
    const b = pairs[i] >>> 16;
    const oa = state.owner[a];
    const ob = state.owner[b];
    if (oa && ob && oa !== ob) {
      (countryOf[oa - 1] !== countryOf[ob - 1] ? groups.international : groups.internal).push(i);
    }
    const sa = state.status[a];
    const sb = state.status[b];
    if (!sa && !sb) continue;
    const ca = sa ? state.controller[a] : oa;
    const cb = sb ? state.controller[b] : ob;
    if (!ca || !cb || ca === cb) continue;
    const side = sa ? a : b;
    const controller = state.controller[side];
    const dashed = state.status[side] === 2;
    const key = `${controller}|${dashed}`;
    const group = groups.fronts.get(key) ?? { controller, dashed, lines: [] };
    group.lines.push(i);
    groups.fronts.set(key, group);
  }
  return groups;
};

const subset = (all: PolylineSet, lines: number[]): PolylineSet => {
  const offsets = [0];
  const lon: number[] = [];
  const lat: number[] = [];
  const height: number[] = [];
  for (const index of lines) {
    for (let k = all.offsets[index]; k < all.offsets[index + 1]; k++) {
      lon.push(all.lon[k]);
      lat.push(all.lat[k]);
      height.push(all.height[k]);
    }
    offsets.push(lon.length);
  }
  return { offsets, lon, lat, height };
};

const groupCache = new Map<ProvinceState, Groups>();
const geometryCache = new Map<string, THREE.BufferGeometry>();
const geometryFor = (key: string, lines: number[], exaggeration: number) => {
  const data = provinceData();
  if (!data || lines.length === 0) return null;
  const fullKey = `${key}@${exaggeration}`;
  let geometry = geometryCache.get(fullKey);
  if (!geometry) {
    geometry = buildLineGeometry(subset(data.borders, lines), ORIGIN, exaggeration);
    geometryCache.set(fullKey, geometry);
    while (geometryCache.size > 48) {
      const [oldKey, old] = geometryCache.entries().next().value as [string, THREE.BufferGeometry];
      geometryCache.delete(oldKey);
      old.dispose();
    }
  }
  return geometry;
};

const materials = new Map<string, ReturnType<typeof createLineMaterial>>();
const materialFor = (key: string) => {
  let material = materials.get(key);
  if (!material) {
    material = createLineMaterial("#ffffff", 1);
    materials.set(key, material);
  }
  return material;
};

const stateGroups = (date: string, contested: string[]) => {
  const data = provinceData();
  if (!data) return null;
  const state = provinceStateOn(date, contested);
  let groups = groupCache.get(state);
  if (!groups) {
    groups = classify(state, data.pairs);
    groupCache.set(state, groups);
    while (groupCache.size > 16) groupCache.delete(groupCache.keys().next().value as ProvinceState);
  }
  return { key: `${date}|${contested.join(",")}`, groups };
};

/** 一个日期（或过渡中的前后两个日期）各自的线和不透明度。 */
const phases = (when: PoliticalDate) => {
  const mix = when.next && when.next.mix > 0 ? when.next.mix : 0;
  const list = [{ date: when.date, contested: when.contested ?? [], weight: 1 - mix }];
  if (when.next && mix > 0) list.push({ date: when.next.date, contested: when.next.contested ?? [], weight: mix });
  return list.filter((phase) => phase.weight > 0.001);
};

/** 国界（国家层的一部分）。 */
export const nationBorders = (when: PoliticalDate, context: LayerContext, opacity: number) => {
  const look = context.style.political;
  return phases(when).flatMap((phase, p) => {
    const found = stateGroups(phase.date, phase.contested);
    if (!found) return [];
    return (["international", "internal"] as const).map((tier) => {
      const geometry = geometryFor(`${found.key}|${tier}`, found.groups[tier], context.exaggeration);
      if (!geometry) return null;
      const line = tier === "international" ? look.international : { ...look.internal, glowPx: 0, glowAlpha: 0 };
      const material = materialFor(`${context.style.id}|${tier}|${p}`);
      const u = material.uniforms;
      u.uColor.value.copy(threeColor(line.color));
      u.uWidthPx.value = line.widthPx;
      u.uOpacity.value = line.alpha * opacity * phase.weight;
      u.uGlowPx.value = line.glowPx;
      u.uGlowAlpha.value = line.glowAlpha;
      return (
        <mesh
          key={`${tier}-${p}`}
          geometry={geometry}
          material={material}
          position={ORIGIN}
          renderOrder={tier === "international" ? 4.2 : 4.1}
          frustumCulled={false}
        />
      );
    });
  });
};

/** 前线（占领层的一部分）。 */
export const frontLines = (when: PoliticalDate, context: LayerContext, opacity: number) => {
  const look = context.style.occupation;
  return phases(when).flatMap((phase, p) => {
    const found = stateGroups(phase.date, phase.contested);
    if (!found) return [];
    return [...found.groups.fronts.entries()].map(([groupKey, group]) => {
      const geometry = geometryFor(`${found.key}|front|${groupKey}`, group.lines, context.exaggeration);
      if (!geometry) return null;
      const material = materialFor(`${context.style.id}|front|${groupKey}|${p}`);
      const u = material.uniforms;
      u.uColor.value.copy(threeColor(polityColor(context.style, POLITY_IDS[group.controller - 1])));
      u.uWidthPx.value = look.frontWidthPx;
      u.uOpacity.value = look.frontAlpha * opacity * phase.weight;
      u.uGlowPx.value = look.frontGlowPx;
      u.uGlowAlpha.value = look.frontGlowAlpha;
      u.uDashPx.value = group.dashed ? look.dashPx : 0;
      u.uDashSpeed.value = look.dashSpeed;
      return (
        <mesh key={`front-${groupKey}-${p}`} geometry={geometry} material={material} position={ORIGIN} renderOrder={4.6} frustumCulled={false} />
      );
    });
  });
};
