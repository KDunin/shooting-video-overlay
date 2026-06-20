"""Audio extraction and waveform-peak generation via ffmpeg."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

from .params import ANALYSIS_SR


def extract_audio(video_path: str, wav_path: str, sr: int = ANALYSIS_SR) -> None:
    """Decode the video's audio to a mono PCM WAV at the analysis sample rate."""
    Path(wav_path).parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", video_path,
            "-vn", "-ac", "1", "-ar", str(sr), "-f", "wav", wav_path,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def load_wav(wav_path: str) -> tuple[int, np.ndarray]:
    """Load a WAV as float32 mono in [-1, 1]."""
    data, sr = sf.read(wav_path, dtype="float32", always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    return sr, data


def compute_peaks(samples: np.ndarray, sr: int, points_per_second: int = 100) -> dict:
    """Downsample to a max-amplitude-per-bucket envelope for the timeline waveform."""
    if samples.size == 0:
        return {"pointsPerSecond": points_per_second, "durationS": 0.0, "peaks": []}

    bucket = max(1, sr // points_per_second)
    n_buckets = int(np.ceil(samples.size / bucket))
    padded = np.zeros(n_buckets * bucket, dtype=np.float32)
    padded[: samples.size] = np.abs(samples)
    peaks = padded.reshape(n_buckets, bucket).max(axis=1)

    peak_max = float(peaks.max()) or 1.0
    peaks = peaks / peak_max  # normalise to 0..1

    return {
        "pointsPerSecond": points_per_second,
        "durationS": float(samples.size / sr),
        "peaks": [round(float(p), 4) for p in peaks],
    }


def write_peaks(peaks: dict, peaks_path: str) -> None:
    Path(peaks_path).parent.mkdir(parents=True, exist_ok=True)
    Path(peaks_path).write_text(json.dumps(peaks))
