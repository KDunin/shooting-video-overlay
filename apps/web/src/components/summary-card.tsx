import type { StageResults } from "shared/results";
import { fmtSplit, fmtTime } from "#/lib/format";

/** Stage summary for the review phase: headline numbers + split breakdown. */
export function SummaryCard({ results }: { results: StageResults }) {
  const noBeep = results.anchorSource !== "beep" && results.anchorSource !== "manual";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="First shot" value={fmtTime(results.firstShot)} />
        <Metric label="Total time" value={fmtTime(results.totalTime)} accent />
        <Metric label="Shots" value={String(results.shotCount)} />
        <Metric
          label="Avg split"
          value={fmtSplit(avgSplit(results))}
        />
      </div>

      {noBeep && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          No timer beep detected — times are relative to the first shot. Set the beep on the timeline to anchor.
        </p>
      )}

      {results.shots.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Splits</div>
          <div className="flex flex-wrap gap-1.5">
            {results.shots.map((s) => {
              const isFast = results.fastestSplit?.index === s.index;
              const isSlow = results.slowestSplit?.index === s.index;
              return (
                <span
                  key={s.id}
                  className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${
                    isFast ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : ""
                  } ${isSlow ? "bg-red-500/20 text-red-600 dark:text-red-400" : "bg-muted"}`}
                  title={`Shot #${s.index}`}
                >
                  {s.split != null ? fmtSplit(s.split) : fmtTime(s.tRelative)}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function avgSplit(r: StageResults): number | null {
  const splits = r.shots.map((s) => s.split).filter((v): v is number => v != null);
  if (!splits.length) return null;
  return splits.reduce((a, b) => a + b, 0) / splits.length;
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl tabular-nums ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</div>
    </div>
  );
}
