import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Marker, MarkerKind } from "shared";
import { computeResults } from "shared/results";
import { ShotList } from "#/components/shot-list";
import { SummaryCard } from "#/components/summary-card";
import { VideoOverlay } from "#/components/video-overlay";
import { VideoPlayer } from "#/components/video-player";
import { WaveformTimeline } from "#/components/waveform-timeline";
import { useVideoTime } from "#/hooks/use-video-time";
import { useUndoHistory } from "#/hooks/use-undo-history";
import { fmtTime } from "#/lib/format";
import { qk, useAnalyze, useMarkers, useVideo } from "#/lib/queries";
import { fetchPeaks, mediaUrls, videosApi } from "#/lib/videos-api";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@kdunin/component-library";

export const Route = createFileRoute("/videos/$id")({ component: VideoPage });

const DRAFT_KEY = (id: string) => `draft:markers:${id}`;

function loadDraft(id: string): Marker[] | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY(id));
    return raw ? (JSON.parse(raw) as Marker[]) : null;
  } catch {
    return null;
  }
}

function VideoPage() {
  const { id } = Route.useParams();
  const video = useVideo(id);
  const markersQ = useMarkers(id);
  const analyze = useAnalyze(id);

  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    setVideoEl(el);
  }, []);
  const { time, duration } = useVideoTime(videoEl);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "review">("edit");
  const [peaks, setPeaks] = useState<Awaited<ReturnType<typeof fetchPeaks>>>(null);
  const triggered = useRef(false);

  // --- Draft marker state (edits stay local until Save is pressed) ----------
  const [draftMarkers, setDraftMarkers] = useState<Marker[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize draft from session storage, then fall back to server data.
  useEffect(() => {
    if (!markersQ.data || draftMarkers !== null) return;
    const stored = loadDraft(id);
    setDraftMarkers(stored ?? markersQ.data);
  }, [markersQ.data, draftMarkers, id]);

  // Persist draft to session storage on every change.
  useEffect(() => {
    if (draftMarkers !== null) {
      sessionStorage.setItem(DRAFT_KEY(id), JSON.stringify(draftMarkers));
    }
  }, [draftMarkers, id]);

  // Low-level draft helpers — always keep sorted by time.
  const addDraft = useCallback(
    (kind: MarkerKind, tSeconds: number): Marker => {
      const m: Marker = {
        id: crypto.randomUUID(),
        videoId: id,
        kind,
        tSeconds,
        confidence: null,
        source: "manual",
        isIgnored: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDraftMarkers((prev) => [...(prev ?? []), m].sort((a, b) => a.tSeconds - b.tSeconds));
      return m;
    },
    [id],
  );

  const updateDraft = useCallback((markerId: string, patch: Partial<Marker>) => {
    setDraftMarkers((prev) =>
      (prev ?? [])
        .map((m) => (m.id === markerId ? { ...m, ...patch } : m))
        .sort((a, b) => a.tSeconds - b.tSeconds),
    );
  }, []);

  const deleteDraft = useCallback((markerId: string) => {
    setDraftMarkers((prev) => (prev ?? []).filter((m) => m.id !== markerId));
  }, []);

  const markers = draftMarkers ?? markersQ.data ?? [];
  const results = useMemo(() => computeResults(markers), [markers]);

  // --- Undo history ----------------------------------------------------------
  const history = useUndoHistory();
  // Snapshot the current draft — used to create undo entries.
  const snap = useCallback(() => [...(draftMarkers ?? [])], [draftMarkers]);

  // Keyboard-nudge batching: hold arrow key → one undo entry.
  const nudgeBatch = useRef<{
    markerId: string;
    prevSnap: Marker[];
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  // Waveform drag: capture snapshot on pointer-down, commit undo on pointer-up.
  const waveformDrag = useRef<{ id: string; prevSnap: Marker[] } | null>(null);

  const commitNudgeBatch = useCallback(() => {
    if (!nudgeBatch.current) return;
    clearTimeout(nudgeBatch.current.timer);
    const { prevSnap } = nudgeBatch.current;
    nudgeBatch.current = null;
    history.push(() => setDraftMarkers(prevSnap));
  }, [history]);

  // --- Save changes to DB ----------------------------------------------------
  const hasChanges = useMemo(() => {
    if (!draftMarkers || !markersQ.data) return false;
    const server = markersQ.data;
    if (draftMarkers.length !== server.length) return true;
    return draftMarkers.some((dm) => {
      const sm = server.find((s) => s.id === dm.id);
      return !sm || dm.tSeconds !== sm.tSeconds || dm.isIgnored !== sm.isIgnored;
    });
  }, [draftMarkers, markersQ.data]);

  const saveChanges = useCallback(async () => {
    if (!draftMarkers || !markersQ.data || isSaving) return;
    setIsSaving(true);
    try {
      const server = markersQ.data;
      const draft = draftMarkers;
      const deleted = server.filter((sm) => !draft.find((dm) => dm.id === sm.id));
      const added = draft.filter((dm) => !server.find((sm) => sm.id === dm.id));
      const updated = draft.filter((dm) => {
        const sm = server.find((s) => s.id === dm.id);
        return sm && (sm.tSeconds !== dm.tSeconds || sm.isIgnored !== dm.isIgnored);
      });
      await Promise.all([
        ...deleted.map((m) => videosApi.deleteMarker(m.id)),
        ...updated.map((m) => videosApi.updateMarker(m.id, { tSeconds: m.tSeconds, isIgnored: m.isIgnored })),
        ...added.map((m) => videosApi.addMarker(id, { kind: m.kind, tSeconds: m.tSeconds })),
      ]);
      sessionStorage.removeItem(DRAFT_KEY(id));
      history.clear();
      setDraftMarkers(null); // re-initialize from fresh server data
      await qc.invalidateQueries({ queryKey: qk.markers(id) });
    } catch (err) {
      console.error("Failed to save marker edits", err);
    } finally {
      setIsSaving(false);
    }
  }, [draftMarkers, markersQ.data, isSaving, id, history, qc]);

  // --- Status / polling ------------------------------------------------------
  const timelinePanelRef = useRef<HTMLDivElement>(null);
  const [timelineH, setTimelineH] = useState(120);
  useEffect(() => {
    const el = timelinePanelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setTimelineH(Math.max(60, entry.contentRect.height - 28));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const status = video.data?.status;

  // When re-analysis completes, reset draft so fresh server markers load in.
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (status === "analyzed" && prevStatus.current !== "analyzed") {
      sessionStorage.removeItem(DRAFT_KEY(id));
      history.clear();
      setDraftMarkers(null);
      qc.invalidateQueries({ queryKey: qk.markers(id) });
    }
    prevStatus.current = status;
  }, [status, id, qc, history]);

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

  // --- Keyboard shortcuts ----------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = videoRef.current;
      if (!el) return;

      // Ctrl/Cmd+Z — undo last edit.
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        commitNudgeBatch();
        history.undo();
        return;
      }

      if (mode !== "edit") return;

      const step = e.shiftKey ? 0.05 : 0.01;
      switch (e.key) {
        case " ":
          e.preventDefault();
          el.paused ? el.play() : el.pause();
          break;

        case "a":
        case "A": {
          const prev = snap();
          addDraft("shot", el.currentTime);
          history.push(() => setDraftMarkers(prev));
          break;
        }

        case "b":
        case "B": {
          const prev = snap();
          addDraft("beep", el.currentTime);
          history.push(() => setDraftMarkers(prev));
          break;
        }

        case "ArrowLeft":
          if (selected) {
            e.preventDefault();
            if (!nudgeBatch.current || nudgeBatch.current.markerId !== selected.id) {
              commitNudgeBatch();
              nudgeBatch.current = {
                markerId: selected.id,
                prevSnap: snap(),
                timer: setTimeout(commitNudgeBatch, 800),
              };
            } else {
              clearTimeout(nudgeBatch.current.timer);
              nudgeBatch.current.timer = setTimeout(commitNudgeBatch, 800);
            }
            updateDraft(selected.id, { tSeconds: Math.max(0, selected.tSeconds - step) });
          }
          break;

        case "ArrowRight":
          if (selected) {
            e.preventDefault();
            if (!nudgeBatch.current || nudgeBatch.current.markerId !== selected.id) {
              commitNudgeBatch();
              nudgeBatch.current = {
                markerId: selected.id,
                prevSnap: snap(),
                timer: setTimeout(commitNudgeBatch, 800),
              };
            } else {
              clearTimeout(nudgeBatch.current.timer);
              nudgeBatch.current.timer = setTimeout(commitNudgeBatch, 800);
            }
            updateDraft(selected.id, { tSeconds: selected.tSeconds + step });
          }
          break;

        case "Delete":
        case "Backspace":
          if (selected) {
            commitNudgeBatch();
            const prev = snap();
            deleteDraft(selected.id);
            history.push(() => setDraftMarkers(prev));
            setSelectedId(null);
          }
          break;

        case "i":
        case "I":
          if (selected) {
            const prev = snap();
            updateDraft(selected.id, { isIgnored: !selected.isIgnored });
            history.push(() => setDraftMarkers(prev));
          }
          break;

        case "[":
        case "]": {
          const shots = results.shots;
          if (!shots.length) break;
          const cur = shots.findIndex((s) => s.tSeconds > el.currentTime);
          const next =
            e.key === "]"
              ? shots[cur === -1 ? shots.length - 1 : cur]
              : shots[Math.max(0, (cur === -1 ? shots.length : cur) - 2)];
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
  }, [mode, selected, results, history, commitNudgeBatch, snap, addDraft, updateDraft, deleteDraft]);

  const analyzing = status === "uploaded" || status === "analyzing";
  const showResizable = status === "analyzed" && mode === "edit";

  return (
    <main className="page-wrap flex h-full flex-col overflow-hidden px-4 pt-4">
      <div className="mb-3 flex shrink-0 items-center justify-between">
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
          {hasChanges && (
            <button
              className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              disabled={isSaving}
              onClick={saveChanges}
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-h-0 flex-col">
          {showResizable ? (
            <ResizablePanelGroup orientation="vertical" className="flex-1" style={{ minHeight: 400 }}>
              <ResizablePanel defaultSize={68} minSize={20}>
                <VideoPlayer
                  ref={videoCallbackRef}
                  src={mediaUrls.stream(id)}
                  variant="fill"
                  overlay={<VideoOverlay results={results} currentTime={time} showHistory={false} />}
                />
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
                    onNudge={(mid, t) => updateDraft(mid, { tSeconds: t })}
                    onNudgeStart={(dragId) => {
                      waveformDrag.current = { id: dragId, prevSnap: snap() };
                    }}
                    onNudgeEnd={(dragId) => {
                      if (waveformDrag.current?.id === dragId) {
                        const { prevSnap } = waveformDrag.current;
                        waveformDrag.current = null;
                        history.push(() => setDraftMarkers(prevSnap));
                      }
                    }}
                    onAdd={(t) => {
                      const prev = snap();
                      addDraft("shot", t);
                      history.push(() => setDraftMarkers(prev));
                    }}
                    height={timelineH}
                  />
                  <p className="mt-2 shrink-0 text-xs text-muted-foreground">
                    Shortcuts: <b>space</b> play · <b>A</b> add shot · <b>B</b> set timer · <b>←/→</b> nudge · <b>I</b> ignore · <b>Del</b> remove · <b>[ ]</b> prev/next · <b>Ctrl+Z</b> undo
                  </p>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="flex flex-col gap-3 pb-8">
              <VideoPlayer
                ref={videoCallbackRef}
                src={mediaUrls.stream(id)}
                variant="fluid"
                overlay={
                  status === "analyzed" ? (
                    <VideoOverlay results={results} currentTime={time} showHistory={mode === "review"} />
                  ) : undefined
                }
              />

              {analyzing && (
                <div className="rounded-md border border-blue-500/40 bg-blue-500/5 p-3 text-sm">
                  Analyzing audio — detecting the timer beep and shots. You can scrub the video while this runs.
                </div>
              )}
              {status === "error" && (
                <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm">
                  Analysis failed. Try re-running detection.
                </div>
              )}

              {status === "analyzed" && mode === "review" && <SummaryCard results={results} />}
            </div>
          )}
        </div>

        {status === "analyzed" && (
          <aside className="min-h-0 overflow-hidden rounded-lg border bg-card">
            {mode === "edit" ? (
              <ShotList
                markers={markers}
                results={results}
                selectedId={selectedId}
                currentTime={time}
                onSelect={setSelectedId}
                onSeek={seek}
                onToggleIgnore={(m) => {
                  const prev = snap();
                  updateDraft(m.id, { isIgnored: !m.isIgnored });
                  history.push(() => setDraftMarkers(prev));
                }}
                onDelete={(mid) => {
                  const prev = snap();
                  deleteDraft(mid);
                  history.push(() => setDraftMarkers(prev));
                  if (mid === selectedId) setSelectedId(null);
                }}
                onAddBeep={(t) => {
                  const prev = snap();
                  addDraft("beep", t);
                  history.push(() => setDraftMarkers(prev));
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
