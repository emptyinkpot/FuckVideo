import { CONTROLS, OWNERS } from "./periods";
import { POLITIES } from "./polities";
import { REGIONS } from "./regions";
import type { ControlPeriod, OwnerPeriod, PoliticalRegion } from "./types";

/**
 * 数据自检：引用的区域、政权都存在；日期格式正确；同一区域的领有、控制时间段互不重叠；
 * 领有、控制的时间在政权存续期内。有问题直接报错，不带着错数据渲染。
 */
export const validatePoliticalData = (
  regions: PoliticalRegion[] = REGIONS,
  owners: OwnerPeriod[] = OWNERS,
  controls: ControlPeriod[] = CONTROLS,
) => {
  const problems: string[] = [];
  const regionIds = new Set(regions.map((region) => region.id));
  const polities = new Map<string, (typeof POLITIES)[number]>(POLITIES.map((polity) => [polity.id, polity]));
  const dateOk = (value?: string) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value);
  const overlaps = (a: { from?: string; to?: string }, b: { from?: string; to?: string }) =>
    (a.from ?? "") < (b.to ?? "9999") && (b.from ?? "") < (a.to ?? "9999");

  const check = (kind: string, list: Array<OwnerPeriod | ControlPeriod>, polity: (item: OwnerPeriod | ControlPeriod) => string) => {
    list.forEach((item, index) => {
      const label = `${kind}[${index}] ${item.region}`;
      if (!regionIds.has(item.region)) problems.push(`${label}: 区域不存在`);
      const p = polities.get(polity(item));
      if (!p) problems.push(`${label}: 政权 ${polity(item)} 不存在`);
      if (!dateOk(item.from) || !dateOk(item.to)) problems.push(`${label}: 日期格式应为 YYYY-MM-DD`);
      if (item.from && item.to && item.from >= item.to) problems.push(`${label}: 起始日期不早于结束日期`);
      const polityInfo = p as { from?: string; to?: string } | undefined;
      if (polityInfo && kind === "领有") {
        if (polityInfo.from && (!item.from || item.from < polityInfo.from)) problems.push(`${label}: 早于政权 ${p?.id} 成立`);
        if (polityInfo.to && (!item.to || item.to > polityInfo.to)) problems.push(`${label}: 晚于政权 ${p?.id} 结束`);
      }
      list.forEach((other, otherIndex) => {
        if (otherIndex > index && other.region === item.region && overlaps(item, other)) {
          problems.push(`${label}: 与 ${kind}[${otherIndex}] 时间重叠`);
        }
      });
    });
  };
  check("领有", owners, (item) => (item as OwnerPeriod).owner);
  check("控制", controls, (item) => (item as ControlPeriod).controller);
  if (problems.length) throw new Error(`政治地理数据有误：\n${problems.join("\n")}`);
};
