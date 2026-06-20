"""End-to-end worker test against a real Postgres.

Skipped unless DATABASE_URL points at a reachable database. Verifies schema bootstrap,
atomic job claiming (FOR UPDATE SKIP LOCKED), the full pipeline, and marker persistence.
"""

from __future__ import annotations

import subprocess
import uuid
from pathlib import Path

import pytest
import soundfile as sf

from src import config, db
from src.worker import run_once
from tests.synth import synth_signal

# Mirrors apps/api/src/db/migrate.ts — keep in sync.
SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), original_name text NOT NULL,
  storage_path text NOT NULL, audio_path text, peaks_path text,
  duration_s double precision, fps double precision, width integer, height integer,
  sample_rate integer, status text NOT NULL DEFAULT 'uploaded',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued', approach text NOT NULL DEFAULT 'spectral',
  params jsonb NOT NULL, error text, attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz, started_at timestamptz, finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  kind text NOT NULL, t_seconds double precision NOT NULL, confidence real,
  source text NOT NULL, is_ignored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
"""


def _db_available() -> bool:
    try:
        with db.connect() as c:
            c.execute("SELECT 1")
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_available(), reason="no DATABASE_URL / database")


@pytest.fixture
def conn():
    c = db.connect()
    c.execute(SCHEMA_SQL)
    c.commit()
    yield c
    c.close()


def _make_video(tmp: Path, video_id: str) -> str:
    x, sr = synth_signal()
    wav = tmp / "a.wav"
    sf.write(wav, x, sr)
    dest = Path(config.MEDIA_DIR) / "videos" / video_id
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:r=5",
         "-i", str(wav), "-t", "5", "-shortest", "-c:v", "libx264",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-f", "mp4", str(dest)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return str(dest)


def test_full_job_lifecycle(conn, tmp_path):
    video_id = str(uuid.uuid4())
    storage = _make_video(tmp_path, video_id)

    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO videos (id, original_name, storage_path, status) VALUES (%s, %s, %s, 'analyzing')",
            (video_id, "clip.mp4", storage),
        )
        cur.execute(
            "INSERT INTO analysis_jobs (video_id, status, approach, params) "
            "VALUES (%s, 'queued', 'spectral', '{}'::jsonb) RETURNING id",
            (video_id,),
        )
        job_id = cur.fetchone()[0]
    conn.commit()

    assert run_once(conn) is True

    with conn.cursor() as cur:
        cur.execute("SELECT status FROM analysis_jobs WHERE id = %s", (job_id,))
        assert cur.fetchone()[0] == "done"
        cur.execute("SELECT status, peaks_path FROM videos WHERE id = %s", (video_id,))
        vstatus, peaks_path = cur.fetchone()
        assert vstatus == "analyzed"
        assert peaks_path and Path(peaks_path).exists()
        cur.execute("SELECT kind, count(*) FROM markers WHERE video_id = %s GROUP BY kind", (video_id,))
        counts = dict(cur.fetchall())

    assert counts.get("beep") == 1
    assert counts.get("shot", 0) >= 4
    conn.commit()


def test_skip_locked_no_double_claim(conn):
    # Two queued jobs, two connections — each must claim a distinct job.
    with conn.cursor() as cur:
        cur.execute("INSERT INTO videos (original_name, storage_path) VALUES ('a','/x') RETURNING id")
        vid = cur.fetchone()[0]
        for _ in range(2):
            cur.execute("INSERT INTO analysis_jobs (video_id, status, params) VALUES (%s,'queued','{}'::jsonb)", (vid,))
    conn.commit()

    c1, c2 = db.connect(), db.connect()
    try:
        j1 = db.claim_next_job(c1)
        j2 = db.claim_next_job(c2)
        assert j1 is not None and j2 is not None
        assert j1.id != j2.id
    finally:
        c1.close()
        c2.close()
