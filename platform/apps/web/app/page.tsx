import { ScriptInput } from '../components/script-input.js';
import { InspirationGrid } from '../components/inspiration-grid.js';
import { fetchInnovideoConfig } from '../lib/api.js';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Server-side fetch — falls back to defaults if api isn't up yet (dev convenience).
  let scriptMax = 10000;
  let defaultScript = '试试粘贴一段文稿在这里';
  try {
    const cfg = await fetchInnovideoConfig();
    scriptMax = Number(cfg.script_max);
    defaultScript = cfg.default_script;
  } catch (err) {
    console.warn('[page] /api/innovideo/config unavailable:', (err as Error).message);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-black text-neutral-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-900">
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold tracking-tight bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">
            huasheng-clone
          </span>
          <span className="text-[10px] text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">
            Stage 1 MVP
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-neutral-400">
          <a href="https://github.com" className="hover:text-neutral-200">GitHub</a>
          <a href="/docs/HUASHENG_REVERSE_ENGINEERING" className="hover:text-neutral-200">
            逆向报告
          </a>
        </nav>
      </header>

      <section className="px-6 pt-14 pb-6">
        <h1 className="text-center text-3xl md:text-4xl font-semibold tracking-tight mb-3">
          写好文稿，剩下的交给我们
        </h1>
        <p className="text-center text-sm text-neutral-500 mb-8">
          AI 自动分镜 · CosyVoice 配音 · 语义素材匹配 · Remotion 1080P 渲染
        </p>
        <ScriptInput scriptMax={scriptMax} defaultScript={defaultScript} />
      </section>

      <InspirationGrid />

      <footer className="mt-16 px-6 py-6 border-t border-neutral-900 text-center text-xs text-neutral-600">
        <p>
          逆向源站：
          <a href="https://www.huasheng.cn/" className="underline hover:text-neutral-400">
            huasheng.cn
          </a>{' '}
          · 本项目为对标研究与开源实践 · 不与原产品共享任何后端/账号
        </p>
      </footer>
    </main>
  );
}
