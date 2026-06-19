/**
 * Tiny typed API client. All paths go through Next rewrite to apps/api.
 */
import type { InnovideoConfig } from '@huasheng-clone/schemas';

const BASE = '';

export async function fetchInnovideoConfig(): Promise<InnovideoConfig> {
  const res = await fetch(`${BASE}/api/innovideo/config`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
  return (await res.json()) as InnovideoConfig;
}

export interface CreateDraftInput {
  script: string;
  trackPreference: 'general' | 'football' | 'science' | 'finance' | 'history';
  aspectRatio: '16:9' | '9:16';
}

export interface CreateDraftResponse {
  draftId: string;
  status: 'planning';
}

export async function createDraft(input: CreateDraftInput): Promise<CreateDraftResponse> {
  const res = await fetch(`${BASE}/api/innovideo/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`create failed: ${res.status} ${text}`);
  }
  return (await res.json()) as CreateDraftResponse;
}

export interface DraftDetail {
  id: string;
  status: 'idle' | 'planning' | 'tts' | 'matching' | 'rendering' | 'done' | 'failed';
  title: string;
  inputScript: string;
  scenePlan: unknown;
  errorMessage: string | null;
  outputPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchDraft(draftId: string): Promise<DraftDetail> {
  const res = await fetch(`${BASE}/api/innovideo/draft/${draftId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`draft fetch failed: ${res.status}`);
  return (await res.json()) as DraftDetail;
}
