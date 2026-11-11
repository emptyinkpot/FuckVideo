// Floating FuckVideo workbench over the stock Remotion Studio. It only holds what Remotion doesn't
// have: text-to-video generation, project management, scene-level semantic editing (text, lock,
// order, asset re-matching), evidence resolution, the Chinese UI toggle and shutdown.
// Preview, timeline, prop tweaking and rendering stay in Studio itself.
import { goToComposition, seek } from "@remotion/studio";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Candidate, type Job, type Project, type ProjectSummary, type Scene } from "./api";
import { startStudioTranslation, stopStudioTranslation } from "./i18n/translate";
import { FPS, msLabel, PROJECT_COMPOSITION, TEMPLATES } from "./templates";

type Tab = "project" | "generate" | "settings";

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`fuckvideo.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: unknown) {
  localStorage.setItem(`fuckvideo.${key}`, JSON.stringify(value));
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Workbench() {
  const [open, setOpen] = useState(() => readPref("open", false));
  const [tab, setTab] = useState<Tab>(() => readPref("tab", "project"));
  const [online, setOnline] = useState<boolean | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [zh, setZh] = useState(() => readPref("zh", false));
  const [closed, setClosed] = useState(false);

  useEffect(() => writePref("open", open), [open]);
  useEffect(() => writePref("tab", tab), [tab]);

  const run = useCallback(async (label: string, task: () => Promise<void>) => {
    setBusy(true);
    setStatus(`${label}…`);
    try {
      await task();
      setStatus(`${label}完成`);
    } catch (e) {
      setStatus(`${label}失败：${errText(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshList = useCallback(async () => {
    setProjects([...(await api.listProjects())].sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  // Push the project into Studio: the server writes it as MultiSceneVideo defaultProps and Studio
  // hot-reloads; then select that composition.
  const showInStudio = useCallback(async (next: Project) => {
    setProject(next);
    setSelectedId((cur) => (next.scenes.some((s) => s.id === cur) ? cur : next.scenes[0]?.id || ""));
    writePref("project", next.id);
    await api.writeStudioProps(next.id);
    goToComposition(PROJECT_COMPOSITION);
  }, []);

  const openProject = useCallback(async (id: string) => showInStudio(await api.getProject(id)), [showInStudio]);

  useEffect(() => {
    void (async () => {
      const ok = await api.ping();
      setOnline(ok);
      if (!ok) return;
      await refreshList();
      const last = readPref<string>("project", "");
      if (last) {
        try {
          setProject(await api.getProject(last));
        } catch {
          writePref("project", "");
        }
      }
    })();
  }, [refreshList]);

  const scenes = project?.scenes || [];
  const selected = scenes.find((s) => s.id === selectedId) || scenes[0];

  const jumpTo = (scene: Scene) => {
    setSelectedId(scene.id);
    goToComposition(PROJECT_COMPOSITION);
    seek(Math.round((scene.startMs / 1000) * FPS));
  };

  if (closed) {
    return (
      <div className="card">
        <div className="head"><span className="title">FuckVideo 已关闭</span></div>
        <div className="body"><div className="hint">所有后台服务已停止，可以关掉这个窗口了。下次双击 FuckVideo.exe 重新启动。</div></div>
      </div>
    );
  }

  return (
    <>
      {open && (
        <div className="card">
          <div className="head">
            <span className="title">FuckVideo 工作台</span>
            <button onClick={() => setOpen(false)} title="收起">—</button>
          </div>
          <div className="tabs">
            <button className={tab === "project" ? "on" : ""} onClick={() => setTab("project")}>项目 / 分镜</button>
            <button className={tab === "generate" ? "on" : ""} onClick={() => setTab("generate")}>生成视频</button>
            <button className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")}>设置</button>
          </div>
          <div className="body">
            {online === false && tab !== "settings" && (
              <div className="banner">生成服务（:3037）没有运行。用 FuckVideo.exe 或 npm run dev:video 启动才能用项目和生成功能；界面中文在「设置」里照常可用。</div>
            )}
            {tab === "project" && online && (
              <ProjectTab
                projects={projects}
                project={project}
                selected={selected}
                busy={busy}
                run={run}
                onOpen={openProject}
                onCreate={async (title) => {
                  const created = await api.createProject(title);
                  await refreshList();
                  await showInStudio(created);
                }}
                onChanged={showInStudio}
                onJump={jumpTo}
              />
            )}
            {tab === "generate" && online && (
              <GenerateTab
                onDone={async (id) => {
                  await refreshList();
                  setTab("project");
                  await run("打开新项目", () => openProject(id));
                }}
              />
            )}
            {tab === "settings" && (
              <>
                <label className="switch">
                  <span>Remotion Studio 界面中文</span>
                  <input
                    type="checkbox"
                    checked={zh}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setZh(on);
                      writePref("zh", on);
                      if (on) startStudioTranslation();
                      else stopStudioTranslation();
                    }}
                  />
                </label>
                <div className="hint">
                  只翻译 Studio 界面上的按钮、菜单和提示文字，不改输入框里的值，不碰预览画面，渲染出的视频不受影响。关闭后立刻恢复英文原样。词典在
                  videolab/overlay/i18n/dict.ts，可以自己增补。
                </div>
                <div className="actions" style={{ marginTop: 8 }}>
                  <button
                    className="danger"
                    disabled={online === false}
                    onClick={() => {
                      if (!confirm("关闭 FuckVideo？\n\nRemotion Studio 和生成服务都会停止，正在进行的渲染会中断。")) return;
                      void api.shutdown().then(() => setClosed(true), (e) => setStatus(`关闭失败：${errText(e)}`));
                    }}
                  >
                    关闭 FuckVideo（停止全部服务）
                  </button>
                </div>
              </>
            )}
            <div className="status" title={status}>{status}</div>
          </div>
        </div>
      )}
      <button className={`fab ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)} title="FuckVideo 工作台">
        {open ? "×" : "FV"}
      </button>
    </>
  );
}

type ProjectTabProps = {
  projects: ProjectSummary[];
  project: Project | null;
  selected: Scene | undefined;
  busy: boolean;
  run: (label: string, task: () => Promise<void>) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onCreate: (title: string) => Promise<void>;
  onChanged: (next: Project) => Promise<void>;
  onJump: (scene: Scene) => void;
};

function ProjectTab({ projects, project, selected, busy, run, onOpen, onCreate, onChanged, onJump }: ProjectTabProps) {
  return (
    <>
      <div className="row" style={{ gridTemplateColumns: "1fr auto auto" }}>
        <select value={project?.id || ""} onChange={(e) => void run("载入项目", () => onOpen(e.target.value))}>
          {!project && <option value="">选择项目…</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}（{p.sceneCount} 段）</option>
          ))}
        </select>
        <button
          disabled={busy}
          onClick={() => {
            const title = prompt("新项目名称", "未命名视频项目");
            if (title !== null) void run("新建项目", () => onCreate(title));
          }}
        >
          新建
        </button>
        <button disabled={busy || !project} title="重新写入 Studio（例如刷新页面后）" onClick={() => project && void run("载入到 Studio", () => onOpen(project.id))}>
          载入
        </button>
      </div>
      {project && (
        <>
          <div className="actions">
            <button disabled={busy} onClick={() => void run("解析证据素材", async () => onChanged(await api.resolveEvidence(project.id)))}>
              解析证据
            </button>
            <span className="hint">预览、时间线、调参数、渲染都在 Studio 里，合成为 MultiSceneVideo。</span>
          </div>
          <div className="scenes">
            {project.scenes.map((scene, i) => (
              <button key={scene.id} className={`scene ${scene.id === selected?.id ? "active" : ""}`} onClick={() => onJump(scene)}>
                <div>{i + 1}. {(scene.subtitle || scene.voiceText || "").slice(0, 40)}</div>
                <div className="meta">
                  {msLabel(scene.startMs)} · {scene.templateId}
                  {scene.locked && <span className="lock"> · 已锁定</span>}
                </div>
              </button>
            ))}
          </div>
          {selected && <SceneEditor key={selected.id} project={project} scene={selected} busy={busy} run={run} onChanged={onChanged} />}
        </>
      )}
    </>
  );
}

type SceneEditorProps = {
  project: Project;
  scene: Scene;
  busy: boolean;
  run: (label: string, task: () => Promise<void>) => Promise<void>;
  onChanged: (next: Project) => Promise<void>;
};

function SceneEditor({ project, scene, busy, run, onChanged }: SceneEditorProps) {
  const [voiceText, setVoiceText] = useState(scene.voiceText || "");
  const [subtitle, setSubtitle] = useState(scene.subtitle || "");
  const [visualIntent, setVisualIntent] = useState(scene.visualIntent || "");
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const move = (offset: number) => {
    const ids = project.scenes.map((s) => s.id);
    const i = ids.indexOf(scene.id);
    const j = i + offset;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void run("调整顺序", async () => onChanged(await api.reorder(project.id, ids)));
  };

  return (
    <>
      <label>旁白文本<textarea value={voiceText} onChange={(e) => setVoiceText(e.target.value)} /></label>
      <label>字幕 / 画面文案<textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></label>
      <label>视觉意图（重配素材时参考）<textarea value={visualIntent} onChange={(e) => setVisualIntent(e.target.value)} /></label>
      <div className="actions">
        <button
          className="primary"
          disabled={busy}
          onClick={() => void run("保存分镜", async () =>
            onChanged(await api.patchScene(project.id, scene.id, { voiceText, subtitle, visualIntent, props: { body: subtitle } })))}
        >
          保存
        </button>
        <button disabled={busy} onClick={() => void run(scene.locked ? "解除锁定" : "锁定", async () => onChanged(await api.setLocked(project.id, scene.id, !scene.locked)))}>
          {scene.locked ? "解锁" : "锁定"}
        </button>
        <button disabled={busy} onClick={() => void run("重配素材", async () => setCandidates((await api.rematch(project.id, scene.id)).candidates || []))}>
          重配素材
        </button>
        <button disabled={busy} onClick={() => move(-1)}>上移</button>
        <button disabled={busy} onClick={() => move(1)}>下移</button>
      </div>
      {candidates.map((c) => (
        <div className="candidate" key={c.id}>
          <strong>{c.title || c.id}</strong>
          <div className="muted">{c.reason} · 分数 {c.score}</div>
          <div className="muted path">{c.path}</div>
          <button
            disabled={busy}
            onClick={() => void run("替换素材", async () => {
              await onChanged(await api.replaceMaterial(project.id, scene.id, c));
              setCandidates([]);
            })}
          >
            替换为该素材
          </button>
        </div>
      ))}
    </>
  );
}

function GenerateTab({ onDone }: { onDone: (projectId: string) => Promise<void> }) {
  const [form, setForm] = useState(() =>
    readPref("generateForm", {
      text: "",
      title: "",
      subtitle: "",
      instruction: "标准播音风格，吐字清晰，语速平稳，停顿自然",
      mode: "auto-scenes",
      template: "SinoJapaneseWarDemo",
      captionStyle: "typewriter",
      progressStyle: "gradient",
    }),
  );
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLPreElement>(null);
  const running = job?.status === "queued" || job?.status === "running";

  useEffect(() => writePref("generateForm", form), [form]);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (!running || !job) return;
    const timer = setInterval(async () => {
      try {
        const next = await api.getJob(job.id);
        setJob(next);
        if (next.status === "succeeded" && next.result?.projectId) await onDone(next.result.projectId);
      } catch (e) {
        setError(errText(e));
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [job, running, onDone]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [job?.logs?.length]);

  return (
    <>
      <label>
        文案
        <textarea className="tall" value={form.text} onChange={set("text")} placeholder="粘贴旁白文案：自动配音、分镜、匹配素材，生成一个新项目" />
      </label>
      <div className="row">
        <label>标题<input value={form.title} onChange={set("title")} /></label>
        <label>副标题<input value={form.subtitle} onChange={set("subtitle")} /></label>
      </div>
      <div className="row">
        <label>
          模式
          <select value={form.mode} onChange={set("mode")}>
            <option value="auto-scenes">自动分镜</option>
            <option value="single-template">单模板</option>
          </select>
        </label>
        <label>
          模板
          <select value={form.template} onChange={set("template")} disabled={form.mode !== "single-template"}>
            {TEMPLATES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          字幕样式
          <select value={form.captionStyle} onChange={set("captionStyle")}>
            {["typewriter", "classic", "none"].map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label>
          进度条样式
          <select value={form.progressStyle} onChange={set("progressStyle")}>
            {["gradient", "thin", "none"].map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <label>语音指令<input value={form.instruction} onChange={set("instruction")} /></label>
      {job && (
        <>
          <div className="muted">{job.status} · {job.error || job.progress}</div>
          <pre className="logs" ref={logRef}>{(job.logs || []).join("\n") || "等待日志…"}</pre>
        </>
      )}
      {error && <div className="error">{error}</div>}
      <div className="actions">
        <button
          className="primary"
          disabled={running}
          onClick={async () => {
            setError("");
            if (!form.text.trim()) return setError("请输入文案");
            try {
              setJob(await api.createJob(form));
            } catch (e) {
              setError(errText(e));
            }
          }}
        >
          {running ? "生成中…" : job?.status === "failed" ? "重新生成" : "开始生成"}
        </button>
      </div>
    </>
  );
}
