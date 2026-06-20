"""Synthetic range-audio generator for detector tests.

Produces a mono signal with a tonal timer beep and several broadband gunshot transients,
including a deliberately fast split, plus low-level background noise.
"""

from __future__ import annotations

import numpy as np

from src.params import ANALYSIS_SR

BEEP_T = 0.5
SHOT_TS = [1.5, 1.8, 2.1, 3.0, 3.15]  # last two are a 150 ms split


def synth_signal(sr: int = ANALYSIS_SR, duration: float = 5.0) -> tuple[np.ndarray, int]:
    n = int(duration * sr)
    t = np.arange(n) / sr
    x = np.zeros(n, dtype=np.float32)
    rng = np.random.default_rng(42)

    # Background noise floor.
    x += (0.002 * rng.standard_normal(n)).astype(np.float32)

    # Timer beep: 3 kHz tone for 250 ms.
    beep_mask = (t >= BEEP_T) & (t < BEEP_T + 0.25)
    x[beep_mask] += (0.5 * np.sin(2 * np.pi * 3000 * t[beep_mask])).astype(np.float32)

    # Gunshots: broadband bursts with a fast exponential decay.
    for st in SHOT_TS:
        s = int(st * sr)
        length = int(0.05 * sr)
        env = np.exp(-np.arange(length) / (0.008 * sr))
        burst = (rng.standard_normal(length) * env).astype(np.float32)
        x[s : s + length] += (0.8 * burst).astype(np.float32)

    return np.clip(x, -1.0, 1.0), sr
