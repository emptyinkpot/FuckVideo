import type { PoliticalRegion } from "./types";

/**
 * 区域，按绘制顺序排列：先画 1938 年世界底图的各国，再用中国省级区块覆盖，最后画手画的范围。
 * 1938 年底图里朝鲜和满洲是“日本帝国”的同一块多边形（第 57 部分），中国东北各省画上去之后，剩下的正好是朝鲜。
 * 中国境内用现代省界代替历史省界（热河、察哈尔、绥远等已不存在的省并入了现代的省区），只是近似。
 */
const WORLD = (id: string, name: string, world: string, note?: string): PoliticalRegion => ({
  id,
  name,
  geometry: { source: "world", name: world },
  ...(note ? { note } : {}),
});

const PROVINCE = (id: string, name: string, note?: string): PoliticalRegion => ({
  id,
  name,
  geometry: { source: "province", name },
  approx: true,
  ...(note ? { note } : {}),
});

export const REGIONS: PoliticalRegion[] = [
  // ---- 1938 年世界底图 ----
  WORLD("japan-empire", "日本帝国（本土、朝鲜、台湾、库页岛南部等）", "Empire of Japan"),
  WORLD("saipan", "南洋群岛", "Saipan"),
  WORLD("ussr", "苏联", "USSR"),
  WORLD("mongolia", "蒙古", "Mongolia"),
  WORLD("indochina", "法属印度支那", "French Indo-China"),
  WORLD("cochinchina", "交趾支那", "Cochin China"),
  WORLD("cambodia", "柬埔寨", "Cambodia"),
  WORLD("laos", "老挝", "Laos"),
  WORLD("siam", "暹罗", "Siam"),
  WORLD("malaya", "英属马来亚", "Malaysia"),
  WORLD("brunei", "文莱", "Brunei"),
  WORLD("raj", "英属印度", "British Raj"),
  WORLD("philippines", "菲律宾", "Philippines"),
  WORLD("guam", "关岛", "Guam"),
  WORLD("dei", "荷属东印度", "Dutch East Indies"),
  WORLD("hongkong-world", "香港", "Hong Kong"),

  // ---- 中国省级区块（覆盖在底图之上） ----
  PROVINCE("liaoning", "辽宁省"),
  PROVINCE("jilin", "吉林省"),
  PROVINCE("heilongjiang", "黑龙江省"),
  PROVINCE("inner-mongolia", "内蒙古自治区", "现代内蒙古东部当年属满洲国兴安各省，西部为绥远、察哈尔，这里整块按绥远一带的归属处理。"),
  PROVINCE("beijing", "北京市"),
  PROVINCE("tianjin", "天津市"),
  PROVINCE("hebei", "河北省", "热河省大部并入现代河北、辽宁、内蒙古，无法单独表示。"),
  PROVINCE("shanxi", "山西省"),
  PROVINCE("shandong", "山东省"),
  PROVINCE("henan", "河南省"),
  PROVINCE("jiangsu", "江苏省"),
  PROVINCE("shanghai", "上海市"),
  PROVINCE("zhejiang", "浙江省"),
  PROVINCE("anhui", "安徽省"),
  PROVINCE("jiangxi", "江西省"),
  PROVINCE("hubei", "湖北省"),
  PROVINCE("hunan", "湖南省"),
  PROVINCE("fujian", "福建省"),
  PROVINCE("guangdong", "广东省"),
  PROVINCE("hainan", "海南省", "当年属广东省。"),
  PROVINCE("guangxi", "广西壮族自治区"),
  PROVINCE("guizhou", "贵州省"),
  PROVINCE("yunnan", "云南省"),
  PROVINCE("sichuan", "四川省", "当年还包括西康省东部。"),
  PROVINCE("chongqing", "重庆市"),
  PROVINCE("shaanxi", "陕西省"),
  PROVINCE("gansu", "甘肃省"),
  PROVINCE("ningxia", "宁夏回族自治区"),
  PROVINCE("qinghai", "青海省"),
  PROVINCE("xinjiang", "新疆维吾尔自治区"),
  PROVINCE("tibet", "西藏自治区"),
  PROVINCE("taiwan", "台湾省"),
  PROVINCE("hongkong", "香港特别行政区"),
  PROVINCE("macau", "澳门特别行政区"),

  // ---- 手画的近似范围（覆盖在省级区块之上） ----
  {
    id: "shaanganning",
    name: "陕甘宁边区",
    approx: true,
    note: "按 1937–1940 年前后的大致范围手画：陕北、陇东、宁夏东南，延安为中心；不是精确边界。",
    geometry: {
      source: "custom",
      polygon: [
        [107.2, 37.6], [108.0, 37.8], [108.6, 37.95], [109.6, 38.3], [110.5, 38.05],
        [110.6, 37.3], [110.45, 36.4], [110.0, 35.95], [109.4, 35.8], [108.6, 35.6],
        [107.8, 35.4], [107.2, 35.7], [106.6, 36.2], [106.8, 37.0], [107.2, 37.6],
      ],
    },
  },
];
