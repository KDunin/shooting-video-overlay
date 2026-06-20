import { z } from "zod";

/**
 * Detection approaches, in increasing order of robustness.
 * MVP ships `spectral` (with `peak` as a fast fallback). `hybrid` is the roadmap path.
 * See plan §8 for the trade-offs.
 */
export const DetectionApproach = z.enum(["peak", "spectral", "hybrid"]);
export type DetectionApproach = z.infer<typeof DetectionApproach>;

/**
 * Tunable knobs for the analyzer, persisted on each analysis job so a run is
 * reproducible and re-runnable at a different sensitivity.
 */
export const DetectionParams = z.object({
  approach: DetectionApproach.default("spectral"),
  /** 0..1 — higher means more sensitive (more candidate shots, higher recall). */
  sensitivity: z.number().min(0).max(1).default(0.5),
  /** Minimum time between two shots; suppresses double-triggers and echo. */
  refractoryMs: z.number().int().min(20).max(1000).default(90),
  /** Narrow band the shot-timer beep tone lives in (Hz). Typical CED/PACT ~2-4 kHz. */
  beepFreqMinHz: z.number().int().min(200).max(8000).default(1800),
  beepFreqMaxHz: z.number().int().min(200).max(12000).default(4200),
  /** Minimum sustained duration for a tone to count as the beep. */
  beepMinMs: z.number().int().min(50).max(2000).default(180),
});
export type DetectionParams = z.infer<typeof DetectionParams>;

export const defaultDetectionParams = (): DetectionParams => DetectionParams.parse({});
