import { interpolate } from "remotion";
import type { EarthLayer } from "../layers/types";
import { css } from "../styles";

export type PulseLayerOptions = {
  id?: string;
  /** 事件地点 [经度, 纬度] */
  at: [number, number];
  /** 当前帧、从第几帧开始出现 */
  frame: number;
  start?: number;
  /** 一次跳动的帧数 */
  periodFrames?: number;
  order?: number;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 事件地点的跳动光晕（画面文字层，跟随三维位置）；颜色按风格（events.pulse）。 */
export const pulseLayer = ({ id = "pulse", at, frame, start = 0, periodFrames = 40, order = 45 }: PulseLayerOptions): EarthLayer => ({
  id,
  order,
  labels: (project, { style }) => {
    const point = project(at[0], at[1]);
    if (!point || frame < start) return null;
    const color = style.events.pulse;
    const t = ((frame - start) % periodFrames) / periodFrames;
    const appear = interpolate(frame, [start, start + 15], [0, 1], clamp);
    return (
      <div style={{ position: "absolute", left: point.x, top: point.y, transform: "translate(-50%, -50%)", opacity: appear }}>
        <div
          style={{
            position: "absolute",
            left: -60,
            top: -60,
            width: 120,
            height: 120,
            borderRadius: 120,
            background: `radial-gradient(circle, ${css(color, 0.75)} 0%, ${css(color, 0.32)} 35%, ${css(color, 0)} 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -10 - 40 * t,
            top: -10 - 40 * t,
            width: 20 + 80 * t,
            height: 20 + 80 * t,
            borderRadius: 999,
            border: `2px solid ${css(color, 0.9)}`,
            opacity: 1 - t,
          }}
        />
        <div style={{ width: 12, height: 12, borderRadius: 12, background: css(color), transform: "translate(-50%, -50%)", boxShadow: `0 0 12px ${css(color)}` }} />
      </div>
    );
  },
});
