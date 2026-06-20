"""Analyzer worker entrypoint: poll the job queue and process claimed jobs.

Run with `python -m src.worker` (the Docker image does this). A single-worker poll loop is
plenty for a home server; FOR UPDATE SKIP LOCKED already makes it safe to scale out later.
"""

from __future__ import annotations

import time

from . import config, db
from .pipeline import process_job


def log(msg: str) -> None:
    print(f"[analyzer] {msg}", flush=True)


def run_once(conn) -> bool:
    """Claim and process one job. Returns True if a job was handled."""
    job = db.claim_next_job(conn)
    if job is None:
        return False

    log(f"processing job {job.id} (video {job.video_id})")
    try:
        process_job(conn, job)
        log(f"job {job.id} done")
    except Exception as exc:  # noqa: BLE001 — surface any failure to the job row
        conn.rollback()
        log(f"job {job.id} failed: {exc}")
        db.fail_job(conn, job.id, job.video_id, str(exc))
    return True


def main() -> None:
    log(f"starting; polling every {config.POLL_INTERVAL_S}s")
    conn = db.connect()
    try:
        while True:
            try:
                handled = run_once(conn)
            except Exception as exc:  # noqa: BLE001 — keep the loop alive on transient DB errors
                log(f"loop error: {exc}")
                conn.rollback()
                handled = False
            if not handled:
                time.sleep(config.POLL_INTERVAL_S)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
