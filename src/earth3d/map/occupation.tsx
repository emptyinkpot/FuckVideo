import type { EarthLayer } from "../layers/types";
import { frontLines } from "./borderLines";
import { politicalDecal, type PoliticalDate } from "./political";

/**
 * 占领层：被占领的地方保留原主人的底色，叠上控制者颜色的斜纹（日占华北 = 国民政府的蓝底 + 日本的白色斜纹），
 * 和未占领区交界处画前线；正在争夺的地方画进攻方颜色的流动虚线。两个日期之间前线平滑推进。
 * 斜纹、前线、虚线的画法见风格的 occupation。
 */
export const occupationLayer = ({ opacity = 1, order = 1, ...when }: PoliticalDate & { opacity?: number; order?: number }): EarthLayer => ({
  id: "occupation",
  order,
  opacity,
  decal: (context) => politicalDecal("occupation", when, context.style),
  objects: (context) => frontLines(when, context, opacity),
});
