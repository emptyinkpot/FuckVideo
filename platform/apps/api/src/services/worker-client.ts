import {
  RenderResponseSchema,
  type RenderRequest,
  type RenderResponse,
} from '@huasheng-clone/schemas';

const DEFAULT_WORKER_BASE_URL = 'http://localhost:3002';

export async function enqueueWorkerRender(request: RenderRequest): Promise<RenderResponse> {
  const baseUrl = process.env.WORKER_BASE_URL ?? DEFAULT_WORKER_BASE_URL;
  const res = await fetch(`${baseUrl}/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });

  const payload = await res.json();
  if (!res.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : `worker returned ${res.status}`;
    throw new Error(`[worker-client] enqueue failed: ${message}`);
  }
  return RenderResponseSchema.parse(payload);
}
