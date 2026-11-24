import type { CSSProperties } from "react";
import type { RenderPass } from "../layers/types";
import type { MapToggles } from "../map/mapLayers";
import { css, resolveStyle, type EarthStyle, type EarthStyleId } from "../styles";

/**
 * 所有地球动画共有的参数（Studio 面板里每个地球动画都有这一组，定义在 src/Root.tsx 的 earthSceneSchema）：
 * - style：画面风格，各风格平行，见 src/earth3d/styles；
 * - map：人文地理层开关（国界、控制区、铁路、城市、国家名、河流），不填的都显示；
 * - pass：分层导出。
 * 画面日期由各动画决定：有时间线的按事件日期，单个镜头的动画另有 date 参数。
 */
export type EarthSceneProps = {
  style?: EarthStyleId;
  map?: MapToggles;
  pass?: RenderPass;
};

/** 默认日期：全面抗战爆发。单个镜头的动画不指定日期时用它。 */
export const DEFAULT_SCENE_DATE = "1937-07-07";

/** 文字是否出现在这个渲染通道里（labels 通道只有文字，globe、overlay 通道没有文字）。 */
export const showsText = (pass: RenderPass = "full") => pass === "full" || pass === "labels";

/** 按风格的界面颜色：底板、文字、次要文字、强调色、边框。 */
export const uiTheme = (style?: EarthStyleId | EarthStyle) => {
  const ui = resolveStyle(style).ui;
  const glow = ui.glow > 0 ? `0 0 ${12 + 12 * ui.glow}px ${css(ui.accent, 0.25 * ui.glow)}` : "none";
  const panel: CSSProperties = {
    background: css(ui.panel, ui.panelAlpha),
    border: ui.borderAlpha > 0 ? `1px solid ${css(ui.border, ui.borderAlpha)}` : "none",
    boxShadow: glow,
  };
  return {
    panel,
    text: css(ui.text),
    muted: css(ui.muted),
    accent: css(ui.accent),
    textShadow: `0 0 18px ${css(ui.panel, 0.9)}, 0 2px 6px rgba(0,0,0,0.9)`,
  };
};
