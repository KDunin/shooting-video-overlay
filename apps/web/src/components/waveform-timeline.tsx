import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Marker, WaveformPeaks } from "shared";

interface Props {
  peaks: WaveformPeaks | null;
  duration: number;
  markers: Marker[];
  selectedId: string | null;
  currentTime: number;
  onSelect: (id: string | null) => void;
  onSeek: (t: number) => void;
  onNudge: (id: string, tSeconds: number) => void;
  onNudgeStart?: (id: string, originalTSeconds: number) => void;
  onNudgeEnd?: (id: string) => void;
  onAdd: (tSeconds: number) => void;
  height?: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 40;

export function WaveformTimeline({
  peaks,
  duration,
  markers,
  selectedId,
  currentTime,
  onSelect,
  onSeek,
  onNudge,
  onNudgeStart,
  onNudgeEnd,
  onAdd,
  height = 120,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewW, setViewW] = useState(800);
  const [zoom, setZoom] = useState(1);
  const dur = peaks?.durationS || duration || 1;

  const basePps = viewW / dur;
  const pps = basePps * zoom;
  const totalPx = Math.max(viewW, dur * pps);

  const pendingScrollRef = useRef<{ timeAtCursor: number; cursorOffsetX: number } | null>(null);

  // Draw only the visible slice of peaks — canvas stays viewport-wide (sticky),
  // avoiding giant canvas allocations that blank out above ~16 k px.
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const el = scrollRef.current;
    if (!canvas || !el) return;
    const sl = el.scrollLeft;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewW * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, viewW, height);

    const mid = height / 2;
    ctx.strokeStyle = "rgba(120,140,170,0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (peaks && peaks.peaks.length) {
      const n = peaks.peaks.length;
      for (let i = 0; i < n; i++) {
        const t = i / peaks.pointsPerSecond;
        const x = Math.round(t * pps - sl) + 0.5;
        if (x < -1 || x > viewW + 1) continue;
        const h = peaks.peaks[i]! * (mid - 2);
        ctx.moveTo(x, mid - h);
        ctx.lineTo(x, mid + h);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,140,170,0.2)";
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(viewW, mid);
    ctx.stroke();
  }, [peaks, viewW, height, pps]);

  // Redraw when data, zoom, or viewport size change.
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Redraw on scroll (pan).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => drawCanvas();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [drawCanvas]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const rect = el.getBoundingClientRect();
        const cursorOffsetX = e.clientX - rect.left;
        const timeAtCursor = (cursorOffsetX + el.scrollLeft) / pps;
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        pendingScrollRef.current = { timeAtCursor, cursorOffsetX };
        setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
      } else {
        el.scrollLeft += e.deltaY + e.deltaX;
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [pps]);

  // After zoom + pps settle, re-anchor scroll so the time under the cursor stays fixed.
  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = null;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = pending.timeAtCursor * pps - pending.cursorOffsetX;
  }, [pps]);

  const xToTime = useCallback(
    (clientX: number) => {
      const el = scrollRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft;
      return Math.min(dur, Math.max(0, x / pps));
    },
    [pps, dur],
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden select-none">
      <div className="mb-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <button className="shrink-0 rounded border px-2 py-0.5" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.5))}>
          −
        </button>
        <span className="shrink-0">zoom {zoom.toFixed(1)}×</span>
        <button className="shrink-0 rounded border px-2 py-0.5" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.5))}>
          +
        </button>
        <span className="ml-2 truncate">scroll to pan · ctrl+scroll to zoom · double-click to add shot · drag marker to nudge</span>
      </div>

      <div
        ref={scrollRef}
        className="relative overflow-x-auto overflow-y-hidden rounded-md border bg-card"
        style={{ height }}
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) onSeek(xToTime(e.clientX));
        }}
        onDoubleClick={(e) => onAdd(xToTime(e.clientX))}
      >
        {/* Spacer div creates the scrollable width; canvas is sticky so it never exceeds viewW. */}
        <div className="relative" style={{ width: totalPx, height }}>
          <canvas
            ref={canvasRef}
            data-bg="1"
            className="absolute top-0 left-0"
            style={{ position: "sticky", left: 0, width: viewW, height }}
          />

          {markers.map((m) => (
            <MarkerEl
              key={m.id}
              marker={m}
              x={m.tSeconds * pps}
              height={height}
              selected={m.id === selectedId}
              onSelect={() => onSelect(m.id)}
              xToTime={xToTime}
              onNudge={(t) => onNudge(m.id, t)}
              onNudgeStart={onNudgeStart ? (originalT) => onNudgeStart(m.id, originalT) : undefined}
              onNudgeEnd={onNudgeEnd ? () => onNudgeEnd(m.id) : undefined}
            />
          ))}

          <div
            className="pointer-events-none absolute top-0 z-20 w-0.5 bg-red-500"
            style={{ left: currentTime * pps, height }}
          />
        </div>
      </div>
    </div>
  );
}

function MarkerEl({
  marker,
  x,
  height,
  selected,
  onSelect,
  xToTime,
  onNudge,
  onNudgeStart,
  onNudgeEnd,
}: {
  marker: Marker;
  x: number;
  height: number;
  selected: boolean;
  onSelect: () => void;
  xToTime: (clientX: number) => number;
  onNudge: (t: number) => void;
  onNudgeStart?: (originalTSeconds: number) => void;
  onNudgeEnd?: () => void;
}) {
  const isBeep = marker.kind === "beep";
  const dim = marker.isIgnored;
  const color = isBeep ? "bg-amber-400" : dim ? "bg-zinc-500" : "bg-emerald-400";

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    onNudgeStart?.(marker.tSeconds);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    e.stopPropagation();
    onNudge(xToTime(e.clientX));
  };
  const onPointerUp = () => {
    onNudgeEnd?.();
  };

  return (
    <div
      className="absolute top-0 z-10 -ml-1.5 w-3 cursor-ew-resize"
      style={{ left: x, height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title={`${marker.kind} @ ${marker.tSeconds.toFixed(3)}s${dim ? " (ignored)" : ""}`}
    >
      <div className={`absolute inset-x-0 top-0 mx-auto w-0.5 ${color} ${dim ? "opacity-40" : ""} ${selected ? "ring-2 ring-white" : ""}`} style={{ height: "100%" }} />
      <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full ${color} ${dim ? "opacity-40" : ""}`} />
    </div>
  );
}
