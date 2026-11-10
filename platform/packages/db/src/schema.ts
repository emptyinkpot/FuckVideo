/**
 * Stage 1 SQLite schema (local-dev tier).
 * Stage 2b will swap the driver to Postgres while keeping these table shapes
 * (Drizzle's `pgTable`/`sqliteTable` are isomorphic at the column level).
 *
 * Field naming mirrors @huasheng-clone/schemas Zod definitions so the api
 * layer can do straight z.parse(row) without remapping.
 */
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default(''),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const drafts = sqliteTable(
  'drafts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(''),
    inputScript: text('input_script').notNull(),
    inputKind: text('input_kind', { enum: ['script', 'audio', 'voiceover'] })
      .notNull()
      .default('script'),
    trackPreference: text('track_preference', {
      enum: ['general', 'football', 'science', 'finance', 'history'],
    })
      .notNull()
      .default('general'),
    aspectRatio: text('aspect_ratio', { enum: ['16:9', '9:16'] })
      .notNull()
      .default('16:9'),
    /** Full ScenePlan JSON (matches @huasheng-clone/schemas ScenePlanSchema). */
    scenePlanJson: text('scene_plan_json'),
    status: text('status', {
      enum: ['idle', 'planning', 'tts', 'matching', 'rendering', 'done', 'failed'],
    })
      .notNull()
      .default('idle'),
    errorMessage: text('error_message'),
    /** Relative to storage/, e.g. "renders/draft_xxx.mp4". */
    outputPath: text('output_path'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdx: index('drafts_user_idx').on(table.userId),
    statusIdx: index('drafts_status_idx').on(table.status),
  })
);

export const materials = sqliteTable(
  'materials',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['footage', 'image', 'audio', 'programmatic'] }).notNull(),
    uri: text('uri').notNull(),
    thumbnailUri: text('thumbnail_uri'),
    durationSec: integer('duration_sec'),
    width: integer('width'),
    height: integer('height'),
    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),
    /** JSON array of strings. */
    tagsJson: text('tags_json').notNull().default('[]'),
    source: text('source').notNull(), // pexels | pixabay | user-upload | programmatic
    licenseInfo: text('license_info'),
    uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    kindIdx: index('materials_kind_idx').on(table.kind),
    sourceIdx: index('materials_source_idx').on(table.source),
  })
);

export const renderJobs = sqliteTable(
  'render_jobs',
  {
    id: text('id').primaryKey(),
    draftId: text('draft_id')
      .notNull()
      .references(() => drafts.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: ['queued', 'running', 'done', 'failed', 'cancelled'],
    })
      .notNull()
      .default('queued'),
    progressPercent: integer('progress_percent').notNull().default(0),
    errorMessage: text('error_message'),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    draftIdx: index('render_jobs_draft_idx').on(table.draftId),
    statusIdx: index('render_jobs_status_idx').on(table.status),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
export type RenderJob = typeof renderJobs.$inferSelect;
export type NewRenderJob = typeof renderJobs.$inferInsert;
