"""End-to-end extraction test: synth audio -> real MP4 -> ffmpeg extract -> detect."""

from __future__ import annotations

import subprocess
from pathlib import Path

import soundfile as sf

from src.detect import detect_beep, detect_shots, suppress_near
from src.extract import compute_peaks, extract_audio, load_wav
from src.params import DetectionParams
from tests.synth import BEEP_T, SHOT_TS, synth_signal


def _make_mp4(tmp: Path) -> str:
    x, sr = synth_signal()
    wav = tmp / "in.wav"
    sf.write(wav, x, sr)
    mp4 = tmp / "clip.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=black:s=320x240:r=5",
            "-i", str(wav),
            "-t", "5", "-shortest",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            str(mp4),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return str(mp4)


def test_extract_and_detect_roundtrip(tmp_path):
    mp4 = _make_mp4(tmp_path)
    wav_out = str(tmp_path / "out.wav")

    extract_audio(mp4, wav_out)
    sr, samples = load_wav(wav_out)

    assert sr == 16000
    assert samples.size > 0

    peaks = compute_peaks(samples, sr)
    assert peaks["pointsPerSecond"] == 100
    assert abs(peaks["durationS"] - 5.0) < 0.2
    assert max(peaks["peaks"]) <= 1.0

    beep_t = detect_beep(samples, sr, DetectionParams())
    assert beep_t is not None and abs(beep_t - BEEP_T) < 0.06

    shots = detect_shots(samples, sr, DetectionParams())
    times = sorted(d.t_seconds for d in suppress_near(shots, beep_t, guard_s=0.3))
    # Lossy AAC can blur the fastest split; require we find at least the clearly separated shots.
    assert len(times) >= 4
    for tt in SHOT_TS[:3]:
        assert any(abs(d - tt) < 0.05 for d in times), (tt, times)
