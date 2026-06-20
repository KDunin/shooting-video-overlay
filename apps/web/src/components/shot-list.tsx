import { useMemo } from "react";
import type { Marker } from "shared";
import type { StageResults } from "shared/results";
import { fmtSplit, fmtTime } from "#/lib/format";

const LOW_CONFIDENCE = 0.22;

interface Props {
  markers: Marker[];
  results: StageResults;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeek: (t: number) => void;
  onToggleIgnore: (m: Marker) => void;
  onDelete: (id: string) => void;
}

/** Right-rail editable shot list. Counted + ignored shots, splits, confidence flags. */
export function ShotList({ markers, results, selectedId, onSelect, onSeek, onToggleIgnore, onDelete }: Props) {
  const splitById = useMemo(() => new Map(results.shots.map((s) => [s.id, s])), [results]);
  const shots = useMemo(
    () => markers.filter((m) => m.kind === "shot").sort((a, b) => a.tSeconds - b.tSeconds),
    [markers],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
        <span>Shots</span>
        <span className="text-muted-foreground">{results.shotCount} counted</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {shots.length === 0 && <div className="p-4 text-sm text-muted-foreground">No shots detected yet.</div>}
        {shots.map((m) => {
          const counted = splitById.get(m.id);
          const lowConf = !m.isIgnored && m.confidence != null && m.confidence < LOW_CONFIDENCE;
          return (
            <div
              key={m.id}
              className={`flex cursor-pointer items-center gap-2 border-b px-3 py-1.5 text-sm tabular-nums hover:bg-accent ${
                m.id === selectedId ? "bg-accent" : ""
              } ${m.isIgnored ? "opacity-50" : ""} ${lowConf ? "border-l-2 border-l-amber-500" : ""}`}
              onClick={() => {
                onSelect(m.id);
                onSeek(m.tSeconds);
              }}
              title={lowConf ? "Low confidence — verify this detection" : undefined}
            >
              <span className="w-6 text-muted-foreground">{counted ? `#${counted.index}` : "—"}</span>
              <span className="w-16">{counted ? fmtTime(counted.tRelative) : fmtTime(m.tSeconds)}</span>
              <span className="w-12 text-emerald-600 dark:text-emerald-400">
                {counted?.split != null ? `+${fmtSplit(counted.split)}` : ""}
              </span>
              <span className="flex-1" />
              <button
                className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleIgnore(m);
                }}
              >
                {m.isIgnored ? "include" : "ignore"}
              </button>
              <button
                className="rounded px-1 text-xs text-red-500 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(m.id);
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
