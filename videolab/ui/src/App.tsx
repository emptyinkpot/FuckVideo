import { Player, type PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MultiSceneVideo } from "../../../src/templates/MultiSceneVideo";
import { api, type MultiSceneProps, type Project, type ProjectSummary } from "./api";
import { GeneratorDialog } from "./GeneratorDialog";
import { SceneEditor } from "./SceneEditor";
import { FPS, msLabel, STUDIO_URL } from "./templates";
import { Timeline } from "./Timeline";

const LAST_PROJECT_KEY = "videolab.lastProjectId";

// Same rule as calculateMetadata of the MultiSceneVideo composition in src/Root.tsx.
function durationOf(props: MultiSceneProps | null) {
  const end = (props?.scenes || []).reduce((max, s) => Math.max(max, s.fromFrame + s.durationInFrames), 0);
  return Math.max(150, end || 390);
}

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [props, setProps] = useState<MultiSceneProps | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [frame, setFrame] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const playerRef = useRef<PlayerRef>(null);

  const run = useCallback(async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    setStatus(`${label}…`);
    try {
      await task();
      setStatus(`${label}完成`);
    } catch (error) {
      setStatus(`${label}失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy("");
    }
  }, []);

  const refreshList = useCallback(async () => setProjects(await api.listProjects()), []);

  const openProject = useCallback(async (id: string) => {
    const [next, nextProps] = await Promise.all([api.getProject(id), api.getProps(id)]);
    setProject(next);
    setProps(nextProps);
    setSelectedId((current) => (next.scenes.some((s) => s.id === current) ? current : next.scenes[0]?.id || ""));
    localStorage.setItem(LAST_PROJECT_KEY, id);
    const url = new URL(location.href);
    url.searchParams.set("project", id);
    history.replaceState(null, "", url);
  }, []);

  // Any mutation returns the updated project; props are re-derived server-side.
  const applyProject = useCallback(async (next: Project) => {
    setProject(next);
    setProps(await api.getProps(next.id));
  }, []);

  useEffect(() => {
    void run("加载项目", async () => {
      const list = await api.listProjects();
      setProjects(list);
      const wanted = new URL(location.href).searchParams.get("project") || localStorage.getItem(LAST_PROJECT_KEY);
      const id = list.find((p) => p.id === wanted)?.id || [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id;
      if (id) await openProject(id);
    });
  }, [run, openProject]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [props]);

  const durationInFrames = useMemo(() => durationOf(props), [props]);
  const scenes = project?.scenes || [];
  const selected = scenes.find((s) => s.id === selectedId) || scenes[0];

  const selectScene = (id: string) => {
    setSelectedId(id);
    const scene = scenes.find((s) => s.id === id);
    if (scene) playerRef.current?.seekTo(Math.round((scene.startMs / 1000) * FPS));
  };

  const seekMs = (ms: number) => playerRef.current?.seekTo(Math.round((ms / 1000) * FPS));

  if (closed) {
    return (
      <div className="closed">
        <div>FuckVideo 已关闭</div>
        <small>所有后台服务已停止，可以关掉这个窗口了。下次双击 FuckVideo.exe 重新启动。</small>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">VideoLab</div>
        <select
          className="project-select"
          value={project?.id || ""}
          onChange={(e) => void run("切换项目", () => openProject(e.target.value))}
        >
          {!project && <option value="">未载入项目</option>}
          {[...projects]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}（{p.sceneCount} 段）
              </option>
            ))}
        </select>
        <button
          onClick={() => {
            const title = prompt("新项目名称", "未命名视频项目");
            if (title === null) return;
            void run("新建项目", async () => {
              const created = await api.createProject(title);
              await refreshList();
              await openProject(created.id);
            });
          }}
        >
          新建
        </button>
        <div className="status" title={status}>{status}</div>
        <button className="accent" onClick={() => setGeneratorOpen(true)}>生成视频</button>
        <button
          disabled={!project || !!busy}
          onClick={() =>
            project &&
            void run("解析证据素材", async () => applyProject(await api.resolveEvidence(project.id)))
          }
        >
          解析证据
        </button>
        <button
          disabled={!project || !!busy}
          title="把当前项目写进 MultiSceneVideo 的 defaultProps，在原版 Remotion Studio 里打开"
          onClick={() =>
            project &&
            void run("写入 Studio", async () => {
              await api.writeStudioProps(project.id);
              window.open(`${STUDIO_URL}/MultiSceneVideo`, "_blank");
            })
          }
        >
          在 Studio 中打开
        </button>
        <button
          className="primary"
          disabled={!project || !!busy}
          onClick={() =>
            project &&
            void run("导出成片", async () => {
              await applyProject(await api.exportProject(project.id));
              await refreshList();
            })
          }
        >
          {busy === "导出成片" ? "导出中…" : "导出"}
        </button>
        <button
          className="danger"
          onClick={() => {
            if (!confirm("关闭 FuckVideo？\n\nVideoLab、Remotion Studio 和生成服务都会停止，正在进行的渲染会中断。")) return;
            void api.shutdown().then(() => {
              setClosed(true);
              setTimeout(() => window.close(), 800);
            });
          }}
        >
          关闭
        </button>
      </header>

      <main className="workspace">
        <section className="panel scenes">
          <div className="panel-head">
            <span>分镜</span>
            <span className="muted">{scenes.length}</span>
          </div>
          <div className="scroll">
            {scenes.map((scene, index) => (
              <button
                key={scene.id}
                className={`scene ${scene.id === selected?.id ? "active" : ""}`}
                onClick={() => selectScene(scene.id)}
              >
                <div className="scene-title">
                  {index + 1}. {(scene.subtitle || scene.voiceText || "").slice(0, 54)}
                </div>
                <div className="tags">
                  <span>{msLabel(scene.startMs)}</span>
                  <span>{scene.templateId}</span>
                  {scene.locked && <span className="locked">已锁定</span>}
                </div>
              </button>
            ))}
            {!scenes.length && <div className="empty">没有分镜。点「生成视频」从文案生成一个项目。</div>}
          </div>
        </section>

        <section className="panel preview">
          <div className="panel-head">
            <span>预览</span>
            <span className="muted">
              {msLabel((frame / FPS) * 1000)} / {msLabel((durationInFrames / FPS) * 1000)}
              {project?.videoUrl && (
                <>
                  {" · "}
                  <a href={project.videoUrl} target="_blank" rel="noreferrer">打开已导出成片</a>
                </>
              )}
            </span>
          </div>
          <div className="player-box">
            {props ? (
              <Player
                ref={playerRef}
                component={MultiSceneVideo}
                inputProps={props as never}
                durationInFrames={durationInFrames}
                fps={FPS}
                compositionWidth={1280}
                compositionHeight={720}
                style={{ width: "100%", aspectRatio: "16 / 9" }}
                controls
                clickToPlay
                acknowledgeRemotionLicense
              />
            ) : (
              <div className="empty">{busy ? "加载中…" : "选择或生成一个项目"}</div>
            )}
          </div>
        </section>

        <aside className="panel editor">
          {project && selected ? (
            <SceneEditor
              key={`${project.id}:${selected.id}`}
              project={project}
              scene={selected}
              busy={!!busy}
              run={run}
              onProject={applyProject}
            />
          ) : (
            <div className="empty">没有选中的分镜</div>
          )}
        </aside>
      </main>

      <Timeline
        scenes={scenes}
        selectedId={selected?.id || ""}
        playheadMs={(frame / FPS) * 1000}
        totalMs={(durationInFrames / FPS) * 1000}
        onSelect={selectScene}
        onSeek={seekMs}
      />

      {generatorOpen && (
        <GeneratorDialog
          onClose={() => setGeneratorOpen(false)}
          onDone={async (projectId) => {
            setGeneratorOpen(false);
            await refreshList();
            await run("打开新项目", () => openProject(projectId));
          }}
        />
      )}
    </div>
  );
}
