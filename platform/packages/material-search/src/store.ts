/**
 * LanceDB embedded vector store for the material library.
 * No Python sidecar, no Redis — Stage 1 keeps everything local-file based.
 *
 * Schema is a flat record per material; the vector is keyed `embedding`
 * and lancedb auto-indexes for cosine similarity by default.
 */
import * as lancedb from '@lancedb/lancedb';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { DEFAULT_EMBEDDING_DIM } from './embedder.js';

const TABLE_NAME = 'materials';

export interface MaterialRecord {
  id: string;
  kind: string;
  uri: string;
  title: string;
  description: string;
  tagsJson: string;
  source: string;
  /** Pre-computed embedding (dimension = DEFAULT_EMBEDDING_DIM). */
  embedding: number[];
}

export interface SearchHit {
  id: string;
  kind: string;
  uri: string;
  title: string;
  description: string;
  tagsJson: string;
  source: string;
  /** Smaller distance = more similar. We expose it as-is. */
  _distance: number;
}

let cachedConn: lancedb.Connection | null = null;
let cachedTable: lancedb.Table | null = null;

export async function getStore(): Promise<{ conn: lancedb.Connection; table: lancedb.Table }> {
  if (cachedConn && cachedTable) return { conn: cachedConn, table: cachedTable };

  const lancePath = path.resolve(
    process.cwd(),
    process.env.LANCEDB_PATH ?? './storage/lancedb'
  );
  await mkdir(lancePath, { recursive: true });

  const conn = await lancedb.connect(lancePath);
  const existing = await conn.tableNames();

  let table: lancedb.Table;
  if (existing.includes(TABLE_NAME)) {
    table = await conn.openTable(TABLE_NAME);
  } else {
    // Seed with one zero-vector row so the table has a stable schema.
    // We delete this row immediately after creation.
    const zeroVec = new Array(DEFAULT_EMBEDDING_DIM).fill(0);
    const seedRow: MaterialRecord = {
      id: '__seed__',
      kind: 'image',
      uri: 'about:blank',
      title: '',
      description: '',
      tagsJson: '[]',
      source: 'seed',
      embedding: zeroVec,
    };
    table = await conn.createTable(TABLE_NAME, [seedRow]);
    await table.delete(`id = '__seed__'`);
  }

  cachedConn = conn;
  cachedTable = table;
  return { conn, table };
}

export async function upsertMaterial(record: MaterialRecord): Promise<void> {
  const { table } = await getStore();
  // LanceDB doesn't have native upsert; emulate via delete-then-add.
  await table.delete(`id = '${record.id.replace(/'/g, "''")}'`);
  await table.add([record]);
}

export async function searchByVector(
  queryVector: number[],
  limit: number
): Promise<SearchHit[]> {
  const { table } = await getStore();
  const results = await table.search(queryVector).limit(limit).toArray();
  return results as unknown as SearchHit[];
}
