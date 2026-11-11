import type { MouseEvent } from "react";
import type { Scene } from "./api";
import { msLabel } from "./templates";

type Props = {
  scenes: Scene[];
  selectedId: string;
  playheadMs: number;
  totalMs: number;
  onSelect: (id: string) => void;
  onSeek: (ms: number) => void;
};

const PX_PER_SECOND = 28;

// Simplified segment track: one block per scene, positioned by its time range, plus a playhead
// driven by the Player's frameupdate event. Clicking empty track space seeks.
export function Timeline({ scenes, selectedId, playheadMs, totalMs, onSelect, onSeek }: Props) {
  const width = Math.max(600, (totalMs / 1000) * PX_PER_SECOND);
  const x = (ms: number) => (ms / 1000) * PX_PER_SECOND;

  const seekFromClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(((e.clientX - rect.left) / PX_PER_SECOND) * 1000);
  };

  return (
    <footer className="timeline">
      <div className="track" style={{ width }} onClick={seekFromClick}>
        {scenes.map((scene, index) => (
          <button
            key={scene.id}
            className={`block ${scene.id === selectedId ? "active" : ""} ${scene.locked ? "locked" : ""}`}
            style={{ left: x(scene.startMs), width: Math.max(18, x(scene.endMs - scene.startMs) - 2) }}
            title={`${index + 1}. ${scene.subtitle || scene.voiceText}`}
            onClick={() => onSelect(scene.id)}
          >
            <span>{index + 1}</span>
            <small>{msLabel(scene.startMs)}</small>
          </button>
        ))}
        <div className="playhead" style={{ left: x(playheadMs) }} />
      </div>
    </footer>
  );
}
