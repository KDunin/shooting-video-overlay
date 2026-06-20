import type { Sql } from "postgres";

/**
 * Idempotent schema bootstrap. Authoritative DDL for the project — the Drizzle schema in
 * `./schema.ts` and the analyzer's raw SQL mirror this. Safe to run on every API start.
 *
 * For a single-user home-server MVP this beats a full migration toolchain. When the schema
 * needs to evolve, add `ALTER`s here guarded by `IF NOT EXISTS` / catalog checks.
 */
export async function ensureSchema(sql: Sql): Promise<void> {
  await sql.unsafe(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS videos (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      original_name text NOT NULL,
      storage_path  text NOT NULL,
      audio_path    text,
      peaks_path    text,
      duration_s    double precision,
      fps           double precision,
      width         integer,
      height        integer,
      sample_rate   integer,
      status        text NOT NULL DEFAULT 'uploaded',
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id    uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      status      text NOT NULL DEFAULT 'queued',
      approach    text NOT NULL DEFAULT 'spectral',
      params      jsonb NOT NULL,
      error       text,
      attempts    integer NOT NULL DEFAULT 0,
      locked_at   timestamptz,
      started_at  timestamptz,
      finished_at timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS analysis_jobs_status_idx ON analysis_jobs (status, created_at);

    CREATE TABLE IF NOT EXISTS markers (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id    uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      kind        text NOT NULL,
      t_seconds   double precision NOT NULL,
      confidence  real,
      source      text NOT NULL,
      is_ignored  boolean NOT NULL DEFAULT false,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS markers_video_idx ON markers (video_id, kind, t_seconds);
  `);
}
