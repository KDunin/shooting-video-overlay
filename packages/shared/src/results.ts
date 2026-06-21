import type { Marker } from "./markers";

export type AnchorSource = "beep" | "first-shot" | "manual" | "none";

export interface ShotResult {
  id: string;
  /** 1-based position among counted (non-ignored) shots. */
  index: number;
  /** Absolute time within the track, seconds. */
  tSeconds: number;
  /** Time relative to the anchor (t=0), seconds. */
  tRelative: number;
  /** Split from the previous counted shot; null for the first counted shot. */
  split: number | null;
  confidence: number | null;
}

export interface StageResults {
  anchorT: number | null;
  anchorSource: AnchorSource;
  /** Counted shots (non-ignored), ordered by time. */
  shots: ShotResult[];
  shotCount: number;
  /** tRelative of the first counted shot (a.k.a. draw-to-first-shot when anchored on the beep). */
  firstShot: number | null;
  /** tRelative of the last counted shot — the stage time. */
  totalTime: number | null;
  fastestSplit: { index: number; value: number } | null;
  slowestSplit: { index: number; value: number } | null;
}

export interface ComputeOptions {
  /** Explicit anchor time, seconds — wins over any detected beep. */
  anchorOverride?: number | null;
  /** When no beep is present, anchor on the first counted shot. Default true. */
  fallbackToFirstShot?: boolean;
}

const byTime = (a: { tSeconds: number }, b: { tSeconds: number }) => a.tSeconds - b.tSeconds;

/**
 * Pure derivation of stage timing from raw markers. Single source of truth for both the
 * browser editor (instant recompute on every edit) and the API `/results` endpoint.
 *
 * Anchor (t=0) resolution order: explicit override → earliest non-ignored beep →
 * earliest non-ignored shot (fallback) → none.
 */
export function computeResults(markers: Marker[], options: ComputeOptions = {}): StageResults {
  const { anchorOverride = null, fallbackToFirstShot = true } = options;

  let anchorT: number | null = null;
  let anchorSource: AnchorSource = "none";

  if (anchorOverride != null) {
    anchorT = anchorOverride;
    anchorSource = "manual";
  } else {
    const beep = markers
      .filter((m) => m.kind === "beep" && !m.isIgnored)
      .slice()
      .sort(byTime)[0];
    if (beep) {
      anchorT = beep.tSeconds;
      anchorSource = "beep";
    }
  }

  // When an anchor is known (beep or manual), shots before it are pre-timer and excluded.
  const shotsAbs = markers
    .filter((m) => m.kind === "shot" && !m.isIgnored && (anchorT == null || m.tSeconds >= anchorT))
    .slice()
    .sort(byTime);

  if (anchorT == null && fallbackToFirstShot && shotsAbs[0]) {
    anchorT = shotsAbs[0].tSeconds;
    anchorSource = "first-shot";
  }

  const base = anchorT ?? 0;
  const shots: ShotResult[] = shotsAbs.map((m, i) => {
    const tRelative = m.tSeconds - base;
    const prev = shotsAbs[i - 1];
    return {
      id: m.id,
      index: i + 1,
      tSeconds: m.tSeconds,
      tRelative,
      split: prev ? m.tSeconds - prev.tSeconds : null,
      confidence: m.confidence,
    };
  });

  let fastestSplit: StageResults["fastestSplit"] = null;
  let slowestSplit: StageResults["slowestSplit"] = null;
  for (const s of shots) {
    if (s.split == null) continue;
    if (!fastestSplit || s.split < fastestSplit.value) fastestSplit = { index: s.index, value: s.split };
    if (!slowestSplit || s.split > slowestSplit.value) slowestSplit = { index: s.index, value: s.split };
  }

  const first = shots[0];
  const last = shots[shots.length - 1];

  return {
    anchorT,
    anchorSource,
    shots,
    shotCount: shots.length,
    firstShot: first ? first.tRelative : null,
    totalTime: last ? last.tRelative : null,
    fastestSplit,
    slowestSplit,
  };
}
