/**
 * Stage 1 DB bootstrap.
 * Instead of pulling drizzle-kit migrations into the dev critical path, we
 * issue idempotent CREATE TABLE IF NOT EXISTS so `pnpm dev` "just works" on
 * a clean clone. Stage 2 swaps this for real drizzle migrations once the
 * schema starts evolving.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '@huasheng-clone/db';
import { nanoid } from 'nanoid';

let bootstrapped = false;

export async function bootstrapDb(): Promise<void> {
  if (bootstrapped) return;
  const db = await getDb();

  await db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    input_script TEXT NOT NULL,
    input_kind TEXT NOT NULL DEFAULT 'script',
    track_preference TEXT NOT NULL DEFAULT 'general',
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    scene_plan_json TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    error_message TEXT,
    output_path TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.run(sql`CREATE INDEX IF NOT EXISTS drafts_user_idx ON drafts(user_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS drafts_status_idx ON drafts(status)`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    uri TEXT NOT NULL,
    thumbnail_uri TEXT,
    duration_sec INTEGER,
    width INTEGER,
    height INTEGER,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL,
    license_info TEXT,
    uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.run(sql`CREATE INDEX IF NOT EXISTS materials_kind_idx ON materials(kind)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS materials_source_idx ON materials(source)`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS render_jobs (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    progress_percent INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.run(sql`CREATE INDEX IF NOT EXISTS render_jobs_draft_idx ON render_jobs(draft_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS render_jobs_status_idx ON render_jobs(status)`);

  await ensureAnonymousUser();
  bootstrapped = true;
  console.log('[api] db bootstrap complete');
}

/** Stage 1 has no login; every draft is attributed to a single fixed user. */
export const ANONYMOUS_USER_ID = 'usr_anon_local';

async function ensureAnonymousUser(): Promise<void> {
  const db = await getDb();
  const existing = await db.run(
    sql`SELECT id FROM users WHERE id = ${ANONYMOUS_USER_ID} LIMIT 1`
  );
  // better-sqlite3 .run returns lastInsertRowid; we need a select to check existence.
  // Cheaper: just INSERT OR IGNORE.
  void existing;
  await db.run(
    sql`INSERT OR IGNORE INTO users (id, email, name) VALUES (${ANONYMOUS_USER_ID}, ${'anon@local'}, ${'Stage 1 anon user'})`
  );
}

/** Stable id factory used by handlers — keeps id format consistent across services. */
export function newDraftId(): string {
  return `draft_${nanoid(12)}`;
}

export function newRenderJobId(): string {
  return `rj_${nanoid(12)}`;
}
