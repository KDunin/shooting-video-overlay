import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { DetectionParams } from "shared";

/**
 * NOTE: the authoritative DDL lives in `./migrate.ts` (idempotent, run on boot). This Drizzle
 * schema mirrors it for typed queries — keep the two in sync. The Python analyzer reads/writes
 * the same tables via raw SQL (see apps/analyzer/src/db.py).
 */

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  originalName: text("original_name").notNull(),
  storagePath: text("storage_path").notNull(),
  audioPath: text("audio_path"),
  peaksPath: text("peaks_path"),
  durationS: doublePrecision("duration_s"),
  fps: doublePrecision("fps"),
  width: integer("width"),
  height: integer("height"),
  sampleRate: integer("sample_rate"),
  status: text("status").notNull().default("uploaded"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analysisJobs = pgTable(
  "analysis_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    approach: text("approach").notNull().default("spectral"),
    params: jsonb("params").$type<DetectionParams>().notNull(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analysis_jobs_status_idx").on(t.status, t.createdAt)],
);

export const markers = pgTable(
  "markers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    tSeconds: doublePrecision("t_seconds").notNull(),
    confidence: real("confidence"),
    source: text("source").notNull(),
    isIgnored: boolean("is_ignored").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("markers_video_idx").on(t.videoId, t.kind, t.tSeconds)],
);

export type VideoRow = typeof videos.$inferSelect;
export type AnalysisJobRow = typeof analysisJobs.$inferSelect;
export type MarkerRow = typeof markers.$inferSelect;
