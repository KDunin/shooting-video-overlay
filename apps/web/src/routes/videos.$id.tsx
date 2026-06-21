import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeResults } from "shared/results";
import { ShotList } from "#/components/shot-list";
import { SummaryCard } from "#/components/summary-card";
import { VideoOverlay } from "#/components/video-overlay";
import { WaveformTimeline } from "#/components/waveform-timeline";
import { useVideoTime } from "#/hooks/use-video-time";
import { fmtTime } from "#/lib/format";
import {
  qk,
  useAddMarker,
  useAnalyze,
  useDeleteMarker,
  useMarkers,
  useUpdateMarker,
  useVideo,
} from "#/lib/queries";
import { fetchPeaks, mediaUrls } from "#/lib/videos-api";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@kdunin/component-library";

export const Route = createFileRoute("/videos/$id")({ component: VideoPage });

function VideoPage() {
  const { id } = Route.useParams();
  const video = useVideo(id);
  const markersQ = useMarkers(id);
  const analyze = useAnalyze(id);
  const addMarker = useAddMarker(id);
  const updateMarker = useUpdateMarker(id);
  const deleteMarker = useDeleteMarker(id);

  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { time, duration } = useVideoTime(videoRef);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "review">("edit");
  const [peaks, setPeaks] = useState<Awaited<ReturnType<typeof fetchPeaks>>>(null);
  const triggered = useRef(false);

  // Measure the timeline panel height so WaveformTimeline fills it properly.
  const timelinePanelRef = useRef<HTMLDivElement>(null);
  const [timelineH, setTimelineH] = useState(120);
  useEffect(() => {
    const el = timelinePanelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      // subtract ~28px for the shortcuts line below the canvas
      setTimelineH(Math.max(60, entry.contentRect.height - 28));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const status = video.data?.status;

  // When polling detects analysis is done, refresh markers (they were empty on mount).
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (status === "analyzed" && prevStatus.current !== "analyzed") {
      qc.invalidateQueries({ queryKey: qk.markers(id) });
    }
    prevStatus.current = status;
  }, [status, id, qc]);
  const markers = markersQ.data ?? [];
  const results = useMemo(() => computeResults(markers), [markers]);

  // Kick off analysis automatically for a freshly uploaded video.
  useEffect(() => {
    if (status === "uploaded" && !triggered.current && !analyze.isPending) {
      triggered.current = true;
      analyze.mutate({});
    }
  }, [status, analyze]);

  // Load waveform peaks once analysis has produced them.
  useEffect(() => {
    if (video.data?.hasPeaks) fetchPeaks(id).then(setPeaks);
  }, [id, video.data?.hasPeaks]);

  const seek = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, t);
  };
  const selected = markers.find((m) => m.id === selectedId) ?? null;

  // Keyboard shortcuts (edit mode).
  useEffect(() => {
    if (mode !== "edit") return;
    const onKey = (e: KeyboardEvent) => {
      const el = videoRef.current;
      if (!el) return;
      const step = e.shiftKey ? 0.05 : 0.01;
      switch (e.key) {
        case " ":
          e.preventDefault();
          el.paused ? el.play() : el.pause();
          break;
        case "a":
        case "A":
          addMarker.mutate({ kind: "shot", tSeconds: el.currentTime });
          break;
        case "ArrowLeft":
          if (selected) {
            e.preventDefault();
            updateMarker.mutate({ id: selected.id, patch: { tSeconds: Math.max(0, selected.tSeconds - step) } });
          }
          break;
        case "ArrowRight":
          if (selected) {
            e.preventDefault();
            updateMarker.mutate({ id: selected.id, patch: { tSeconds: selected.tSeconds + step } });
          }
          break;
        case "Delete":
        case "Backspace":
          if (selected) {
            deleteMarker.mutate(selected.id);
            setSelectedId(null);
          }
          break;
        case "i":
        case "I":
          if (selected) updateMarker.mutate({ id: selected.id, patch: { isIgnored: !selected.isIgnored } });
          break;
        case "[":
        case "]": {
          const shots = results.shots;
          if (!shots.length) break;
          const cur = shots.findIndex((s) => s.tSeconds > el.currentTime);
          const next = e.key === "]" ? shots[cur === -1 ? shots.length - 1 : cur] : shots[Math.max(0, (cur === -1 ? shots.length : cur) - 2)];
          if (next) {
            seek(next.tSeconds);
            setSelectedId(next.id);
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, selected, results, addMarker, updateMarker, deleteMarker]);

  const analyzing = status === "uploaded" || status === "analyzing";
  const showResizable = status === "analyzed" && mode === "edit";

  return (
    <main className="page-wrap px-4 pb-8 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Library
        </Link>
        <div className="flex items-center gap-2">
          {status === "analyzed" && (
            <>
              <ModeButton active={mode === "edit"} onClick={() => setMode("edit")}>
                Correct
              </ModeButton>
              <ModeButton active={mode === "review"} onClick={() => setMode("review")}>
                Review
              </ModeButton>
            </>
          )}
          <button
            className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
            disabled={analyzing || analyze.isPending}
            onClick={() => {
              triggered.current = true;
              analyze.mutate({});
            }}
          >
            {analyzing ? "Analyzing…" : "Re-run detection"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {showResizable ? (
            <ResizablePanelGroup direction="vertical" className="h-[calc(100dvh-8rem)] min-h-0">
              <ResizablePanel defaultSize={68} minSize={20}>
                <div className="relative h-full overflow-hidden rounded-lg bg-black">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video ref={videoRef} src={mediaUrls.stream(id)} controls className="h-full w-full object-contain" />
                  <VideoOverlay results={results} currentTime={time} showHistory={false} />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={32} minSize={15}>
                <div ref={timelinePanelRef} className="flex h-full flex-col pt-2">
                  <WaveformTimeline
                    peaks={peaks}
                    duration={duration || video.data?.durationS || 0}
                    markers={markers}
                    selectedId={selectedId}
                    currentTime={time}
                    onSelect={setSelectedId}
                    onSeek={seek}
                    onNudge={(mid, t) => updateMarker.mutate({ id: mid, patch: { tSeconds: t } })}
                    onAdd={(t) => addMarker.mutate({ kind: "shot", tSeconds: t })}
                    height={timelineH}
                  />
                  <p className="mt-2 shrink-0 text-xs text-muted-foreground">
                    Shortcuts: <b>space</b> play · <b>A</b> add shot · <b>←/→</b> nudge · <b>I</b> ignore · <b>Del</b> remove · <b>[ ]</b> prev/next
                  </p>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <>
              <div className="relative max-h-[60vh] overflow-hidden rounded-lg bg-black">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} src={mediaUrls.stream(id)} controls className="w-full" />
                {status === "analyzed" && (
                  <VideoOverlay results={results} currentTime={time} showHistory={mode === "review"} />
                )}
              </div>

              {analyzing && (
                <div className="mt-3 rounded-md border border-blue-500/40 bg-blue-500/5 p-3 text-sm">
                  Analyzing audio — detecting the timer beep and shots. You can scrub the video while this runs.
                </div>
              )}
              {status === "error" && (
                <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm">
                  Analysis failed. Try re-running detection.
                </div>
              )}

              {status === "analyzed" && mode === "review" && <div className="mt-4"><SummaryCard results={results} /></div>}
            </>
          )}
        </div>

        {status === "analyzed" && (
          <aside className="rounded-lg border bg-card lg:h-[calc(100dvh-8rem)]">
            {mode === "edit" ? (
              <ShotList
                markers={markers}
                results={results}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onSeek={seek}
                onToggleIgnore={(m) => updateMarker.mutate({ id: m.id, patch: { isIgnored: !m.isIgnored } })}
                onDelete={(mid) => {
                  deleteMarker.mutate(mid);
                  if (mid === selectedId) setSelectedId(null);
                }}
              />
            ) : (
              <ReviewStats results={results} />
            )}
          </aside>
        )}
      </div>
    </main>
  );
}

function ReviewStats({ results }: { results: ReturnType<typeof computeResults> }) {
  return (
    <div className="space-y-2 p-4 text-sm tabular-nums">
      <Row label="First shot" value={fmtTime(results.firstShot)} />
      <Row label="Total time" value={fmtTime(results.totalTime)} />
      <Row label="Shots" value={String(results.shotCount)} />
      {results.fastestSplit && <Row label="Fastest split" value={results.fastestSplit.value.toFixed(2)} />}
      {results.slowestSplit && <Row label="Slowest split" value={results.slowestSplit.value.toFixed(2)} />}
      <Row label="Anchor" value={results.anchorSource} />
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between border-b py-1 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span>{value}</span>
  </div>
);

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`rounded-md px-3 py-1 text-sm ${active ? "bg-emerald-600 text-white" : "border hover:bg-accent"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
