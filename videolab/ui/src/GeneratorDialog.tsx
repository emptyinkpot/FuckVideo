import { useEffect, useRef, useState } from "react";
import { api, type Job } from "./api";
import { TEMPLATES } from "./templates";

type Props = { onClose: () => void; onDone: (projectId: string) => Promise<void> };

// Text -> TTS -> scene planning -> asset matching -> render, via POST /api/jobs (pipeline/*).
export function GeneratorDialog({ onClose, onDone }: Props) {
  const [form, setForm] = useState({
    text: "",
    title: "",
    subtitle: "",
    instruction: "标准播音风格，吐字清晰，语速平稳，停顿自然",
    mode: "auto-scenes",
    template: "SinoJapaneseWarDemo",
    theme: "historical",
    captionStyle: "typewriter",
    progressStyle: "gradient",
  });
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLPreElement>(null);
  const running = job?.status === "queued" || job?.status === "running";

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (!running || !job) return;
    const timer = setInterval(async () => {
      try {
        const next = await api.getJob(job.id);
        setJob(next);
        if (next.status === "succeeded" && next.result?.projectId) await onDone(next.result.projectId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [job, running, onDone]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [job?.logs?.length]);

  const submit = async () => {
    setError("");
    if (!form.text.trim()) {
      setError("请输入文案");
      return;
    }
    try {
      setJob(await api.createJob(form));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !running && onClose()}>
      <div className="modal">
        <div className="panel-head">
          <span>文案生成视频</span>
          <button className="ghost" disabled={running} onClick={onClose}>×</button>
        </div>
        <div className="form">
          <label>
            文案
            <textarea className="tall" value={form.text} onChange={set("text")} placeholder="粘贴旁白文案，自动配音、分镜、匹配素材并渲染成片" />
          </label>
          <div className="row">
            <label>标题<input value={form.title} onChange={set("title")} /></label>
            <label>副标题<input value={form.subtitle} onChange={set("subtitle")} /></label>
          </div>
          <div className="row">
            <label>
              生成模式
              <select value={form.mode} onChange={set("mode")}>
                <option value="auto-scenes">自动分镜（多模板）</option>
                <option value="single-template">单模板</option>
              </select>
            </label>
            <label>
              模板（单模板模式）
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
              <div className="muted">
                {job.status} · {job.error || job.progress}
              </div>
              <pre className="logs" ref={logRef}>{(job.logs || []).join("\n") || "等待日志…"}</pre>
            </>
          )}
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button className="primary" disabled={running} onClick={() => void submit()}>
              {running ? "生成中…" : job?.status === "failed" ? "重新生成" : "开始生成"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
