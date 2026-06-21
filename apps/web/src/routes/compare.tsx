import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { StageResults } from "shared/results";
import { ComparePane } from "#/components/compare-pane";
import { useVideoTime } from "#/hooks/use-video-time";
import { fmtTime } from "#/lib/format";
import { useVideos } from "#/lib/queries";

interface CompareSearch {
  a?: string;
  b?: string;
}

export const Route = createFileRoute("/compare")({
  component: ComparePage,
  validateSearch: (search: Record<string, unknown>): CompareSearch => ({
    a: typeof search.a === "string" ? search.a : undefined,
    b: typeof search.b === "string" ? search.b : undefined,
  }),
});

const DRIFT = 0.08; // seconds of allowed drift before correcting the partner video

function ComparePage() {
  const { a, b } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const videos = useVideos();

  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const timeA = useVideoTime(refA);
  const timeB = useVideoTime(refB);

  const [synced, setSynced] = useState(true);
  const [resultsA, setResultsA] = useState<StageResults | null>(null);
  const [resultsB, setResultsB] = useState<StageResults | null>(null);

  const anchorA = resultsA?.anchorT ?? 0;
  const anchorB = resultsB?.anchorT ?? 0;

  const setA = (id: string | undefined) => navigate({ search: (s) => ({ ...s, a: id || undefined }) });
  const setB = (id: string | undefined) => navigate({ search: (s) => ({ ...s, b: id || undefined }) });

  // Synced, anchor-aligned playback. Each handler is self-limiting (state/epsilon checks)
  // so mirroring one video onto the other cannot feed back into an infinite loop.
  useEffect(() => {
    const va = refA.current;
    const vb = refB.current;
    if (!synced || !va || !vb) return;

    const alignedFor = (from: HTMLVideoElement, fromAnchor: number, toAnchor: number) =>
      Math.max(0, from.currentTime - fromAnchor + toAnchor);

    const mirror = (from: HTMLVideoElement, to: HTMLVideoElement, fromAnchor: number, toAnchor: number) => ({
      play: () => {
        if (to.paused) void to.play();
        const target = alignedFor(from, fromAnchor, toAnchor);
        if (Math.abs(to.currentTime - target) > DRIFT) to.currentTime = target;
      },
      pause: () => {
        if (!to.paused) to.pause();
      },
      seek: () => {
        const target = alignedFor(from, fromAnchor, toAnchor);
        if (Math.abs(to.currentTime - target) > DRIFT) to.currentTime = target;
      },
    });

    const ab = mirror(va, vb, anchorA, anchorB);
    const ba = mirror(vb, va, anchorB, anchorA);

    va.addEventListener("play", ab.play);
    va.addEventListener("pause", ab.pause);
    va.addEventListener("seeked", ab.seek);
    vb.addEventListener("play", ba.play);
    vb.addEventListener("pause", ba.pause);
    vb.addEventListener("seeked", ba.seek);

    // Correct drift while both play (the seeked event doesn't fire during normal playback).
    const drift = window.setInterval(() => {
      if (va.paused || vb.paused) return;
      const target = alignedFor(va, anchorA, anchorB);
      if (Math.abs(vb.currentTime - target) > DRIFT) vb.currentTime = target;
    }, 400);

    // Lock B onto A immediately when sync is enabled.
    vb.currentTime = alignedFor(va, anchorA, anchorB);

    return () => {
      window.clearInterval(drift);
      va.removeEventListener("play", ab.play);
      va.removeEventListener("pause", ab.pause);
      va.removeEventListener("seeked", ab.seek);
      vb.removeEventListener("play", ba.play);
      vb.removeEventListener("pause", ba.pause);
      vb.removeEventListener("seeked", ba.seek);
    };
  }, [synced, anchorA, anchorB]);

  return (
    <main className="page-wrap px-4 pb-8 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Library
        </Link>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={synced} onChange={(e) => setSynced(e.target.checked)} />
          Sync playback (anchor-aligned)
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <VideoPicker label="A" value={a} options={videos.data ?? []} onChange={setA} exclude={b} />
          <div className="mt-2">
            <ComparePane videoId={a ?? null} videoRef={refA} currentTime={timeA.time} onResults={setResultsA} />
          </div>
        </div>
        <div>
          <VideoPicker label="B" value={b} options={videos.data ?? []} onChange={setB} exclude={a} />
          <div className="mt-2">
            <ComparePane videoId={b ?? null} videoRef={refB} currentTime={timeB.time} onResults={setResultsB} />
          </div>
        </div>
      </div>

      {resultsA && resultsB && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Comparison</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CompareMetric label="First shot" a={resultsA.firstShot} b={resultsB.firstShot} lowerIsBetter />
            <CompareMetric label="Total time" a={resultsA.totalTime} b={resultsB.totalTime} lowerIsBetter />
            <CompareMetric label="Shots" a={resultsA.shotCount} b={resultsB.shotCount} format={(v) => String(v)} />
            <CompareMetric
              label="Fastest split"
              a={resultsA.fastestSplit?.value ?? null}
              b={resultsB.fastestSplit?.value ?? null}
              lowerIsBetter
              format={(v) => (v == null ? "—" : v.toFixed(2))}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function VideoPicker({
  label,
  value,
  options,
  onChange,
  exclude,
}: {
  label: string;
  value: string | undefined;
  options: { id: string; originalName: string; status: string }[];
  onChange: (id: string | undefined) => void;
  exclude: string | undefined;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        className="w-full rounded-md border bg-card px-2 py-1.5 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">Select a video…</option>
        {options
          .filter((v) => v.id !== exclude)
          .map((v) => (
            <option key={v.id} value={v.id}>
              {v.originalName}
              {v.status !== "analyzed" ? ` (${v.status})` : ""}
            </option>
          ))}
      </select>
    </label>
  );
}

function CompareMetric({
  label,
  a,
  b,
  lowerIsBetter = false,
  format = fmtTime,
}: {
  label: string;
  a: number | null;
  b: number | null;
  lowerIsBetter?: boolean;
  format?: (v: number | null) => string;
}) {
  let aWins = false;
  let bWins = false;
  if (a != null && b != null && a !== b) {
    const aBetter = lowerIsBetter ? a < b : a > b;
    aWins = aBetter;
    bWins = !aBetter;
  }
  const win = "text-emerald-600 dark:text-emerald-400 font-semibold";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline justify-between text-lg tabular-nums">
        <span className={aWins ? win : ""}>{format(a)}</span>
        <span className="text-xs text-muted-foreground">vs</span>
        <span className={bWins ? win : ""}>{format(b)}</span>
      </div>
    </div>
  );
}
