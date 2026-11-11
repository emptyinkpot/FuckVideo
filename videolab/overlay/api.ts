// Client for the VideoLab server (videolab/server/server.mjs, :3037). The workbench runs inside the
// Remotion Studio page (:3000), so calls are cross-origin; the server allows any origin.

export const API_BASE = "http://127.0.0.1:3037";

export type Scene = {
  id: string;
  order?: number;
  startMs: number;
  endMs: number;
  voiceText: string;
  subtitle: string;
  sceneType: string;
  templateId: string;
  visualIntent?: string;
  visualLayer?: { path?: string; templateId?: string; type?: string } | null;
  locked?: boolean;
};

export type Layout = Record<string, number | string | undefined>;

export type Project = {
  id: string;
  title: string;
  scenes: Scene[];
  history?: unknown[];
  captionStyle?: string;
  progressStyle?: string;
  captionLayout?: Layout;
  progressLayout?: Layout;
  durationMs: number;
  videoUrl: string;
};

export type ProjectSummary = {
  id: string;
  title: string;
  updatedAt: number;
  sceneCount: number;
  videoUrl: string;
};

export type Candidate = { id: string; title?: string; reason?: string; score?: number; path?: string };

export type Job = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress?: string;
  logs?: string[];
  error?: string;
  result?: { projectId?: string; videoUrl?: string } | null;
};

// MultiSceneVideo props as produced by projectToMultiSceneProps (pipeline/project-store.mjs).
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const payload = await res.json();
  if (!payload.success) throw new Error(payload.error || `请求失败 (${res.status})`);
  return payload.data as T;
}

const p = (id: string) => `/api/projects/${encodeURIComponent(id)}`;
const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = (body: unknown): RequestInit => ({ method: "PATCH", body: JSON.stringify(body) });

export const api = {
  listProjects: () => call<ProjectSummary[]>("/api/projects"),
  createProject: (title: string) => call<Project>("/api/projects", post({ title })),
  getProject: (id: string) => call<Project>(p(id)),
  patchScene: (id: string, sceneId: string, body: Partial<Scene> & { props?: unknown }) =>
    call<Project>(`${p(id)}/scenes/${encodeURIComponent(sceneId)}`, patch({ patch: body })),
  patchInfrastructure: (id: string, body: unknown) => call<Project>(`${p(id)}/infrastructure`, patch({ patch: body })),
  setLocked: (id: string, sceneId: string, locked: boolean) =>
    call<Project>(`${p(id)}/scenes/${encodeURIComponent(sceneId)}/lock`, post({ locked })),
  rematch: (id: string, sceneId: string) =>
    call<{ candidates: Candidate[] }>(`${p(id)}/scenes/${encodeURIComponent(sceneId)}/rematch-material`, post()),
  replaceMaterial: (id: string, sceneId: string, candidate: Candidate) =>
    call<Project>(`${p(id)}/scenes/${encodeURIComponent(sceneId)}/replace-material`, post({ candidate })),
  reorder: (id: string, sceneIds: string[]) => call<Project>(`${p(id)}/reorder`, post({ sceneIds })),
  resolveEvidence: (id: string) => call<Project>(`${p(id)}/evidence/resolve`, post({ fetchRemote: true })),
  // Writes the project as MultiSceneVideo defaultProps (src/generated/...); Studio hot-reloads it.
  writeStudioProps: (id: string) => call<unknown>(`${p(id)}/studio-default-props`, post()),
  ping: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, { signal: AbortSignal.timeout(1500) });
      return res.ok;
    } catch {
      return false;
    }
  },
  createJob: (body: unknown) => call<Job>("/api/jobs", post(body)),
  getJob: (id: string) => call<Job>(`/api/jobs/${encodeURIComponent(id)}`),
  shutdown: () => call<unknown>("/api/shutdown", post()),
};
