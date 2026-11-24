import { CAPITALS, CITIES_1930S } from "../history/places/cities";
import { capitalOn, cityNameOn, type CapitalKind, type HistoricCity } from "../history/places/types";
import type { Rgb } from "../styles/types";
import type { EarthLayer } from "../layers/types";

export type CitiesLayerOptions = {
  /** 按这一天显示当时的名字和首都标记 */
  date: string;
  /** 只显示到哪一级（1 最重要），默认 3 */
  maxTier?: 1 | 2 | 3;
  /** 换用别的城市表，默认 1930 年代东亚城市 */
  cities?: HistoricCity[];
  /** 画面上要避开的矩形（像素：x、y、宽、高），例如字幕卡片 */
  avoid?: Array<[number, number, number, number]>;
  /** 要让位的其他文字（经纬度和像素大小），例如国家名；按镜头距离给出 */
  reserve?: (rangeKm: number) => Array<{ lon: number; lat: number; size: [number, number] }>;
  opacity?: number;
  order?: number;
};

/** 各级城市在镜头距离多远（公里）以内显示；超过后在 FADE 倍距离内淡出。 */
const VISIBLE_KM: Record<1 | 2 | 3, number> = { 1: 15000, 2: 3500, 3: 1200 };
const FADE = 1.35;
const FONT_PX: Record<1 | 2 | 3, number> = { 1: 21, 2: 17, 3: 14 };
const WEIGHT: Record<1 | 2 | 3, number> = { 1: 900, 2: 800, 3: 700 };

const css = (c: Rgb, alpha = 1) => `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${alpha})`;

/** 城市符号：首都星形（傀儡政权空心星），殖民地首府方形，根据地中心带圈圆点，一般城市按级别大小不同的圆点。 */
const Symbol = ({ tier, capital, dot, star }: { tier: 1 | 2 | 3; capital: CapitalKind | null; dot: Rgb; star: Rgb }) => {
  const shadow = "drop-shadow(0 0 2px rgba(0,0,0,0.9))";
  if (capital === "national" || capital === "puppet") {
    const size = 16;
    return (
      <svg width={size} height={size} viewBox="-10 -10 20 20" style={{ filter: shadow, flex: "none" }}>
        <polygon
          points="0,-9 2.6,-3 9,-2.8 4,1.6 5.6,8.2 0,4.6 -5.6,8.2 -4,1.6 -9,-2.8 -2.6,-3"
          fill={capital === "national" ? css(star) : "none"}
          stroke={css(star)}
          strokeWidth={capital === "national" ? 0.8 : 1.8}
        />
      </svg>
    );
  }
  if (capital === "colonial") {
    return <div style={{ width: 9, height: 9, background: css(star), border: "1.5px solid rgba(0,0,0,0.6)", flex: "none", filter: shadow }} />;
  }
  const size = capital === "regional" ? 10 : tier === 1 ? 10 : tier === 2 ? 8 : 6;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: css(dot),
        boxShadow: capital === "regional" ? `0 0 0 2px ${css(star)}` : tier === 1 ? "0 0 0 2px rgba(0,0,0,0.55)" : "0 0 0 1.5px rgba(0,0,0,0.6)",
        flex: "none",
      }}
    />
  );
};

type Placed = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Placed, b: Placed) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * 城市图层：按日期显示当时的名字（北平、奉天、新京、京城……）和首都标记；
 * 按镜头距离分级显示，远处只有首都和大城市；按重要程度依次摆放，文字互相压住的就不显示。
 * 颜色、发光、字号来自风格（styles/ 的 cities）。
 */
export const citiesLayer = ({
  date,
  maxTier = 3,
  cities = CITIES_1930S,
  avoid = [],
  reserve,
  opacity = 1,
  order = 40,
}: CitiesLayerOptions): EarthLayer => ({
  id: "cities",
  order,
  opacity,
  labels: (project, { view, width, height, style }) => {
    const look = style.cities;
    const candidates = cities
      .filter((city) => city.tier <= maxTier)
      .map((city) => {
        const capital = capitalOn(CAPITALS, city.id, date);
        // 首都至少按二级显示
        const tier = (capital && capital.kind !== "regional" ? Math.min(city.tier, 2) : city.tier) as 1 | 2 | 3;
        const limit = VISIBLE_KM[tier];
        const fade = view.rangeKm <= limit ? 1 : Math.max(0, 1 - (view.rangeKm - limit) / (limit * (FADE - 1)));
        return { city, tier, capital, fade };
      })
      .filter((item) => item.fade > 0)
      .sort(
        (a, b) =>
          Number(Boolean(b.capital)) - Number(Boolean(a.capital)) || a.tier - b.tier || b.city.popK - a.city.popK,
      );

    const placed: Placed[] = avoid.map(([x, y, w, h]) => ({ x0: x, y0: y, x1: x + w, y1: y + h }));
    if (reserve) {
      for (const place of reserve(view.rangeKm)) {
        const at = project(place.lon, place.lat);
        if (!at) continue;
        const [w, h] = place.size;
        placed.push({ x0: at.x - w / 2, y0: at.y - h / 2, x1: at.x + w / 2, y1: at.y + h / 2 });
      }
    }
    const nodes = [];
    for (const { city, tier, capital, fade } of candidates) {
      const at = project(city.lon, city.lat);
      if (!at) continue;
      const name = cityNameOn(city, date);
      const font = FONT_PX[tier] * look.fontScale;
      const textWidth = font * name.length * 1.02;
      const boxHeight = font * 1.3;
      const symbol = 16;
      // 先试圆点右边，再试左边
      let side: "right" | "left" | null = null;
      for (const option of ["right", "left"] as const) {
        const x0 = option === "right" ? at.x - symbol / 2 : at.x - symbol / 2 - textWidth - 6;
        const box = { x0, y0: at.y - boxHeight / 2, x1: x0 + symbol + 6 + textWidth, y1: at.y + boxHeight / 2 };
        if (box.x0 < 4 || box.x1 > width - 4 || box.y0 < 4 || box.y1 > height - 4) continue;
        if (placed.some((other) => overlaps(box, other))) continue;
        placed.push(box);
        side = option;
        break;
      }
      if (!side) continue;
      const glow = look.glow > 0 ? `, 0 0 ${8 + 6 * look.glow}px ${css(look.dot, 0.55 * look.glow)}` : "";
      nodes.push(
        <div
          key={city.id}
          style={{
            position: "absolute",
            left: at.x,
            top: at.y,
            display: "flex",
            flexDirection: side === "right" ? "row" : "row-reverse",
            alignItems: "center",
            gap: 6,
            transform: side === "right" ? "translate(-8px, -50%)" : "translate(calc(-100% + 8px), -50%)",
            opacity: fade,
            color: css(look.text),
            fontSize: font,
            fontWeight: WEIGHT[tier],
            letterSpacing: tier === 1 ? 1 : 0,
            whiteSpace: "nowrap",
            textShadow: `0 0 3px ${css(look.halo, 0.95)}, 0 0 10px ${css(look.halo, 0.7)}${glow}`,
          }}
        >
          <Symbol tier={tier} capital={capital?.kind ?? null} dot={look.dot} star={look.capital} />
          {name}
        </div>,
      );
    }
    return nodes;
  },
});
