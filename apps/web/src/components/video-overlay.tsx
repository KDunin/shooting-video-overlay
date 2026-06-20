import { useMemo } from "react";
import type { StageResults } from "shared/results";
import { fmtSplit, fmtTime } from "#/lib/format";

interface Props {
  results: StageResults;
  currentTime: number;
  showHistory?: boolean;
}

/**
 * Live HUD drawn over the <video>. Reflects the state *as of* currentTime: the running
 * stage clock, shots fired so far, and the most recent split. Pure/presentational — fed by
 * the shared computeResults selector so it always matches the editor.
 */
export function VideoOverlay({ results, currentTime, showHistory = false }: Props) {
  const state = useMemo(() => {
    const fired = results.shots.filter((s) => s.tSeconds <= currentTime + 1e-6);
    const last = fired[fired.length - 1];
    const stageClock =
      results.anchorT != null ? Math.max(0, currentTime - results.anchorT) : currentTime;
    return { fired, last, stageClock };
  }, [results, currentTime]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 font-mono">
      <div className="flex items-start gap-2 self-start rounded-md bg-black/65 px-3 py-2 text-white backdrop-blur-sm">
        <Stat label="TIME" value={fmtTime(state.stageClock)} accent />
        <Divider />
        <Stat label="SHOTS" value={`${state.fired.length}/${results.shotCount}`} />
        <Divider />
        <Stat label="SPLIT" value={state.last?.split != null ? fmtSplit(state.last.split) : "—"} />
      </div>

      {showHistory && state.fired.length > 0 && (
        <div className="max-h-40 w-40 self-end overflow-hidden rounded-md bg-black/65 px-3 py-2 text-xs text-white backdrop-blur-sm">
          <div className="mb-1 text-white/60">HISTORY</div>
          {state.fired
            .slice(-6)
            .reverse()
            .map((s) => (
              <div key={s.id} className="flex justify-between tabular-nums">
                <span className="text-white/60">#{s.index}</span>
                <span>{fmtTime(s.tRelative)}</span>
                <span className="text-emerald-300">{s.split != null ? `+${fmtSplit(s.split)}` : "—"}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] tracking-widest text-white/55">{label}</span>
      <span className={`text-lg leading-tight tabular-nums ${accent ? "text-emerald-300" : ""}`}>{value}</span>
    </div>
  );
}

const Divider = () => <span className="mx-1 self-stretch border-l border-white/15" />;
