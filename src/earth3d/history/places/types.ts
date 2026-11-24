/** 一段时间内的名字。日期 YYYY-MM-DD，含起不含止；不填表示不限。 */
export type NamePeriod = { name: string; from?: string; to?: string };

export type HistoricCity = {
  id: string;
  lon: number;
  lat: number;
  /** 1 首都、特大城市；2 省会、重要港口和枢纽；3 其他 */
  tier: 1 | 2 | 3;
  /** 现代名，没有历史名段覆盖的日期用它 */
  modern: string;
  /** 1930 年代近似人口（千人），同级城市里决定先后 */
  popK: number;
  names?: NamePeriod[];
};

/** 首都一类的地位：national 国家首都，puppet 傀儡政权首都，colonial 殖民地首府，regional 根据地中心 */
export type CapitalKind = "national" | "puppet" | "colonial" | "regional";

export type CapitalPeriod = { city: string; polity: string; kind: CapitalKind; from?: string; to?: string };

const within = (date: string, from?: string, to?: string) => (!from || date >= from) && (!to || date < to);

/** 某一天这座城市叫什么。 */
export const cityNameOn = (city: HistoricCity, date: string) =>
  city.names?.find((period) => within(date, period.from, period.to))?.name ?? city.modern;

/** 某一天这座城市是不是某个政权的首都；是的话返回那一段。 */
export const capitalOn = (capitals: CapitalPeriod[], cityId: string, date: string) =>
  capitals.find((period) => period.city === cityId && within(date, period.from, period.to)) ?? null;
