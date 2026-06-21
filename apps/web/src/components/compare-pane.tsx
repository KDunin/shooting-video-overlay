import { useEffect, useMemo } from "react";
import { computeResults } from "shared/results";
import type { StageResults } from "shared/results";
import { VideoOverlay } from "#/components/video-overlay";
import { WaveformTimeline } from "#/components/waveform-timeline";
import { fmtTime } from "#/lib/format";
import { useMarkers, usePeaks, useVideo } from "#/lib/queries";
import { mediaUrls } from "#/lib/videos-api";

interface Props {
  videoId: string | null;
  /** Owned by the parent so it can drive synced playback. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Current playhead time for this video (from the parent's useVideoTime). */
  currentTime: number;
  /** Bubble up computed results so the parent can compare/anchor-sync. */
  onResults?: (r: StageResults | null) => void;
}

/**
 * Read-only single-video view for the comparison page: player + HUD overlay, waveform
 * timeline (no editing) and a compact stats block. Mirrors the layout of the single-video
 * editor but stripped of all mutation affordances.
 */
export function ComparePane({ videoId, videoRef, currentTime, onResults }: Props) {
  if (!videoId) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Pick a video to compare
      </div>
    );
  }
  return <PaneContent videoId={videoId} videoRef={videoRef} currentTime={currentTime} onResults={onResults} />;
}

function PaneContent({ videoId, videoRef, currentTime, onResults }: Props & { videoId: string }) {
  const video = useVideo(videoId);
  const markersQ = useMarkers(videoId);
  const peaksQ = usePeaks(videoId, video.data?.hasPeaks);

  const markers = markersQ.data ?? [];
  const results = useMemo(() => computeResults(markers), [markers]);
  const status = video.data?.status;
  const analyzed = status === "analyzed";

  useEffect(() => {
    onResults?.(analyzed ? results : null);
  }, [analyzed, results, onResults]);

  return (
    <div>
      <div className="relative max-h-[60vh] overflow-hidden rounded-lg bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} src={mediaUrls.stream(videoId)} controls className="w-full" />
        {analyzed && <VideoOverlay results={results} currentTime={currentTime} showHistory={false} />}
      </div>

      {!analyzed && (
        <div className="mt-3 rounded-md border border-blue-500/40 bg-blue-500/5 p-3 text-sm">
          {status === "error"
            ? "Analysis failed for this video."
            : "This video is still being analyzed — open it in the editor to run detection."}
        </div>
      )}

      {analyzed && (
        <>
          <div className="mt-3">
            <WaveformTimeline
              peaks={peaksQ.data ?? null}
              duration={video.data?.durationS || 0}
              markers={markers}
              selectedId={null}
              currentTime={currentTime}
              onSelect={() => {}}
              onSeek={(t) => {
                if (videoRef.current) videoRef.current.currentTime = Math.max(0, t);
              }}
              onNudge={() => {}}
              onAdd={() => {}}
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm tabular-nums">
            <Stat label="First" value={fmtTime(results.firstShot)} />
            <Stat label="Total" value={fmtTime(results.totalTime)} accent />
            <Stat label="Shots" value={String(results.shotCount)} />
            <Stat label="Fastest" value={results.fastestSplit ? results.fastestSplit.value.toFixed(2) : "—"} />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border bg-card py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</div>
    </div>
  );
}
