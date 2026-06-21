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

/**
 * Scrollable waveform editor. Peaks are painted on a canvas (redrawn only when data/zoom/size
 * change); markers and the playhead are positioned DOM elements so hit-testing and dragging are
 * precise. Background click seeks; double-click adds a shot; drag a marker to nudge it.
 */
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

  // Base fit: whole clip across the viewport; zoom multiplies from there.
  const basePps = viewW / dur;
  const pps = basePps * zoom;
  const totalPx = Math.max(viewW, dur * pps);

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

  // Track viewport width.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Paint peaks.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalPx * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, totalPx, height);

    const mid = height / 2;
    ctx.strokeStyle = "rgba(120,140,170,0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (peaks && peaks.peaks.length) {
      const n = peaks.peaks.length;
      for (let i = 0; i < n; i++) {
        const t = i / peaks.pointsPerSecond;
        const x = Math.round(t * pps) + 0.5;
        const h = peaks.peaks[i]! * (mid - 2);
        ctx.moveTo(x, mid - h);
        ctx.lineTo(x, mid + h);
      }
    }
    ctx.stroke();
    // Centre line.
    ctx.strokeStyle = "rgba(120,140,170,0.2)";
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(totalPx, mid);
    ctx.stroke();
  }, [peaks, totalPx, height, pps]);

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <button className="rounded border px-2 py-0.5" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.5))}>
          −
        </button>
        <span>zoom {zoom.toFixed(1)}×</span>
        <button className="rounded border px-2 py-0.5" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.5))}>
          +
        </button>
        <span className="ml-2">double-click to add a shot · drag a marker to nudge</span>
      </div>

      <div
        ref={scrollRef}
        className="relative overflow-x-auto rounded-md border bg-card"
        style={{ height }}
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) onSeek(xToTime(e.clientX));
        }}
        onDoubleClick={(e) => onAdd(xToTime(e.clientX))}
      >
        <div className="relative" style={{ width: totalPx, height }}>
          <canvas
            ref={canvasRef}
            data-bg="1"
            className="absolute inset-0 h-full w-full"
            style={{ width: totalPx, height }}
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
      <div className={`mx-auto h-full w-0.5 ${color} ${dim ? "opacity-40" : ""} ${selected ? "ring-2 ring-white" : ""}`} />
      <div className={`mx-auto -mt-1 h-2 w-2 rounded-full ${color} ${dim ? "opacity-40" : ""}`} />
    </div>
  );
}
