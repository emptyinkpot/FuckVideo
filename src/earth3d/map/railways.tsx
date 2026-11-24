import * as THREE from "three";
import railwaysUrl from "../assets/railways.bin";
import railwayMeta from "../assets/railways.json";
import { lonLatToVector } from "../core/geo";
import { earthUniforms } from "../globe/materials/earthUniforms";
import { ATMOSPHERE_GLSL } from "../globe/materials/shaderChunks";
import { gunzip, holdUntilDrawn } from "../globe/terrain/tileStore";
import type { PolityId } from "../history/political/polities";
import type { EarthStyle, Rgb } from "../styles/types";
import { buildLineGeometry, type PolylineSet } from "../layers/geoLines";
import type { EarthLayer } from "../layers/types";

/** 经营方：china 中国，japan 日本（含满铁、朝鲜、台湾），manchukuo 满洲国，soviet 俄国/苏联，france 法国 */
export type RailwayOwner = "china" | "japan" | "manchukuo" | "soviet" | "france";

/** 经营方对应的政权（颜色取 styles 的 political.colors）。 */
const OWNER_POLITY: Record<RailwayOwner, PolityId> = {
  china: "roc",
  japan: "japan",
  manchukuo: "manchukuo",
  soviet: "ussr",
  france: "france",
};

type Period<T> = T & { from?: string; to?: string };
type RailwayMeta = {
  lines: Array<{
    id: string;
    name: string;
    names?: Array<Period<{ name: string }>>;
    owner: Array<Period<{ actor: RailwayOwner }>>;
    sections: Array<{ geometry: number; opened: string; approx?: boolean; stations: Array<[string, number, number]> }>;
  }>;
};
const META = railwayMeta as RailwayMeta;

const within = (date: string, from?: string, to?: string) => (!from || date >= from) && (!to || date < to);

/** 某一天这条线叫什么、归谁经营。 */
export const railwayOn = (lineId: string, date: string) => {
  const line = META.lines.find((item) => item.id === lineId);
  if (!line) return null;
  return {
    name: line.names?.find((period) => within(date, period.from, period.to))?.name ?? line.name,
    owner: line.owner.find((period) => within(date, period.from, period.to))?.actor ?? null,
  };
};

/** 全部线路的 id 和名字（编辑、调试用）。 */
export const RAILWAY_LINES = META.lines.map((line) => ({ id: line.id, name: line.name }));

/** 线路网格原点（东亚中部），顶点相对它存放。 */
const ORIGIN = lonLatToVector(115, 35, 0);

let polylines: PolylineSet | null = null;
let promise: Promise<PolylineSet> | null = null;

/** 铁路几何（pipeline/build_railways.py 生成，带地面高度），格式与国界相同。 */
const loadRailways = () => {
  if (!promise) {
    promise = holdUntilDrawn(
      "loading railways",
      gunzip(railwaysUrl).then((buffer) => {
        const [lineCount, vertexCount] = new Uint32Array(buffer, 0, 2);
        let offset = 8;
        const offsets = new Uint32Array(buffer, offset, lineCount + 1);
        offset += (lineCount + 1) * 4 + lineCount * 4;
        const lon = new Float32Array(buffer, offset, vertexCount);
        offset += vertexCount * 4;
        const lat = new Float32Array(buffer, offset, vertexCount);
        offset += vertexCount * 4;
        const height = new Float32Array(buffer, offset, vertexCount);
        polylines = { offsets, lon, lat, height };
        return polylines;
      }),
    );
  }
  return promise;
};

/** 取出若干段几何组成一组折线。 */
const subset = (all: PolylineSet, sections: number[]): PolylineSet => {
  const offsets = [0];
  const lon: number[] = [];
  const lat: number[] = [];
  const height: number[] = [];
  for (const index of sections) {
    for (let k = all.offsets[index]; k < all.offsets[index + 1]; k++) {
      lon.push(all.lon[k]);
      lat.push(all.lat[k]);
      height.push(all.height[k]);
    }
    offsets.push(lon.length);
  }
  return { offsets, lon, lat, height };
};

const geometries = new Map<string, THREE.BufferGeometry>();
const getGeometry = (sections: number[], exaggeration: number) => {
  if (!polylines) return null;
  const key = `${sections.join(",")}@${exaggeration}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = buildLineGeometry(subset(polylines, sections), ORIGIN, exaggeration);
    geometries.set(key, geometry);
    // 日期一变可见区段就变，旧组合不再需要，只留最近几份
    while (geometries.size > 24) {
      const [oldKey, old] = geometries.entries().next().value as [string, THREE.BufferGeometry];
      geometries.delete(oldKey);
      old.dispose();
    }
  }
  return geometry;
};

const linear = (c: Rgb) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);

/**
 * 铁路材质：按像素宽度画的贴地线。dashPx > 0 时是传统地图的铁路符号（外沿 casing 色，
 * 里面一段经营方颜色、一段 dashColor 交替，段长按屏幕像素）；glow 为线外光晕；
 * flow > 0 时有光点沿线流动（每 flowSpacing 像素一个，速度 flow 像素/秒）。
 */
const createRailMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      ...earthUniforms,
      uColor: { value: new THREE.Color() },
      uCasing: { value: new THREE.Color() },
      uDashColor: { value: new THREE.Color() },
      uWidthPx: { value: 2 },
      uOpacity: { value: 1 },
      uDashPx: { value: 0 },
      uGlowPx: { value: 0 },
      uGlowAlpha: { value: 0 },
      uFlow: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSide;
      attribute float aAlong;
      attribute vec3 aTangent;
      uniform vec3 uCameraPos;
      uniform float uPixelAngle;
      uniform float uWidthPx;
      uniform float uGlowPx;
      varying vec3 vWorld;
      varying float vAcross;
      varying float vAlong;
      varying float vPixelKm;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 up = normalize(world);
        float dist = length(uCameraPos - world);
        float pixelKm = dist * uPixelAngle;
        vec3 side = normalize(cross(aTangent, up));
        float total = uWidthPx + 6.0 * uGlowPx;
        vec3 offset = side * aSide * pixelKm * total * 0.5 + up * (0.01 + dist * 0.0008);
        vWorld = world + offset;
        vAcross = aSide;
        vAlong = aAlong;
        vPixelKm = pixelKm;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + inverse(mat3(modelMatrix)) * offset, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uCasing;
      uniform vec3 uDashColor;
      uniform float uWidthPx;
      uniform float uOpacity;
      uniform float uDashPx;
      uniform float uGlowPx;
      uniform float uGlowAlpha;
      uniform float uFlow;
      uniform float uTime;
      varying vec3 vWorld;
      varying float vAcross;
      varying float vAlong;
      varying float vPixelKm;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      ${ATMOSPHERE_GLSL}
      void main() {
        #include <logdepthbuf_fragment>
        float px = abs(vAcross) * (uWidthPx + 6.0 * uGlowPx) * 0.5;
        float halfWidth = uWidthPx * 0.5;
        float core = 1.0 - smoothstep(halfWidth - 0.6, halfWidth + 0.6, px);
        float glow = uGlowPx > 0.0 ? exp(-max(px - halfWidth, 0.0) / uGlowPx) * uGlowAlpha : 0.0;
        float alongPx = vAlong / max(vPixelKm, 1e-6);
        vec3 color = uColor;
        if (uDashPx > 0.0) {
          // 传统铁路符号：外沿一圈 casing，内芯一段经营方颜色、一段浅色
          float inner = 1.0 - smoothstep(halfWidth * 0.5 - 0.5, halfWidth * 0.5 + 0.5, px);
          float dash = step(0.5, fract(alongPx / (2.0 * uDashPx)));
          color = mix(uCasing, mix(uColor, uDashColor, dash), inner);
        }
        if (uFlow > 0.0) {
          // 沿线流动的光点
          float phase = fract((alongPx - uTime * uFlow) / 90.0);
          float pulse = smoothstep(0.0, 0.12, phase) * (1.0 - smoothstep(0.12, 0.3, phase));
          color = mix(color, vec3(1.0), pulse * 0.8);
          glow = max(glow, pulse * 0.6 * exp(-max(px - halfWidth, 0.0) / max(uGlowPx, 1.0)));
        }
        float alpha = max(core, glow) * uOpacity;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(mix(color, e3dApplyHaze(color, vWorld), 0.4), alpha);
        #include <colorspace_fragment>
      }
    `,
  });

const materials = new Map<string, THREE.ShaderMaterial>();
const getMaterial = (key: string) => {
  let material = materials.get(key);
  if (!material) {
    material = createRailMaterial();
    materials.set(key, material);
  }
  return material;
};

const applyLook = (material: THREE.ShaderMaterial, style: EarthStyle, owner: RailwayOwner, focus: boolean, opacity: number) => {
  const look = style.railways;
  const u = material.uniforms;
  // 经营方颜色取国家层的政权色板，写实风格调暗成深色线条（ownerShade）
  const [r, g, b] = style.political.colors[OWNER_POLITY[owner]];
  u.uColor.value.copy(linear([r * look.ownerShade, g * look.ownerShade, b * look.ownerShade]));
  u.uCasing.value.copy(linear(look.casing));
  u.uDashColor.value.copy(linear(look.dashColor));
  u.uWidthPx.value = look.widthPx * (focus ? look.focusWidth : 1);
  u.uOpacity.value = look.alpha * opacity;
  u.uDashPx.value = look.dashPx;
  u.uGlowPx.value = focus ? Math.max(look.glowPx, 4) : look.glowPx;
  u.uGlowAlpha.value = focus ? look.focusGlowAlpha : look.glowAlpha;
  u.uFlow.value = focus ? look.flowPxPerSec : 0;
};

export type RailwaysLayerOptions = {
  /** 只显示这一天已经通车的区段，颜色按这一天的经营方 */
  date: string;
  /** 焦点线路（线路 id，见 assets/railways.json）：更粗、发光，态势图风格下有流光 */
  focus?: string[];
  /** 只显示这些线路；不填显示全部 */
  only?: string[];
  opacity?: number;
  order?: number;
};

/**
 * 1930 年代铁路图层：按日期显示已通车的区段，按当时的经营方着色；画法（传统铁路符号或发光细线）来自风格。
 * 线路走向沿现代铁路网找出（见 pipeline/build_railways.py），通车日期和经营方见 pipeline/railways_source.py。
 */
export const railwaysLayer = ({ date, focus = [], only, opacity = 1, order = 8 }: RailwaysLayerOptions): EarthLayer => ({
  id: "railways",
  order,
  opacity,
  objects: ({ exaggeration, style }) => {
    loadRailways();
    if (!polylines) return null;
    // 按（经营方，是否焦点）分组，每组一个网格
    const groups = new Map<string, { owner: RailwayOwner; focus: boolean; sections: number[] }>();
    for (const line of META.lines) {
      if (only && !only.includes(line.id)) continue;
      const owner = railwayOn(line.id, date)?.owner;
      if (!owner) continue;
      const isFocus = focus.includes(line.id);
      for (const section of line.sections) {
        if (section.opened > date) continue;
        const key = `${owner}|${isFocus}`;
        const group = groups.get(key) ?? { owner, focus: isFocus, sections: [] };
        group.sections.push(section.geometry);
        groups.set(key, group);
      }
    }
    return [...groups.entries()].map(([key, group]) => {
      const geometry = getGeometry(group.sections, exaggeration);
      if (!geometry) return null;
      const material = getMaterial(`${style.id}|${key}`);
      applyLook(material, style, group.owner, group.focus, opacity);
      return (
        <mesh
          key={key}
          geometry={geometry}
          material={material}
          position={ORIGIN}
          renderOrder={group.focus ? 5.5 : 4.5}
          frustumCulled={false}
        />
      );
    });
  },
});
