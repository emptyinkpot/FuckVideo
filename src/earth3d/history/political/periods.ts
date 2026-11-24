import type { ControlPeriod, OwnerPeriod } from "./types";

/**
 * 1931–1946 年东亚各区域的领有和控制。中国境内按省，只能表达大势：
 * - 日军在华北、华中多是“点线占领”（城市和铁路沿线），按省画占领会夸大范围；
 *   一省只有部分被占、战事反复的，标为 contested（争夺）而不是 occupied；
 * - 华北临时政府、维新政府、汪精卫政权、蒙疆治下的地方，按“国民政府领有、日本控制”记；
 * - 满洲国作为单独的政权领有东北三省；
 * - 军阀的割据按大致时间段整理，省内的再分割（如四川各防区）合并为一个。
 */

const own = (region: string, owner: string, from?: string, to?: string, note?: string): OwnerPeriod => ({
  region,
  owner,
  ...(from ? { from } : {}),
  ...(to ? { to } : {}),
  ...(note ? { note } : {}),
});

const occupied = (region: string, from: string, to: string, controller = "japan", note?: string): ControlPeriod => ({
  region,
  controller,
  status: "occupied",
  from,
  to,
  ...(note ? { note } : {}),
});

const contested = (region: string, from: string, to: string, controller = "japan", note?: string): ControlPeriod => ({
  region,
  controller,
  status: "contested",
  from,
  to,
  ...(note ? { note } : {}),
});

const END = "1946-07-01";

export const OWNERS: OwnerPeriod[] = [
  // ---- 1938 年世界底图 ----
  own("japan-empire", "japan", undefined, undefined, "1945 年投降后朝鲜等在这张底图上仍按日本领有（底图不区分朝鲜和日本本土）。"),
  own("saipan", "japan"),
  own("ussr", "ussr"),
  own("mongolia", "mongolia"),
  own("indochina", "france"),
  own("cochinchina", "france"),
  own("cambodia", "france"),
  own("laos", "france"),
  own("siam", "siam"),
  own("malaya", "uk"),
  own("brunei", "uk"),
  own("raj", "uk"),
  own("hongkong-world", "uk"),
  own("philippines", "usa"),
  own("guam", "usa"),
  own("dei", "netherlands"),

  // ---- 东北 ----
  own("liaoning", "fengtian", undefined, "1932-03-01"),
  own("liaoning", "manchukuo", "1932-03-01", "1945-08-18"),
  own("liaoning", "roc", "1945-08-18"),
  own("jilin", "fengtian", undefined, "1932-03-01"),
  own("jilin", "manchukuo", "1932-03-01", "1945-08-18"),
  own("jilin", "roc", "1945-08-18"),
  own("heilongjiang", "fengtian", undefined, "1932-03-01"),
  own("heilongjiang", "manchukuo", "1932-03-01", "1945-08-18"),
  own("heilongjiang", "roc", "1945-08-18"),

  // ---- 华北 ----
  own("beijing", "fengtian", undefined, "1933-03-12", "中原大战后张学良控制平津冀。"),
  own("beijing", "roc", "1933-03-12", "1935-12-18"),
  own("beijing", "jicha", "1935-12-18", "1937-08-01"),
  own("beijing", "roc", "1937-08-01"),
  own("tianjin", "fengtian", undefined, "1933-03-12"),
  own("tianjin", "roc", "1933-03-12", "1935-12-18"),
  own("tianjin", "jicha", "1935-12-18", "1937-08-01"),
  own("tianjin", "roc", "1937-08-01"),
  own("hebei", "fengtian", undefined, "1933-03-12"),
  own("hebei", "roc", "1933-03-12", "1935-12-18"),
  own("hebei", "jicha", "1935-12-18", "1937-08-01"),
  own("hebei", "roc", "1937-08-01"),
  own("shanxi", "jinsui"),
  own("inner-mongolia", "jinsui", undefined, undefined, "按绥远（傅作义，属晋绥系）处理。"),
  own("shandong", "shandong", undefined, "1938-01-24"),
  own("shandong", "roc", "1938-01-24"),
  own("henan", "roc"),

  // ---- 华东、华中 ----
  own("jiangsu", "roc"),
  own("shanghai", "roc"),
  own("zhejiang", "roc"),
  own("anhui", "roc"),
  own("jiangxi", "roc"),
  own("hubei", "roc"),
  own("hunan", "roc"),
  own("fujian", "roc"),

  // ---- 华南、西南 ----
  own("guangdong", "yuegang", undefined, "1936-07-18"),
  own("guangdong", "roc", "1936-07-18"),
  own("hainan", "yuegang", undefined, "1936-07-18"),
  own("hainan", "roc", "1936-07-18"),
  own("guangxi", "guixi"),
  own("guizhou", "roc"),
  own("yunnan", "dian", undefined, "1945-10-03"),
  own("yunnan", "roc", "1945-10-03"),
  own("sichuan", "chuan", undefined, "1938-01-20"),
  own("sichuan", "roc", "1938-01-20"),
  own("chongqing", "chuan", undefined, "1937-11-20"),
  own("chongqing", "roc", "1937-11-20", undefined, "国民政府迁都重庆。"),

  // ---- 西北、边疆 ----
  own("shaanxi", "roc"),
  own("gansu", "roc"),
  own("ningxia", "majia"),
  own("qinghai", "majia"),
  own("xinjiang", "xinjiang", undefined, "1944-09-11"),
  own("xinjiang", "roc", "1944-09-11"),
  own("tibet", "tibet"),
  own("shaanganning", "ccp", "1935-10-19"),

  // ---- 港澳台 ----
  own("taiwan", "japan", undefined, "1945-10-25"),
  own("taiwan", "roc", "1945-10-25"),
  own("hongkong", "uk"),
  own("macau", "portugal"),
];

export const CONTROLS: ControlPeriod[] = [
  // 九一八事变：日军占领东北，到满洲国成立前为争夺
  contested("liaoning", "1931-09-18", "1932-03-01"),
  contested("jilin", "1931-09-21", "1932-03-01"),
  contested("heilongjiang", "1931-11-04", "1932-03-01", "japan", "江桥抗战起。"),
  // 1933 年热河之战后日军进至长城一线；冀东由日方扶植的冀东防共自治政府控制（1935–1938）
  contested("hebei", "1933-03-01", "1933-05-31", "japan", "长城抗战。"),

  // 全面抗战：华北
  contested("beijing", "1937-07-07", "1937-07-29"),
  occupied("beijing", "1937-07-29", "1945-08-15", "japan", "华北临时政府（1937–1940）、汪精卫政权（1940–1945）治下。"),
  contested("tianjin", "1937-07-07", "1937-07-30"),
  occupied("tianjin", "1937-07-30", "1945-08-15"),
  contested("hebei", "1937-07-07", "1937-11-01"),
  occupied("hebei", "1937-11-01", "1945-08-15", "japan", "点线占领，敌后有晋察冀等根据地。"),
  contested("inner-mongolia", "1937-08-08", "1937-10-27", "japan", "平绥线作战。"),
  occupied("inner-mongolia", "1937-10-27", "1945-08-19", "japan", "蒙疆政权治下的察南、晋北、绥远东部；河套一带仍由傅作义控制。"),
  contested("shanxi", "1937-09-13", "1945-08-15", "japan", "大同、太原相继失守，晋西北、晋东南长期为抗日根据地，全省战事反复。"),
  contested("shandong", "1937-10-03", "1937-12-27"),
  occupied("shandong", "1937-12-27", "1945-08-15", "japan", "点线占领，鲁中、鲁南有根据地。"),
  contested("henan", "1938-02-01", "1944-04-18", "japan", "豫北、豫东沦陷，豫西、豫南仍由国军控制。"),
  occupied("henan", "1944-04-18", "1945-08-15", "japan", "豫中会战（一号作战）后大部沦陷。"),

  // 华东
  contested("shanghai", "1937-08-13", "1937-11-12", "japan", "淞沪会战。"),
  occupied("shanghai", "1937-11-12", "1945-08-15"),
  contested("jiangsu", "1937-08-13", "1937-12-13"),
  occupied("jiangsu", "1937-12-13", "1945-08-15", "japan", "南京失守；苏北有新四军根据地。"),
  contested("zhejiang", "1937-11-05", "1945-08-15", "japan", "浙北沦陷，浙南、浙西南仍由国军控制。"),
  contested("anhui", "1937-12-01", "1945-08-15", "japan", "皖北、皖中部分沦陷，大别山区等仍由国军控制。"),
  contested("jiangxi", "1938-06-01", "1945-08-15", "japan", "九江、南昌沦陷，赣南、赣东仍由国军控制。"),

  // 华中
  contested("hubei", "1938-06-11", "1945-08-15", "japan", "武汉会战，1938 年 10 月武汉失守，鄂西仍由国军控制。"),
  contested("hunan", "1939-09-14", "1945-08-15", "japan", "长沙会战（1939–1942）、长衡会战（1944）。"),

  // 华南
  contested("guangdong", "1938-10-12", "1945-08-15", "japan", "广州失守，粤北、粤东仍由国军控制。"),
  occupied("hainan", "1939-02-10", "1945-08-15"),
  contested("guangxi", "1939-11-15", "1940-11-01", "japan", "桂南会战。"),
  contested("guangxi", "1944-09-01", "1945-07-31", "japan", "桂柳会战（一号作战）。"),
  contested("fujian", "1938-05-10", "1945-08-15", "japan", "厦门、福州等沿海城市一度沦陷，内地仍由国军控制。"),
  contested("guizhou", "1944-11-28", "1944-12-10", "japan", "独山战役。"),
  contested("yunnan", "1942-05-04", "1944-09-14", "japan", "滇西（腾冲、龙陵）沦陷。"),

  // 港台、东南亚
  contested("hongkong", "1941-12-08", "1941-12-25"),
  occupied("hongkong", "1941-12-25", "1945-08-30"),
  contested("hongkong-world", "1941-12-08", "1941-12-25"),
  occupied("hongkong-world", "1941-12-25", "1945-08-30"),
  occupied("indochina", "1940-09-22", "1945-08-15", "japan", "1940 年日军进驻法属印度支那北部，1941 年进驻南部，1945 年 3 月发动政变。"),
  occupied("cochinchina", "1941-07-28", "1945-08-15"),
  occupied("cambodia", "1941-07-28", "1945-08-15"),
  occupied("laos", "1941-07-28", "1945-08-15"),
  contested("malaya", "1941-12-08", "1942-02-15"),
  occupied("malaya", "1942-02-15", "1945-09-12"),
  occupied("brunei", "1941-12-16", "1945-06-10"),
  contested("philippines", "1941-12-08", "1942-05-06"),
  occupied("philippines", "1942-05-06", "1944-10-20"),
  contested("philippines", "1944-10-20", "1945-07-05", "japan", "美军反攻，日军仍控制大部。"),
  occupied("guam", "1941-12-10", "1944-08-10"),
  contested("dei", "1942-01-11", "1942-03-09"),
  occupied("dei", "1942-03-09", "1945-08-17"),

  // 战后：苏军进入东北
  occupied("liaoning", "1945-08-18", "1946-05-03", "ussr", "苏军撤出前。"),
  occupied("jilin", "1945-08-18", "1946-05-03", "ussr"),
  occupied("heilongjiang", "1945-08-18", "1946-05-03", "ussr"),
];

/** 数据覆盖的时间范围。 */
export const POLITICAL_PERIOD = { from: "1931-01-01", to: END };
