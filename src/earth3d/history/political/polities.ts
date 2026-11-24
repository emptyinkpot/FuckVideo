import type { Polity } from "./types";

/**
 * 政权表。国家层按“领有者”给每个区域涂上它的颜色（颜色在风格里按政权 id 配，见 styles/ 的 political.colors），
 * 占领层用“控制者”的颜色画斜纹。
 *
 * country：属于哪个国家。同一国家内不同政权（国民政府和各地军阀）之间的边界画成细线，国与国之间画成粗线。
 * bloc：阵营，决定色系（日本白色系、国民政府蓝色系、社会主义红色系、其他中性色）。
 * label：国家名标注的位置；sub 为 true 的（军阀、根据地）只在较近的镜头里显示，字也小一些。
 * 日期 YYYY-MM-DD，含起不含止。
 */
export const POLITIES = [
  // ---- 日本阵营 ----
  { id: "japan", name: "日 本", country: "japan", bloc: "japan", label: { lon: 136.0, lat: 38.9 } },
  {
    id: "manchukuo",
    name: "满洲国",
    country: "manchukuo",
    bloc: "japan",
    overlord: "japan",
    from: "1932-03-01",
    to: "1945-08-18",
    label: { lon: 126.5, lat: 46 },
  },

  // ---- 国民政府阵营（中华民国中央与各地军阀） ----
  { id: "roc", name: "中华民国", country: "china", bloc: "nationalist", label: { lon: 110.5, lat: 31.5 } },
  {
    id: "fengtian",
    name: "东北军",
    country: "china",
    bloc: "nationalist",
    to: "1933-03-12",
    sub: true,
    label: { lon: 125.5, lat: 45.0 },
    note: "张学良东北军，1928 年东北易帜后名义上归属国民政府；1930–1933 年兼控平津冀。",
  },
  {
    id: "jinsui",
    name: "晋绥（阎锡山）",
    country: "china",
    bloc: "nationalist",
    sub: true,
    label: { lon: 112.3, lat: 37.6 },
  },
  {
    id: "jicha",
    name: "冀察政务委员会",
    country: "china",
    bloc: "nationalist",
    from: "1935-12-18",
    to: "1937-08-01",
    sub: true,
    label: { lon: 116.0, lat: 38.6 },
  },
  { id: "shandong", name: "山东（韩复榘）", country: "china", bloc: "nationalist", to: "1938-01-24", sub: true, label: { lon: 118.0, lat: 36.3 } },
  { id: "yuegang", name: "粤系（陈济棠）", country: "china", bloc: "nationalist", to: "1936-07-18", sub: true, label: { lon: 113.4, lat: 23.6 } },
  { id: "guixi", name: "新桂系", country: "china", bloc: "nationalist", sub: true, label: { lon: 108.6, lat: 23.8 } },
  { id: "dian", name: "滇系（龙云）", country: "china", bloc: "nationalist", to: "1945-10-03", sub: true, label: { lon: 101.5, lat: 24.9 } },
  { id: "chuan", name: "川系", country: "china", bloc: "nationalist", to: "1938-01-20", sub: true, label: { lon: 103.5, lat: 30.3 } },
  { id: "majia", name: "西北诸马", country: "china", bloc: "nationalist", sub: true, label: { lon: 98.5, lat: 36.2 } },
  { id: "xinjiang", name: "新疆（盛世才）", country: "china", bloc: "nationalist", to: "1944-09-11", sub: true, label: { lon: 85.5, lat: 41.5 } },

  // ---- 社会主义阵营 ----
  { id: "ussr", name: "苏 联", country: "ussr", bloc: "socialist", label: { lon: 108, lat: 56 } },
  { id: "mongolia", name: "蒙古人民共和国", country: "mongolia", bloc: "socialist", overlord: "ussr", label: { lon: 103, lat: 46.5 } },
  {
    id: "ccp",
    name: "陕甘宁边区",
    country: "china",
    bloc: "socialist",
    from: "1935-10-19",
    sub: true,
    label: { lon: 108.6, lat: 37.0 },
    note: "1935 年 10 月中央红军到达陕北；1937 年 9 月正式成立陕甘宁边区。",
  },

  // ---- 其他 ----
  { id: "tibet", name: "西 藏", country: "tibet", bloc: "other", label: { lon: 88.5, lat: 31.8 }, note: "噶厦政府，事实上自治" },
  { id: "uk", name: "英国属地", country: "uk", bloc: "other", sub: true, label: { lon: 101.8, lat: 4.5 } },
  { id: "france", name: "法属印度支那", country: "france", bloc: "other", label: { lon: 105.5, lat: 17.5 } },
  { id: "usa", name: "美属菲律宾", country: "usa", bloc: "other", label: { lon: 122.5, lat: 12.5 } },
  { id: "netherlands", name: "荷属东印度", country: "netherlands", bloc: "other", label: { lon: 113.5, lat: 0.5 } },
  { id: "portugal", name: "澳门（葡）", country: "portugal", bloc: "other", sub: true, label: { lon: 113.55, lat: 22.15 } },
  { id: "siam", name: "暹 罗", country: "siam", bloc: "other", label: { lon: 101.0, lat: 15.5 } },
] as const satisfies readonly Polity[];

/** 政权 id。风格里的政权色板必须为每个 id 配色（少一个类型检查就报错）。 */
export type PolityId = (typeof POLITIES)[number]["id"];

export const polityById = (id: string): Polity | undefined => POLITIES.find((polity) => polity.id === id);

/** 政权在数据纹理里的编号（1 起，0 表示无主）。 */
export const POLITY_INDEX: Record<string, number> = Object.fromEntries(POLITIES.map((polity, index) => [polity.id, index + 1]));
