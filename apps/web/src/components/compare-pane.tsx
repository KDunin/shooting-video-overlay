import { useEffect, useMemo } from "react";
import { computeResults } from "shared/results";
import type { StageResults } from "shared/results";
import { VideoOverlay } from "#/components/video-overlay";
import { VideoPlayer } from "#/components/video-player";
import { WaveformTimeline } from "#/components/waveform-timeline";
import { fmtTime } from "#/lib/format";
import { useMarkers, usePeaks, useVideo } from "#/lib/queries";
import { mediaUrls } from "#/lib/videos-api";

interface VideoProps {
  videoId: string | null;
  videoRef: React.Ref<HTMLVideoElement>;
  currentTime: number;
  onResults?: (r: StageResults | null) => void;
}

interface TimelineProps {
  videoId: string | null;
  videoRef: React.Ref<HTMLVideoElement>;
  currentTime: number;
  height: number;
  onSeek: (t: number) => void;
}

export function ComparePaneVideo({ videoId, videoRef, currentTime, onResults }: VideoProps) {
  if (!videoId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Pick a video to compare
      </div>
    );
  }
  return <VideoContent videoId={videoId} videoRef={videoRef} currentTime={currentTime} onResults={onResults} />;
}

export function ComparePaneTimeline({ videoId, videoRef, currentTime, height, onSeek }: TimelineProps) {
  if (!videoId) return null;
  return <TimelineContent videoId={videoId} videoRef={videoRef} currentTime={currentTime} height={height} onSeek={onSeek} />;
}

function VideoContent({ videoId, videoRef, currentTime, onResults }: VideoProps & { videoId: string }) {
  const video = useVideo(videoId);
  const markersQ = useMarkers(videoId);
  const markers = markersQ.data ?? [];
  const results = useMemo(() => computeResults(markers), [markers]);
  const status = video.data?.status;
  const analyzed = status === "analyzed";

  useEffect(() => {
    onResults?.(analyzed ? results : null);
  }, [analyzed, results, onResults]);

  return (
    <div className="flex h-full flex-col">
      <VideoPlayer
        ref={videoRef}
        src={mediaUrls.stream(videoId)}
        variant="fill"
        overlay={analyzed ? <VideoOverlay results={results} currentTime={currentTime} showHistory={false} /> : undefined}
      />
      {!analyzed && (
        <div className="mt-2 shrink-0 rounded-md border border-blue-500/40 bg-blue-500/5 p-2 text-sm">
          {status === "error"
            ? "Analysis failed for this video."
            : "This video is still being analyzed — open it in the editor to run detection."}
        </div>
      )}
    </div>
  );
}

function TimelineContent({ videoId, videoRef: _, currentTime, height, onSeek }: TimelineProps & { videoId: string }) {
  const video = useVideo(videoId);
  const markersQ = useMarkers(videoId);
  const peaksQ = usePeaks(videoId, video.data?.hasPeaks);
  const markers = markersQ.data ?? [];
  const results = useMemo(() => computeResults(markers), [markers]);
  const analyzed = video.data?.status === "analyzed";

  if (!analyzed) return null;

  return (
    <div className="flex h-full flex-col">
      <WaveformTimeline
        peaks={peaksQ.data ?? null}
        duration={video.data?.durationS || 0}
        markers={markers}
        selectedId={null}
        currentTime={currentTime}
        onSelect={() => {}}
        onSeek={onSeek}
        onNudge={() => {}}
        onAdd={() => {}}
        height={height}
      />
      <div className="mt-2 grid shrink-0 grid-cols-4 gap-2 text-center text-sm tabular-nums">
        <Stat label="First" value={fmtTime(results.firstShot)} />
        <Stat label="Total" value={fmtTime(results.totalTime)} accent />
        <Stat label="Shots" value={String(results.shotCount)} />
        <Stat label="Fastest" value={results.fastestSplit ? results.fastestSplit.value.toFixed(2) : "—"} />
      </div>
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
