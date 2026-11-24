/**
 * 政治地理的数据结构：政权、区域、领有和控制的时间段。只放史实，不放颜色和画法。
 * 日期 YYYY-MM-DD，含起不含止；不填表示不限。
 */

export type Bloc = "japan" | "nationalist" | "socialist" | "other";

export type Polity = {
  id: string;
  name: string;
  /** 所属国家：同一国家内不同政权之间画细线，国与国之间画粗线 */
  country: string;
  bloc: Bloc;
  /** 宗主（傀儡、附庸） */
  overlord?: string;
  from?: string;
  to?: string;
  /** 国家名标注位置 */
  label: { lon: number; lat: number };
  /** 军阀、根据地等次一级的政权：标注只在较近的镜头显示 */
  sub?: boolean;
  note?: string;
};

/** 区域的几何：中国省级区块、1938 年世界底图的国家（可只取部分多边形）、或手画的近似范围。 */
export type RegionGeometry =
  | { source: "province"; name: string }
  | { source: "world"; name: string; parts?: number[] }
  | { source: "custom"; polygon: Array<[number, number]> };

export type PoliticalRegion = {
  id: string;
  name: string;
  geometry: RegionGeometry;
  /** 几何是否只是近似（例如现代省界代替历史省界、手画的根据地范围） */
  approx?: boolean;
  note?: string;
};

/** 领有：这段时间这个区域归哪个政权。同一区域的领有时间段不能重叠。 */
export type OwnerPeriod = { region: string; owner: string; from?: string; to?: string; note?: string };

/**
 * 控制：这段时间这个区域实际由别的政权控制。
 * occupied：被占领（领有者的底色上画控制者颜色的斜纹）；contested：正在争夺（动态虚线，颜色取进攻方）。
 */
export type ControlPeriod = {
  region: string;
  controller: string;
  status: "occupied" | "contested";
  from?: string;
  to?: string;
  note?: string;
};
