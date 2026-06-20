"""Process a single analysis job: extract audio, build peaks, detect beep + shots."""

from __future__ import annotations

from . import config, db
from .detect import detect_beep, detect_shots, suppress_near
from .extract import compute_peaks, extract_audio, load_wav, write_peaks
from .params import DetectionParams

# Shots within this window of the beep are treated as the beep itself, not gunshots.
BEEP_GUARD_S = 0.25


def build_markers(samples, sr, params: DetectionParams) -> list[dict]:
    beep_t = detect_beep(samples, sr, params)
    shots = suppress_near(detect_shots(samples, sr, params), beep_t, guard_s=BEEP_GUARD_S)

    markers: list[dict] = []
    if beep_t is not None:
        markers.append({"kind": "beep", "t_seconds": beep_t, "confidence": 0.95})
    for d in shots:
        markers.append({"kind": "shot", "t_seconds": d.t_seconds, "confidence": d.confidence})
    return markers


def process_job(conn, job: db.ClaimedJob) -> None:
    params = DetectionParams.from_json(job.params)

    wav_path = config.audio_path(job.video_id)
    peaks_path = config.peaks_path(job.video_id)

    extract_audio(job.storage_path, wav_path)
    sr, samples = load_wav(wav_path)

    write_peaks(compute_peaks(samples, sr), peaks_path)

    markers = build_markers(samples, sr, params)
    db.insert_markers(conn, job.video_id, markers)
    db.set_video_meta(conn, job.video_id, wav_path, peaks_path)
    db.finish_job(conn, job.id)
