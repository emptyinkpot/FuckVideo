import type { InnovideoConfig } from '@huasheng-clone/schemas';

/**
 * huasheng-clone's /api/innovideo/config response.
 * Shape mirrors huasheng's real endpoint (captured 2026-06-19);
 * values reflect what huasheng-clone actually supports.
 */
export function getInnovideoConfig(): InnovideoConfig {
  return {
    voices: [
      { id: '5', voice: 'male-qn-jingying', desc: '生动解说' },
      { id: '6', voice: 'hutong_daye', desc: '北京小伙' },
      { id: '7', voice: 'audiobook_female_2', desc: '新闻主播' },
      { id: '8', voice: 'audiobook_male_1', desc: '磁性男声' },
    ],
    script_max: '10000',
    audio_script_max: '50000',
    user_material_max: '200',
    content_markup_multiple: '3',
    models: [
      { id: 'claude', desc: 'Claude (via sub2api)' },
      { id: 'qwen', desc: 'Qwen3 (via sub2api)' },
    ],
    default_script:
      '欢迎使用 huasheng-clone。把你的文稿粘进来，我们会自动分镜、配音、匹配素材，最后给你一条 1080P 的 MP4。',
    default_voice_id: 8,
    report_tag: [
      {
        cat_name: '风险',
        tags: [
          { tid: '1', name: '敏感人物或物品', is_show_more: false, show_more_must: false, detail: '' },
          { tid: '2', name: '违法违规', is_show_more: false, show_more_must: false, detail: '' },
          { tid: '3', name: '色情低俗', is_show_more: false, show_more_must: false, detail: '' },
          { tid: '4', name: '引人不适', is_show_more: false, show_more_must: false, detail: '恶心、暴力等' },
          { tid: '5', name: '侵权', is_show_more: true, show_more_must: false, detail: '著作权、肖像权等' },
        ],
      },
      {
        cat_name: '匹配',
        tags: [
          { tid: '6', name: '重复出现', is_show_more: false, show_more_must: false, detail: '' },
          { tid: '7', name: '素材画风突兀', is_show_more: false, show_more_must: false, detail: '' },
          { tid: '8', name: '不相关', is_show_more: false, show_more_must: false, detail: '' },
        ],
      },
      {
        cat_name: '更多',
        tags: [
          { tid: '9', name: '不清晰', is_show_more: false, show_more_must: false, detail: '' },
          { tid: '10', name: '有水印或字幕', is_show_more: false, show_more_must: false, detail: '' },
          { tid: '11', name: '黑边', is_show_more: false, show_more_must: false, detail: '' },
          { tid: '12', name: '其他', is_show_more: true, show_more_must: true, detail: '' },
        ],
      },
    ],
    tts_speed_switch: true,
    hide_podcasts: false,  // huasheng hides it; we expose podcasts in Stage 3.
    hide_old_ttv: true,
    export_annotation: false,
  };
}
