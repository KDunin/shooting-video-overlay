"""Database access for the analyzer worker.

Shares the Postgres schema owned by the API (apps/api/src/db/migrate.ts). The job queue is
the `analysis_jobs` table; jobs are claimed atomically with FOR UPDATE SKIP LOCKED so multiple
workers (or restarts) never double-process a job.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import psycopg
from psycopg.rows import dict_row

from .config import DATABASE_URL


@dataclass
class ClaimedJob:
    id: str
    video_id: str
    params: dict[str, Any]
    storage_path: str


def connect() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL, autocommit=False)


def claim_next_job(conn: psycopg.Connection) -> ClaimedJob | None:
    """Atomically claim the oldest queued job and mark it running. Returns None if idle."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE analysis_jobs AS j
               SET status = 'running',
                   started_at = now(),
                   attempts = j.attempts + 1,
                   locked_at = now()
             WHERE j.id = (
                 SELECT id FROM analysis_jobs
                  WHERE status = 'queued'
                  ORDER BY created_at
                  FOR UPDATE SKIP LOCKED
                  LIMIT 1
             )
            RETURNING j.id, j.video_id, j.params
            """
        )
        row = cur.fetchone()
        if row is None:
            conn.rollback()
            return None

        cur.execute("SELECT storage_path FROM videos WHERE id = %s", (row["video_id"],))
        video = cur.fetchone()
        conn.commit()

        params = row["params"] if isinstance(row["params"], dict) else json.loads(row["params"])
        return ClaimedJob(
            id=str(row["id"]),
            video_id=str(row["video_id"]),
            params=params,
            storage_path=video["storage_path"] if video else "",
        )


def insert_markers(conn: psycopg.Connection, video_id: str, markers: list[dict]) -> None:
    if not markers:
        return
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO markers (video_id, kind, t_seconds, confidence, source, is_ignored)
            VALUES (%s, %s, %s, %s, 'auto', false)
            """,
            [(video_id, m["kind"], m["t_seconds"], m.get("confidence")) for m in markers],
        )
    conn.commit()


def set_video_meta(conn: psycopg.Connection, video_id: str, audio_path: str, peaks_path: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE videos SET audio_path = %s, peaks_path = %s, status = 'analyzed', updated_at = now() WHERE id = %s",
            (audio_path, peaks_path, video_id),
        )
    conn.commit()


def finish_job(conn: psycopg.Connection, job_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE analysis_jobs SET status = 'done', finished_at = now() WHERE id = %s",
            (job_id,),
        )
    conn.commit()


def fail_job(conn: psycopg.Connection, job_id: str, video_id: str, error: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE analysis_jobs SET status = 'error', error = %s, finished_at = now() WHERE id = %s",
            (error[:2000], job_id),
        )
        cur.execute("UPDATE videos SET status = 'error', updated_at = now() WHERE id = %s", (video_id,))
    conn.commit()
