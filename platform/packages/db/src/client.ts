/**
 * Singleton SQLite + Drizzle client.
 * Both apps/api and apps/worker import this — SQLite WAL mode supports
 * a single writer + many readers without locking issues for local-dev.
 *
 * Stage 2b: swap to PostgresJS / node-postgres + drizzle-orm/postgres-js
 * without changing call sites.
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

let cachedDb: BetterSQLite3Database<typeof schema> | null = null;
let cachedSqlite: Database.Database | null = null;
const packageDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(packageDir, '../../..');

export interface CreateDbOptions {
  /** SQLite file URL (e.g. "file:./storage/db.sqlite") or absolute path. */
  url?: string;
  /** Force a fresh client (mostly for tests). */
  fresh?: boolean;
}

export async function getDb(options: CreateDbOptions = {}): Promise<BetterSQLite3Database<typeof schema>> {
  if (cachedDb && !options.fresh) return cachedDb;

  const raw = options.url ?? process.env.DATABASE_URL ?? 'file:./storage/huasheng-clone.sqlite';
  const filePath = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
  await mkdir(path.dirname(absolute), { recursive: true });

  const sqlite = new Database(absolute);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  cachedSqlite = sqlite;
  cachedDb = drizzle(sqlite, { schema });
  return cachedDb;
}

export function closeDb(): void {
  if (cachedSqlite) {
    cachedSqlite.close();
    cachedSqlite = null;
    cachedDb = null;
  }
}
