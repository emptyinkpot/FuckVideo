import * as THREE from "three";
import type { PolityId } from "../history/political/polities";
import type { DecalSource, EarthLayer } from "../layers/types";
import type { EarthStyle, Rgb } from "../styles/types";
import { nationBorders } from "./borderLines";
import { LOOKUP_SIZE, POLITY_IDS, loadProvinces, lookupTexture, provinceData, provinceStateOn } from "./provinceStore";

/** 日期选项：这一天的状态、事件额外标为争夺的区域、过渡到下一个日期。 */
export type PoliticalDate = {
  date: string;
  contested?: string[];
  next?: { date: string; contested?: string[]; mix: number } | null;
};

/** 世界其他国家按国名取中性色（同一个国家在任何日期都是同一种颜色）。 */
const slotOf = (name: string, count: number) => {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 16777619);
  return (hash >>> 0) % count;
};

/** 政权的颜色：手工整理的东亚政权按风格逐个配色，其他国家从中性色板取。 */
export const polityColor = (style: EarthStyle, id: string): Rgb => {
  const curated = style.political.colors[id as PolityId];
  if (curated) return curated;
  const slots = style.political.slots;
  return slots[slotOf(id, slots.length)];
};

const palettes = new Map<string, THREE.DataTexture>();

/** 政权色板（按风格）：第 i 个像素是编号 i 的政权的颜色，0 号透明（无主、海洋）。 */
export const politicalPalette = (style: EarthStyle) => {
  let texture = palettes.get(style.id);
  if (!texture) {
    const width = 1024;
    const data = new Uint8Array(width * 4);
    POLITY_IDS.slice(0, width - 1).forEach((id, index) => {
      const [r, g, b] = polityColor(style, id);
      data.set([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255], (index + 1) * 4);
    });
    texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    palettes.set(style.id, texture);
  }
  return texture;
};

/** 国家层、占领层共用：地块编号图、当天（和过渡目标日期）的对照表、色板。 */
export const politicalDecal = (mode: DecalSource["mode"], when: PoliticalDate, style: EarthStyle): DecalSource | null => {
  loadProvinces();
  const data = provinceData();
  if (!data) return null;
  const a = lookupTexture(provinceStateOn(when.date, when.contested ?? []));
  const b = when.next && when.next.mix > 0 ? lookupTexture(provinceStateOn(when.next.date, when.next.contested ?? [])) : null;
  return {
    mode,
    provinces: { global: data.global, detail: data.detail },
    lookupA: a,
    lookupB: b,
    mix: when.next?.mix ?? 0,
    lookupWidth: LOOKUP_SIZE[0],
    palette: politicalPalette(style),
  };
};

/**
 * 国家层：按领有政权给每个地块涂色。日本阵营白色系、国民政府阵营蓝色系、社会主义阵营红色系；
 * 世界其他国家中性色，殖民地取宗主国的颜色。国界是另外的贴地线（map/borderLines.tsx）。
 */
export const nationsLayer = ({ opacity = 1, order = 0, ...when }: PoliticalDate & { opacity?: number; order?: number }): EarthLayer => ({
  id: "nations",
  order,
  opacity,
  decal: (context) => politicalDecal("nations", when, context.style),
  objects: (context) => nationBorders(when, context, opacity),
});
