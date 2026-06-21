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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewW, setViewW] = useState(800);
  const [zoom, setZoom] = useState(1);
  const dur = peaks?.durationS || duration || 1;

  const pps = (viewW / dur) * zoom;
  const totalPx = Math.max(viewW, dur * pps);

  const pendingScrollRef = useRef<{ timeAtCursor: number; cursorOffsetX: number } | null>(null);

  // Keep draw inputs in a ref so the scroll handler can read them without
  // closing over stale values between React renders.
  const paintStateRef = useRef({ peaks, pps, viewW, height });
  paintStateRef.current = { peaks, pps, viewW, height };

  const paintCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const el = scrollRef.current;
    if (!canvas || !el) return;
    const { peaks: p, pps: ppx, viewW: vw, height: h } = paintStateRef.current;
    const sl = el.scrollLeft;
    const dpr = window.devicePixelRatio || 1;

    const needW = Math.round(vw * dpr);
    const needH = Math.round(h * dpr);
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW;
      canvas.height = needH;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, h);

    const mid = h / 2;
    ctx.strokeStyle = "rgba(120,140,170,0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (p && p.peaks.length) {
      const n = p.peaks.length;
      for (let i = 0; i < n; i++) {
        const t = i / p.pointsPerSecond;
        const x = Math.round(t * ppx - sl) + 0.5;
        if (x < -1 || x > vw + 1) continue;
        const amp = p.peaks[i]! * (mid - 2);
        ctx.moveTo(x, mid - amp);
        ctx.lineTo(x, mid + amp);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,140,170,0.2)";
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(vw, mid);
    ctx.stroke();
  }, []);

  useEffect(() => { paintCanvas(); }, [paintCanvas, peaks, pps, viewW, height]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => paintCanvas();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [paintCanvas]);

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

  // Observe the wrapper div for width. The wrapper never has content-driven
  // width (it's a plain flex item with stretch alignment), so viewW is stable
  // and cannot feed back into totalPx/pps to cause a growth loop.
  useLayoutEffect(() => {
    const el = wrapperRef.current;
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
        <span className="ml-2 truncate">scroll to pan · ctrl+scroll to zoom · double-click to add shot · drag marker to nudge · drag playhead to seek</span>
      </div>

      {/*
        wrapperRef is the layout anchor — its width comes purely from flex-stretch
        and never from its own content. The canvas and scroll layer are both
        absolutely inset so they never participate in content-driven layout.
      */}
      <div
        ref={wrapperRef}
        className="relative rounded-md border bg-card overflow-hidden"
        style={{ height }}
      >
        {/* Canvas: always viewport-sized, only draws the visible slice. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: viewW, height }}
        />

        {/* Transparent scroll layer: creates the scrollable width for markers/playhead. */}
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-x-auto overflow-y-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) onSeek(xToTime(e.clientX));
          }}
          onDoubleClick={(e) => onAdd(xToTime(e.clientX))}
        >
          <div className="relative" style={{ width: totalPx, height }}>
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

            <Playhead x={currentTime * pps} height={height} xToTime={xToTime} onSeek={onSeek} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Playhead({ x, height, xToTime, onSeek }: { x: number; height: number; xToTime: (clientX: number) => number; onSeek: (t: number) => void }) {
  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    e.stopPropagation();
    onSeek(xToTime(e.clientX));
  };

  return (
    <div
      className="absolute top-0 z-20 -ml-2 w-4 cursor-ew-resize"
      style={{ left: x, height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      title="Playhead — drag to seek"
    >
      {/* line */}
      <div className="absolute inset-x-0 top-0 mx-auto w-0.5 bg-red-500" style={{ height: "100%" }} />
      {/* handle triangle */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0" style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "8px solid rgb(239 68 68)" }} />
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
