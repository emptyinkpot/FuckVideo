import { POLITIES } from "../history/political/polities";
import type { EarthLayer, Projector } from "../layers/types";
import { css } from "../styles";
import { politiesOnDate, worldUnitsOn } from "./provinceStore";

/**
 * 国家、政权名：
 * - 整理的东亚政权（history/political/polities.ts）：当天领有土地的才标，位置按政权表；
 * - 世界其他国家、殖民地：按当年历史底图的国名，位置为其地块的面积加权中心，只标有中文名、面积够大的。
 * 国家一级在国家尺度的镜头里显示；军阀、根据地、小国只在较近的镜头里显示，字也小一些。
 */
const MAIN_KM: [number, number] = [1500, 26000];
const SUB_KM: [number, number] = [450, 3200];

/** 1930–1945 年世界底图上的国名、殖民地名 -> 中文 */
const WORLD_ZH: Record<string, string> = {
  "United Kingdom": "英 国",
  France: "法 国",
  Germany: "德 国",
  Italy: "意大利",
  Spain: "西班牙",
  Portugal: "葡萄牙",
  Netherlands: "荷 兰",
  Belgium: "比利时",
  Poland: "波 兰",
  Czechoslovakia: "捷克斯洛伐克",
  Hungary: "匈牙利",
  Romania: "罗马尼亚",
  Yugoslavia: "南斯拉夫",
  Bulgaria: "保加利亚",
  Greece: "希 腊",
  Turkey: "土耳其",
  Sweden: "瑞 典",
  Norway: "挪 威",
  Finland: "芬 兰",
  Iran: "伊 朗",
  Afghanistan: "阿富汗",
  "Saudi Arabia": "沙特阿拉伯",
  Egypt: "埃 及",
  "British Raj": "英属印度",
  India: "英属印度",
  Nepal: "尼泊尔",
  Bhutan: "不 丹",
  Ceylon: "锡 兰",
  Siam: "暹 罗",
  Thailand: "泰 国",
  "French Indo-China": "法属印度支那",
  Malaysia: "英属马来亚",
  "Dutch East Indies": "荷属东印度",
  Philippines: "美属菲律宾",
  Australia: "澳大利亚",
  "New Zealand": "新西兰",
  "United States": "美 国",
  Canada: "加拿大",
  Mexico: "墨西哥",
  Brazil: "巴 西",
  Argentina: "阿根廷",
  "Union of South Africa": "南 非",
  "French West Africa": "法属西非",
  "French Equatorial Africa": "法属赤道非洲",
  "Belgian Congo": "比属刚果",
  "Algeria (France)": "法属阿尔及利亚",
  Libya: "利比亚",
  Sudan: "苏 丹",
  "Ethiopia (Italy)": "意属埃塞俄比亚",
  "Mesopotamia (GB)": "伊拉克",
  Iraq: "伊拉克",
};
/** 整理的东亚政权已经覆盖的底图国名，不再重复标注 */
const COVERED = new Set(["Empire of Japan", "USSR", "Mongolia", "Chinese warlords", "Tibet", "Xinjiang", "Manchukuo"]);
/** 整理的政权里，这些按历史底图的国名标注 */
const WORLD_LABELED = new Set(["uk", "france", "usa", "netherlands", "portugal", "siam"]);
/** 小于这个面积（平方公里）的国家、殖民地按次一级显示 */
const MAJOR_KM2 = 250000;

const fadeIn = (range: number, [near, far]: [number, number]) =>
  Math.min(1, Math.max(0, (range - near * 0.75) / (near * 0.25))) * Math.min(1, Math.max(0, (far - range) / (far * 0.2)));

/** priority：避让时的先后，整理的东亚政权最先，其余按面积 */
export type RegionLabel = { name: string; lon: number; lat: number; sub: boolean; priority?: number };

/** 不属于政权、但需要标出的地名（日本领有的朝鲜、台湾）。 */
const AREAS = [
  { name: "朝 鲜", lon: 127.4, lat: 39.7, from: "1910-08-29", to: "1945-08-15" },
  { name: "台 湾", lon: 121.0, lat: 23.7, from: "1895-06-17", to: "1945-10-25" },
];

/** 某一天、某个镜头距离下要显示的国家名（城市名据此给它让位）。 */
export const regionLabelsOn = (date: string, rangeKm: number): Array<RegionLabel & { fade: number }> => {
  const owners = politiesOnDate(date);
  const labels: Array<RegionLabel & { fade: number }> = [];
  const add = (label: RegionLabel) => {
    const fade = fadeIn(rangeKm, label.sub ? SUB_KM : MAIN_KM);
    if (fade > 0) labels.push({ ...label, fade });
  };
  for (const polity of POLITIES) {
    // 西方列强及其殖民地、暹罗按历史底图的国名标（英属印度、法属印度支那……），这里不重复
    if (!owners.has(polity.id) || WORLD_LABELED.has(polity.id)) continue;
    add({ name: polity.name, lon: polity.label.lon, lat: polity.label.lat, sub: "sub" in polity && Boolean(polity.sub), priority: 1e12 });
  }
  for (const unit of worldUnitsOn(date)) {
    const zh = WORLD_ZH[unit.name];
    if (!zh || COVERED.has(unit.name)) continue;
    add({ name: zh, lon: unit.lon, lat: unit.lat, sub: unit.areaKm2 < MAJOR_KM2, priority: unit.areaKm2 });
  }
  for (const area of AREAS) {
    if (date >= area.from && date < area.to) add({ name: area.name, lon: area.lon, lat: area.lat, sub: true });
  }
  return labels;
};

/** 国家名文字在画面上大约占多大（像素），给城市名避让用。 */
export const regionLabelSize = (label: RegionLabel): [number, number] =>
  label.sub ? [label.name.length * 19 + 10, 26] : [label.name.length * 28 + 12, 36];

/** 国家、政权名图层；颜色、发光按风格（regions）。 */
export const regionsLayer = ({ date, opacity = 1, order = 42 }: { date: string; opacity?: number; order?: number }): EarthLayer => ({
  id: "regions",
  order,
  opacity,
  labels: (project: Projector, { view, style }) => {
    const look = style.regions;
    const glow = look.glow > 0 ? `, 0 0 ${10 + 8 * look.glow}px ${css(look.text, 0.45 * look.glow)}` : "";
    // 国名之间互相避让：国家一级在前，压住已摆好的就不显示
    const placed: Array<[number, number, number, number]> = [];
    const ordered = regionLabelsOn(date, view.rangeKm).sort(
      (x, y) => Number(x.sub) - Number(y.sub) || (y.priority ?? 0) - (x.priority ?? 0),
    );
    return ordered.map((label) => {
      const at = project(label.lon, label.lat);
      if (!at) return null;
      const [w, h] = regionLabelSize(label);
      const box: [number, number, number, number] = [at.x - w / 2, at.y - h / 2, at.x + w / 2, at.y + h / 2];
      if (placed.some((o) => box[0] < o[2] && o[0] < box[2] && box[1] < o[3] && o[1] < box[3])) return null;
      placed.push(box);
      return (
        <div
          key={label.name}
          style={{
            position: "absolute",
            left: at.x,
            top: at.y,
            transform: "translate(-50%, -50%)",
            opacity: label.fade,
            color: css(look.text, 0.92),
            fontSize: label.sub ? 18 : 26,
            fontWeight: label.sub ? 700 : 800,
            letterSpacing: label.sub ? 2 : 4,
            textShadow: `0 0 6px ${css(look.halo, 0.9)}, 0 0 18px ${css(look.halo, 0.6)}${glow}`,
            whiteSpace: "nowrap",
          }}
        >
          {label.name}
        </div>
      );
    });
  },
});
