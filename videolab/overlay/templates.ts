// Composition ids offered by the single-template generator mode (must exist in src/Root.tsx).
export const TEMPLATES: Array<[id: string, label: string]> = [
  ["DocumentReveal", "历史文件揭示"],
  ["QuoteReveal", "引文揭示"],
  ["PortraitFocus", "人物身份卡"],
  ["ConceptDiagram", "概念关系图"],
  ["MetaphorVisual", "隐喻可视化"],
  ["FootageScene", "本地素材片段"],
  ["MixkitReveal", "Mixkit 揭示预设"],
  ["RemotionLabShowcaseAsset", "RemotionLab 素材库"],
  ["SinoJapaneseWarDemo", "中日战争历史地球"],
  ["HistoricalGlobeTexture1938", "1938 历史地球纹理"],
  ["AtlasMapFlyover", "世界地图飞越"],
  ["MapRouteFlyover", "路线地图飞越"],
  ["ThreeProductStage", "三维产品舞台"],
  ["ThreeParticleNebula", "三维粒子星云"],
  ["ThreeCardCascade", "三维卡片级联"],
  ["ThreeBouncingSpheres", "三维弹跳球"],
  ["ClaudeTyper", "命令行打字机"],
  ["SpotlightReveal", "聚光灯揭示"],
  ["ProceduralFish", "程序鱼群"],
  ["RulerProgress", "进度尺"],
  ["SvgAssembly", "SVG 组装"],
  ["Wechat2D", "微信对话"],
  ["ThreeDTicker", "三维色块滚动"],
  ["VinylPlayer", "黑胶播放器"],
  ["PromptTextRotation", "提示词文本轮播"],
  ["PromptProgressBar", "提示词进度条"],
  ["PromptHistogram", "提示词柱状图"],
  ["PromptAnimatedShapes", "提示词动态图形"],
];

export const PROJECT_COMPOSITION = "MultiSceneVideo";
export const FPS = 30;

export function msLabel(value: number) {
  const sec = Math.floor(Math.max(0, value) / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
