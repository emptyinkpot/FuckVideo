/**
 * Stage 1 placeholder. Task #13 will port services/material-vector-search/
 * and switch the storage backend to LanceDB embedded (npm @lancedb/lancedb,
 * no Python sidecar) + Qwen Embedding via sub2api.
 */
import type { z } from 'zod';
import type {
  MaterialSearchRequestSchema,
  MaterialSearchResultSchema,
} from '@huasheng-clone/schemas';

export async function searchMaterials(
  _req: z.infer<typeof MaterialSearchRequestSchema>
): Promise<z.infer<typeof MaterialSearchResultSchema>> {
  throw new Error('[material-search] searchMaterials() not implemented yet — pending Task #13');
}

export async function indexMaterial(_id: string, _description: string): Promise<void> {
  throw new Error('[material-search] indexMaterial() not implemented yet — pending Task #13');
}
