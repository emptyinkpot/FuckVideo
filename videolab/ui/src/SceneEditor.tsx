import { useState } from "react";
import { api, type Candidate, type Layout, type Project, type Scene } from "./api";

type Props = {
  project: Project;
  scene: Scene;
  busy: boolean;
  run: (label: string, task: () => Promise<void>) => Promise<void>;
  onProject: (next: Project) => Promise<void>;
};

const CAPTION_FIELDS: Array<[key: string, label: string, fallback: number]> = [
  ["bottom", "字幕底部 Y", 34],
  ["fontSize", "字幕字号", 30],
  ["left", "左边距", 78],
  ["right", "右边距", 78],
  ["minHeight", "最小高度", 0],
  ["borderRadius", "圆角", 0],
  ["paddingX", "内边距 X", 24],
  ["paddingY", "内边距 Y", 4],
];

const PROGRESS_FIELDS: Array<[key: string, label: string, fallback: number]> = [
  ["bottom", "进度条底部 Y", 0],
  ["height", "高度", 30],
  ["left", "左边距", 0],
  ["right", "右边距", 0],
  ["gap", "分段间距", 4],
  ["labelFontSize", "标题字号", 14],
  ["paddingX", "内边距 X", 0],
  ["minSegmentWidth", "最小分段宽", 36],
];

export function SceneEditor({ project, scene, busy, run, onProject }: Props) {
  const [tab, setTab] = useState<"scene" | "layout">("scene");
  const [draft, setDraft] = useState({
    voiceText: scene.voiceText || "",
    subtitle: scene.subtitle || "",
    startMs: Math.round(scene.startMs),
    endMs: Math.round(scene.endMs),
    templateId: scene.templateId || "",
    sceneType: scene.sceneType || "",
    visualIntent: scene.visualIntent || "",
  });
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [layout, setLayout] = useState({
    captionStyle: project.captionStyle || "typewriter",
    progressStyle: project.progressStyle || "gradient",
    captionLayout: { ...(project.captionLayout || {}) } as Layout,
    progressLayout: { ...(project.progressLayout || {}) } as Layout,
  });

  const set = (key: keyof typeof draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: typeof d[key] === "number" ? Number(e.target.value) : e.target.value }));

  const move = (offset: number) => {
    const ids = project.scenes.map((s) => s.id);
    const i = ids.indexOf(scene.id);
    const j = i + offset;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void run("调整顺序", async () => onProject(await api.reorder(project.id, ids)));
  };

  const layoutInput = (group: "captionLayout" | "progressLayout", [key, label, fallback]: [string, string, number]) => (
    <label key={`${group}.${key}`}>
      {label}
      <input
        type="number"
        value={Number(layout[group][key] ?? fallback)}
        onChange={(e) => setLayout((l) => ({ ...l, [group]: { ...l[group], [key]: Number(e.target.value) } }))}
      />
    </label>
  );

  return (
    <>
      <div className="panel-head tabs">
        <button className={tab === "scene" ? "on" : ""} onClick={() => setTab("scene")}>当前分镜</button>
        <button className={tab === "layout" ? "on" : ""} onClick={() => setTab("layout")}>字幕 / 进度条</button>
        <span className="muted">{scene.locked ? "已锁定" : "可编辑"}</span>
      </div>

      {tab === "scene" ? (
        <div className="form scroll">
          <label>旁白文本<textarea value={draft.voiceText} onChange={set("voiceText")} /></label>
          <label>字幕 / 画面文案<textarea value={draft.subtitle} onChange={set("subtitle")} /></label>
          <div className="row">
            <label>开始 ms<input type="number" value={draft.startMs} onChange={set("startMs")} /></label>
            <label>结束 ms<input type="number" value={draft.endMs} onChange={set("endMs")} /></label>
          </div>
          <div className="row">
            <label>模板<input value={draft.templateId} onChange={set("templateId")} /></label>
            <label>类型<input value={draft.sceneType} onChange={set("sceneType")} /></label>
          </div>
          <label>视觉意图<textarea value={draft.visualIntent} onChange={set("visualIntent")} /></label>
          <label>
            素材层
            <input readOnly value={scene.visualLayer?.path || scene.visualLayer?.templateId || scene.visualLayer?.type || ""} />
          </label>
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run("保存分镜", async () =>
                  onProject(await api.patchScene(project.id, scene.id, { ...draft, props: { body: draft.subtitle } })),
                )
              }
            >
              保存分镜
            </button>
            <button
              disabled={busy}
              onClick={() => void run(scene.locked ? "解除锁定" : "锁定分镜", async () =>
                onProject(await api.setLocked(project.id, scene.id, !scene.locked)))}
            >
              {scene.locked ? "解除锁定" : "锁定"}
            </button>
            <button
              disabled={busy}
              onClick={() => void run("重配素材", async () => setCandidates((await api.rematch(project.id, scene.id)).candidates || []))}
            >
              重配素材
            </button>
            <button disabled={busy} onClick={() => move(-1)}>上移</button>
            <button disabled={busy} onClick={() => move(1)}>下移</button>
          </div>
          {candidates.length > 0 && (
            <div className="candidates">
              {candidates.map((c) => (
                <div className="candidate" key={c.id}>
                  <strong>{c.title || c.id}</strong>
                  <div className="muted">{c.reason} · 分数 {c.score}</div>
                  <div className="muted path">{c.path}</div>
                  <button
                    disabled={busy}
                    onClick={() => void run("替换素材", async () => {
                      await onProject(await api.replaceMaterial(project.id, scene.id, c));
                      setCandidates([]);
                    })}
                  >
                    替换为该素材
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="form scroll">
          <div className="row">
            <label>
              字幕样式
              <select value={layout.captionStyle} onChange={(e) => setLayout((l) => ({ ...l, captionStyle: e.target.value }))}>
                {["typewriter", "classic", "none"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>
              进度条样式
              <select value={layout.progressStyle} onChange={(e) => setLayout((l) => ({ ...l, progressStyle: e.target.value }))}>
                {["gradient", "thin", "none"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
          </div>
          <div className="group-title">字幕</div>
          <div className="grid2">{CAPTION_FIELDS.map((f) => layoutInput("captionLayout", f))}</div>
          <div className="group-title">分段进度条</div>
          <div className="grid2">{PROGRESS_FIELDS.map((f) => layoutInput("progressLayout", f))}</div>
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void run("保存布局", async () => onProject(await api.patchInfrastructure(project.id, layout)))}
            >
              保存布局
            </button>
          </div>
        </div>
      )}
    </>
  );
}
