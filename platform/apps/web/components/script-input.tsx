'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { TrackPills, type TrackId } from './track-pills.js';
import { createDraft } from '../lib/api.js';

interface ScriptInputProps {
  scriptMax: number;
  defaultScript: string;
}

type Mode = 'script' | 'audio' | 'voiceover';

export function ScriptInput({ scriptMax, defaultScript }: ScriptInputProps): ReactNode {
  const [mode, setMode] = useState<Mode>('script');
  const [script, setScript] = useState('');
  const [track, setTrack] = useState<TrackId>('general');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const charCount = Array.from(script.replace(/\s/g, '')).length;
  const overflow = charCount > scriptMax;

  const submit = () => {
    if (!script.trim() || overflow) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await createDraft({ script, trackPreference: track, aspectRatio });
        setDraftId(res.draftId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Mode tabs (Stage 1: only "script" actually works) */}
      <div className="flex gap-1 p-1 bg-neutral-900/60 rounded-xl mb-3 w-fit">
        <ModeTab current={mode} target="script" onClick={setMode}>输入文稿</ModeTab>
        <ModeTab current={mode} target="audio" onClick={setMode} disabled>上传口播</ModeTab>
        <ModeTab current={mode} target="voiceover" onClick={setMode} disabled>口播配音</ModeTab>
      </div>

      {/* Main editor card */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-2xl">
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={`输入/粘贴视频文稿，即刻为你生成精彩视频\n\n试试这段：\n\n${defaultScript.slice(0, 120)}…`}
          className="w-full min-h-[180px] bg-transparent resize-none outline-none text-neutral-100 placeholder:text-neutral-600 text-[15px] leading-7"
        />
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className={overflow ? 'text-rose-400' : 'text-neutral-500'}>
            {charCount} / {scriptMax}
          </div>
          <div className="flex gap-2">
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
              className="bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-neutral-300"
            >
              <option value="16:9">横屏 16:9</option>
              <option value="9:16">竖屏 9:16</option>
            </select>
            <button
              type="button"
              onClick={submit}
              disabled={pending || overflow || !script.trim()}
              className="px-4 py-1.5 rounded-md bg-rose-500 hover:bg-rose-400 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? '提交中…' : '✦ 创建'}
            </button>
          </div>
        </div>
      </div>

      <TrackPills value={track} onChange={setTrack} />

      {draftId && (
        <div className="mt-4 rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-3 text-sm text-emerald-300">
          已创建草稿 <code className="font-mono">{draftId}</code> · 流水线后台跑中（planning → tts → matching）
          <br />
          轮询：<code className="font-mono text-xs">GET /api/innovideo/draft/{draftId}</code>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}

interface ModeTabProps {
  current: Mode;
  target: Mode;
  onClick: (mode: Mode) => void;
  disabled?: boolean;
  children: ReactNode;
}

function ModeTab({ current, target, onClick, disabled, children }: ModeTabProps): ReactNode {
  const active = current === target;
  return (
    <button
      type="button"
      onClick={() => !disabled && onClick(target)}
      disabled={disabled}
      title={disabled ? 'Stage 2 才接入' : undefined}
      className={
        'px-4 py-1.5 rounded-lg text-sm transition-colors ' +
        (active
          ? 'bg-neutral-800 text-white'
          : disabled
          ? 'text-neutral-600 cursor-not-allowed'
          : 'text-neutral-400 hover:text-neutral-200')
      }
    >
      {children}
    </button>
  );
}
