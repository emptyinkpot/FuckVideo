import { type ReactNode } from 'react';

/**
 * Stage 1 灵感发现 stub — 静态卡片占位（不调 B 站官方推广接口）。
 * Stage 3 接入 huasheng-clone 自己的成片库 / 用户公开作品。
 */
interface SampleVideo {
  title: string;
  author: string;
  followers: string;
  views: string;
  duration: string;
}

const SAMPLES: SampleVideo[] = [
  {
    title: '从一条鞭法到摊丁入亩：中国古代财政的信用困境（差异化:历史地图叙事）',
    author: 'huasheng-clone 示例',
    followers: '—',
    views: '—',
    duration: '21:47',
  },
  {
    title: '万字解析现代教育制度的死与生（差异化:数据可视化）',
    author: 'huasheng-clone 示例',
    followers: '—',
    views: '—',
    duration: '29:46',
  },
  {
    title: '百年化学日本篇 No.80 氧化锆的暴脾气（差异化:3D 产品展示）',
    author: 'huasheng-clone 示例',
    followers: '—',
    views: '—',
    duration: '12:15',
  },
  {
    title: 'SpaceX 万亿 IPO 解析（标准花生赛道）',
    author: 'huasheng-clone 示例',
    followers: '—',
    views: '—',
    duration: '12:15',
  },
];

export function InspirationGrid(): ReactNode {
  return (
    <section className="mt-12 w-full max-w-5xl mx-auto">
      <div className="flex items-center gap-6 mb-4">
        <h2 className="text-sm font-medium text-neutral-300 border-b-2 border-rose-500 pb-1">灵感发现</h2>
        <h2 className="text-sm text-neutral-500">活动</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SAMPLES.map((sample, idx) => (
          <article
            key={idx}
            className="group rounded-xl border border-neutral-800 bg-neutral-950/60 overflow-hidden hover:border-neutral-600 transition-colors"
          >
            <div className="aspect-video bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center text-neutral-700 text-xs relative">
              <span>占位封面</span>
              <span className="absolute bottom-2 right-2 text-[10px] text-neutral-400 bg-black/60 px-1 rounded">
                {sample.duration}
              </span>
            </div>
            <div className="p-3">
              <p className="text-xs text-neutral-200 line-clamp-2 leading-relaxed">{sample.title}</p>
              <p className="text-[11px] text-neutral-500 mt-2">{sample.author}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="text-[11px] text-neutral-600 mt-4">
        Stage 3 接入 huasheng-clone 自己的成片库。当前仅占位卡片，标"差异化"的是花生做不了的护城河品类。
      </p>
    </section>
  );
}
