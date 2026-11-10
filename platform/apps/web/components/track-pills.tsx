'use client';

import { type ReactNode } from 'react';

export type TrackId = 'general' | 'football' | 'science' | 'finance' | 'history';

interface TrackOption {
  id: TrackId;
  emoji: string;
  label: string;
}

const TRACKS: TrackOption[] = [
  { id: 'football', emoji: '⚽', label: '创作足球解说视频' },
  { id: 'science', emoji: '🔎', label: '创作科学科普视频' },
  { id: 'finance', emoji: '📈', label: '创作财经分析视频' },
  { id: 'history', emoji: '📜', label: '创作历史解说视频' },
];

interface TrackPillsProps {
  value: TrackId;
  onChange: (track: TrackId) => void;
}

export function TrackPills({ value, onChange }: TrackPillsProps): ReactNode {
  return (
    <div className="flex flex-wrap gap-3 mt-4">
      {TRACKS.map((track) => {
        const active = value === track.id;
        return (
          <button
            key={track.id}
            type="button"
            onClick={() => onChange(active ? 'general' : track.id)}
            className={
              'group rounded-full px-4 py-2 text-sm transition-colors border ' +
              (active
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                : 'bg-neutral-900/60 text-neutral-300 border-neutral-700 hover:border-neutral-500')
            }
          >
            <span className="mr-2">{track.emoji}</span>
            {track.label}
            <span className="ml-1 text-neutral-500 group-hover:text-neutral-300">→</span>
          </button>
        );
      })}
    </div>
  );
}
