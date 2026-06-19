/**
 * LLM prompt templates for the script-to-scenes pipeline.
 * Stage 1 ships generic prompts; Stage 3 lands track-specific overrides
 * (football / science / finance / history).
 */

export const SCRIPT_TO_SCENES_SYSTEM_PROMPT = `你是一名视频分镜助手。用户会给你一段文字稿，你的任务是把它切成 4-12 个连续的"镜头"（scenes），每个镜头：

- 对应一段连贯的旁白（一两句话，约 30-120 个汉字）
- 标注一个视觉提示（visualHint），描述这一段画面应该呈现什么内容
- 给出 3-6 个搜索关键词（keywords），用于后续素材库语义匹配
- 选定一个 templateId，告诉渲染器用哪种视觉模板

可用的 templateId（Stage 1 范围）：
- "footage-scene": 单段视频素材 + Ken Burns 缩放，适合大多数旁白型镜头
- "narrated-video": 标题 + 副标题 + 主体文本 + 背景，适合"陈述事实"型片段
- "map-flyover": 地图路线飞行动画，适合地理、历史、迁移、路线类片段
- "product-stage": 程序化 3D 舞台，适合抽象概念、产品、技术流程类片段

输出要求：
- 严格 JSON，不要 markdown 代码块包裹
- 顶层是一个对象，包含字段 scenes（数组）
- 每个 scene 元素：{ "text": "...", "templateId": "...", "visualHint": "...", "keywords": ["..."] }
- 不要输出 id / durationFrames / matchedAssets / subtitles，这些由后续流水线填充
- 不要在 text 中加任何说明性括号注释
- text 字段必须能直接做 TTS 朗读（无图片描述、无停顿标记）
`;

export interface BuildScriptToScenesPromptInput {
  script: string;
  trackPreference?: 'general' | 'football' | 'science' | 'finance' | 'history';
  /** Hint for max scene count; defaults to 12. */
  maxScenes?: number;
  /** Optional feedback from a previous failed attempt. */
  previousError?: string;
}

export function buildScriptToScenesUserPrompt(input: BuildScriptToScenesPromptInput): string {
  const max = input.maxScenes ?? 12;
  const trackHint = input.trackPreference && input.trackPreference !== 'general'
    ? `\n\n本视频题材偏向：${trackLabel(input.trackPreference)}，请在 visualHint 和 keywords 中体现该题材的常见画面。`
    : '';

  const errorHint = input.previousError
    ? `\n\n上次尝试解析失败，错误：${input.previousError}\n请严格输出符合规范的 JSON。`
    : '';

  return `请把下面这段文字稿切成不超过 ${max} 个镜头。

\`\`\`
${input.script}
\`\`\`${trackHint}${errorHint}

直接输出 JSON：`;
}

function trackLabel(track: 'football' | 'science' | 'finance' | 'history'): string {
  switch (track) {
    case 'football':
      return '足球解说（运动场景、球员特写、战术板示意）';
    case 'science':
      return '科普（实验示意、抽象概念可视化、图表）';
    case 'finance':
      return '财经分析（数据图表、企业 logo、新闻画面）';
    case 'history':
      return '历史叙事（地图、文物、人物肖像、年代场景）';
  }
}
