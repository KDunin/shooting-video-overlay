"""Detection parameters — mirrors packages/shared/src/detection.ts.

Kept in plain Python (no pydantic) so the worker has a tiny dependency surface.
"""

from __future__ import annotations

from dataclasses import dataclass

# Internal sample rate for analysis. Nyquist (8 kHz) comfortably covers the beep tone
# (~2-4 kHz) and the energy of gunshot transients, while keeping DSP fast.
ANALYSIS_SR = 16000


@dataclass(frozen=True)
class DetectionParams:
    approach: str = "spectral"          # "peak" | "spectral" | "hybrid"
    sensitivity: float = 0.5            # 0..1, higher -> more candidate shots (recall)
    refractory_ms: int = 90             # min spacing between shots
    beep_freq_min_hz: int = 1800
    beep_freq_max_hz: int = 4200
    beep_min_ms: int = 180

    @classmethod
    def from_json(cls, data: dict | None) -> "DetectionParams":
        data = data or {}
        return cls(
            approach=data.get("approach", "spectral"),
            sensitivity=float(data.get("sensitivity", 0.5)),
            refractory_ms=int(data.get("refractoryMs", 90)),
            beep_freq_min_hz=int(data.get("beepFreqMinHz", 1800)),
            beep_freq_max_hz=int(data.get("beepFreqMaxHz", 4200)),
            beep_min_ms=int(data.get("beepMinMs", 180)),
        )
