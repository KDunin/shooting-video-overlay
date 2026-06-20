"""Analyzer runtime configuration (env-driven, mirrors the API)."""

from __future__ import annotations

import os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/guns")
MEDIA_DIR = os.environ.get("MEDIA_DIR", "./.media")
POLL_INTERVAL_S = float(os.environ.get("ANALYZER_POLL_INTERVAL_S", "1.0"))
MAX_ATTEMPTS = int(os.environ.get("ANALYZER_MAX_ATTEMPTS", "3"))


def audio_path(video_id: str) -> str:
    return f"{MEDIA_DIR}/audio/{video_id}.wav"


def peaks_path(video_id: str) -> str:
    return f"{MEDIA_DIR}/peaks/{video_id}.json"
