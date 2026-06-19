/**
 * Public material-search API: index + query, both backed by Qwen embedding
 * + LanceDB embedded.
 */
import { z } from 'zod';
import {
  MaterialSchema,
  MaterialSearchRequestSchema,
  MaterialSearchResultSchema,
  type Material,
} from '@huasheng-clone/schemas';
import { embedSingle } from './embedder.js';
import { upsertMaterial, searchByVector, type MaterialRecord } from './store.js';

/** Convert a Material into the searchable text passed to the embedder. */
function materialToText(material: Material): string {
  const tags = material.tags.length ? `标签: ${material.tags.join(', ')}` : '';
  return [material.title, material.description, tags].filter(Boolean).join('\n').trim();
}

export async function indexMaterial(material: unknown): Promise<void> {
  const parsed = MaterialSchema.parse(material);
  const embedding = await embedSingle(materialToText(parsed));
  const record: MaterialRecord = {
    id: parsed.id,
    kind: parsed.kind,
    uri: parsed.uri,
    title: parsed.title,
    description: parsed.description,
    tagsJson: JSON.stringify(parsed.tags),
    source: parsed.source,
    embedding,
  };
  await upsertMaterial(record);
}

export async function searchMaterials(
  request: unknown
): Promise<z.infer<typeof MaterialSearchResultSchema>> {
  const req = MaterialSearchRequestSchema.parse(request);

  const queryVector = await embedSingle(req.query);
  const rawHits = await searchByVector(queryVector, req.limit);

  const hits = rawHits
    .map((hit) => {
      const tags = safeParseTags(hit.tagsJson);
      // Cosine distance → similarity score in [0, 1]. LanceDB returns L2 by
      // default; for normalized embeddings (Qwen v3 is normalized) L2 ≈ √(2-2cos),
      // so similarity = 1 - distance^2 / 2.
      const score = clamp01(1 - (hit._distance * hit._distance) / 2);
      return {
        material: {
          id: hit.id,
          kind: hit.kind as Material['kind'],
          uri: hit.uri,
          title: hit.title,
          description: hit.description,
          tags,
          source: hit.source,
          createdAt: new Date().toISOString(),
        },
        score,
      };
    })
    .filter((hit) => hit.score >= req.minScore);

  return MaterialSearchResultSchema.parse({ query: req.query, hits });
}

function safeParseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
