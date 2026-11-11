// Styles live inside the workbench's shadow root, so they can't leak into Remotion Studio and
// Studio's styles can't leak in.
export const OVERLAY_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root {
  --bg: #12151c; --line: rgba(255,255,255,.09); --field: #1a1f2a; --text: #e5e7eb;
  --muted: #9ca3af; --blue: #4f8cff; --red: #f87171;
  font: 13px/1.45 Inter, "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif;
  color: var(--text);
}
button, select, input, textarea {
  font: inherit; color: var(--text); background: var(--field);
  border: 1px solid rgba(255,255,255,.13); border-radius: 8px;
}
button { height: 28px; padding: 0 10px; cursor: pointer; white-space: nowrap; }
button:hover:not(:disabled) { border-color: rgba(255,255,255,.3); }
button:disabled { opacity: .45; cursor: default; }
button.primary { background: var(--blue); border-color: transparent; color: #fff; }
button.danger { border-color: rgba(248,113,113,.4); color: #fca5a5; }
input, select { height: 28px; padding: 0 8px; width: 100%; }
textarea { width: 100%; min-height: 64px; padding: 6px 8px; resize: vertical; }
textarea.tall { min-height: 130px; }

.fab {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;
  width: 46px; height: 46px; padding: 0; border-radius: 50%;
  background: var(--blue); border: none; color: #fff; font-size: 13px; font-weight: 800;
  box-shadow: 0 6px 22px rgba(0,0,0,.45);
}
.fab.open { background: #2a3142; }

.card {
  position: fixed; right: 18px; bottom: 74px; z-index: 2147483000;
  width: 400px; max-height: min(680px, calc(100vh - 100px));
  display: flex; flex-direction: column;
  background: var(--bg); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 18px 50px rgba(0,0,0,.55); overflow: hidden;
}
.head { display: flex; align-items: center; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
.title { font-weight: 800; margin-right: auto; }
.tabs { display: flex; gap: 4px; padding: 8px 12px 0; }
.tabs button { height: 26px; background: none; border-color: transparent; color: var(--muted); }
.tabs button.on { background: var(--field); border-color: rgba(255,255,255,.14); color: var(--text); }
.body { flex: 1; min-height: 0; overflow: auto; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
label { display: flex; flex-direction: column; gap: 4px; color: var(--muted); font-size: 12px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; }
.muted { color: var(--muted); }
.status { color: var(--muted); font-size: 12px; min-height: 18px; }
.error { color: var(--red); }
.banner { background: #2b1d10; border: 1px solid #7c4a12; color: #fcd9a8; border-radius: 8px; padding: 8px; font-size: 12px; }

.scenes { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.scene { display: block; width: 100%; height: auto; text-align: left; padding: 7px 10px; border: none; border-bottom: 1px solid var(--line); border-radius: 0; background: none; }
.scene:last-child { border-bottom: none; }
.scene.active { background: #1c2740; box-shadow: inset 3px 0 0 var(--blue); }
.scene .meta { color: var(--muted); font-size: 11px; }
.scene .lock { color: #fbbf24; }
.candidate { border: 1px solid var(--line); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.candidate .path { font-size: 11px; word-break: break-all; }
.logs { margin: 0; max-height: 150px; overflow: auto; background: #07080b; border: 1px solid var(--line); border-radius: 8px; padding: 8px; font: 11px/1.4 Consolas, monospace; white-space: pre-wrap; }
.switch { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; color: var(--text); font-size: 13px; }
.switch input { width: auto; height: auto; }
.hint { color: var(--muted); font-size: 12px; }
`;
