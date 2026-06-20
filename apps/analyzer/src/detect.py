"""Audio event detection: timer beep + gunshots.

Two shot detectors are provided (plan §8):
  * peak      — envelope threshold on a high-passed signal. Fast, simple, weaker in echo.
  * spectral  — spectral-flux onset detection. More robust, separates the tonal beep from
                broadband shots, emits a usable confidence. This is the MVP default.

All detectors optimise for recall: a false positive the user deletes is cheaper than a miss.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.signal import butter, find_peaks, sosfiltfilt, stft

from .params import DetectionParams


@dataclass
class Detection:
    t_seconds: float
    confidence: float  # 0..1


def _moving_rms(x: np.ndarray, win: int) -> np.ndarray:
    win = max(1, win)
    kernel = np.ones(win, dtype=np.float64) / win
    return np.sqrt(np.convolve(x.astype(np.float64) ** 2, kernel, mode="same"))


def detect_beep(x: np.ndarray, sr: int, p: DetectionParams) -> float | None:
    """Return the onset time (s) of the first sustained tone in the beep band, or None."""
    if x.size == 0:
        return None

    lo = max(50, min(p.beep_freq_min_hz, sr // 2 - 200))
    hi = max(lo + 100, min(p.beep_freq_max_hz, sr // 2 - 50))
    sos = butter(4, [lo, hi], btype="band", fs=sr, output="sos")
    band = sosfiltfilt(sos, x)

    env = _moving_rms(band, int(sr * 0.01))
    peak = float(env.max())
    if peak <= 1e-6:
        return None

    # Prominence gate: a real beep is a tone that stands well above the in-band background.
    # Broadband noise has a fairly flat band-envelope (peak close to its median), so this
    # rejects "sustained" runs that are just noise rather than a tone.
    median = float(np.median(env))
    if peak < 5.0 * max(median, 1e-9):
        return None

    above = env > max(0.30 * peak, 3.0 * median)
    min_len = int(sr * p.beep_min_ms / 1000)

    # Find the first run of `above` at least `min_len` samples long.
    idx = 0
    n = above.size
    while idx < n:
        if above[idx]:
            start = idx
            while idx < n and above[idx]:
                idx += 1
            if idx - start >= min_len:
                return float(start / sr)
        else:
            idx += 1
    return None


def _height_from_sensitivity(p: DetectionParams, base: float, span: float) -> float:
    """Map sensitivity 0..1 to a detection threshold (higher sensitivity -> lower threshold)."""
    return base + (1.0 - p.sensitivity) * span


def detect_shots_peak(x: np.ndarray, sr: int, p: DetectionParams) -> list[Detection]:
    if x.size == 0:
        return []
    sos = butter(4, 500, btype="high", fs=sr, output="sos")
    hp = sosfiltfilt(sos, x)
    env = _moving_rms(np.abs(hp), int(sr * 0.003))
    env = env / (env.max() + 1e-9)

    distance = max(1, int(p.refractory_ms / 1000 * sr))
    height = _height_from_sensitivity(p, base=0.18, span=0.45)
    peaks, _ = find_peaks(env, height=height, distance=distance)
    return [Detection(float(i / sr), float(env[i])) for i in peaks]


def detect_shots_spectral(x: np.ndarray, sr: int, p: DetectionParams) -> list[Detection]:
    if x.size < 1024:
        return []
    nperseg = 512
    hop = 128
    freqs, times, Z = stft(x, fs=sr, nperseg=nperseg, noverlap=nperseg - hop, boundary=None)
    mag = np.abs(Z)

    # Spectral flux: sum of positive frame-to-frame magnitude increases. Broadband
    # transients (gunshots) produce sharp flux spikes.
    diff = np.diff(mag, axis=1)
    flux = np.clip(diff, 0.0, None).sum(axis=0)
    flux = np.concatenate([[0.0], flux])  # realign to `times`
    flux = flux / (flux.max() + 1e-9)

    hop_t = float(times[1] - times[0]) if times.size > 1 else hop / sr
    distance = max(1, int(p.refractory_ms / 1000 / hop_t))
    height = _height_from_sensitivity(p, base=0.12, span=0.38)
    peaks, _ = find_peaks(flux, height=height, distance=distance)
    return [Detection(float(times[i]), float(flux[i])) for i in peaks]


def detect_shots(x: np.ndarray, sr: int, p: DetectionParams) -> list[Detection]:
    if p.approach == "peak":
        return detect_shots_peak(x, sr, p)
    # "spectral" (default) and "hybrid" both currently use the spectral detector.
    return detect_shots_spectral(x, sr, p)


def suppress_near(detections: list[Detection], t: float | None, guard_s: float) -> list[Detection]:
    """Drop detections within `guard_s` of `t` (used to exclude the beep from shot results)."""
    if t is None:
        return detections
    return [d for d in detections if abs(d.t_seconds - t) > guard_s]
