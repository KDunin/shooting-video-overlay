"""Detector unit tests against synthetic range audio."""

from __future__ import annotations

import numpy as np

from src.detect import detect_beep, detect_shots, suppress_near
from src.params import DetectionParams
from tests.synth import BEEP_T, SHOT_TS, synth_signal


def _match(detected: list[float], truth: list[float], tol: float) -> bool:
    """Every true event has a detection within tol, and counts are equal."""
    if len(detected) != len(truth):
        return False
    used = [False] * len(detected)
    for tt in truth:
        hit = next((i for i, d in enumerate(detected) if not used[i] and abs(d - tt) <= tol), None)
        if hit is None:
            return False
        used[hit] = True
    return True


def test_detect_beep_finds_onset():
    x, sr = synth_signal()
    t = detect_beep(x, sr, DetectionParams())
    assert t is not None
    assert abs(t - BEEP_T) < 0.05


def test_detect_beep_returns_none_without_tone():
    sr = 16000
    x = (0.002 * np.random.default_rng(1).standard_normal(sr * 3)).astype(np.float32)
    assert detect_beep(x, sr, DetectionParams()) is None


def test_spectral_detects_all_shots():
    x, sr = synth_signal()
    beep_t = detect_beep(x, sr, DetectionParams())
    shots = detect_shots(x, sr, DetectionParams(approach="spectral"))
    times = sorted(d.t_seconds for d in suppress_near(shots, beep_t, guard_s=0.3))
    assert _match(times, SHOT_TS, tol=0.03), times


def test_peak_detector_detects_all_shots():
    x, sr = synth_signal()
    beep_t = detect_beep(x, sr, DetectionParams())
    shots = detect_shots(x, sr, DetectionParams(approach="peak"))
    times = sorted(d.t_seconds for d in suppress_near(shots, beep_t, guard_s=0.3))
    assert _match(times, SHOT_TS, tol=0.03), times


def test_confidence_in_range():
    x, sr = synth_signal()
    for d in detect_shots(x, sr, DetectionParams()):
        assert 0.0 <= d.confidence <= 1.0


def test_refractory_resolves_fast_split():
    # The 3.0 / 3.15 pair (150 ms) must remain two distinct detections.
    x, sr = synth_signal()
    shots = detect_shots(x, sr, DetectionParams())
    near = [d.t_seconds for d in shots if 2.9 <= d.t_seconds <= 3.3]
    assert len(near) == 2, near
