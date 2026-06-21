import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { Video } from "shared";
import { fmtTime } from "#/lib/format";
import { useDeleteVideo, useUpdateVideo, useUploadVideo, useVideos } from "#/lib/queries";

export const Route = createFileRoute("/")({ component: Library });

type GroupBy = "none" | "match" | "shooter" | "stage";

function groupKey(v: Video, by: GroupBy): string {
  if (by === "match") return v.matchName ?? "";
  if (by === "shooter") return v.shooterName ?? "";
  if (by === "stage") return v.stageName ?? "";
  return "";
}

function groupLabel(key: string, by: GroupBy): string {
  if (by === "none") return "";
  const labels: Record<GroupBy, string> = { none: "", match: "Match", shooter: "Shooter", stage: "Stage" };
  return key === "" ? `No ${labels[by]}` : key;
}

function Library() {
  const navigate = useNavigate();
  const videos = useVideos();
  const upload = useUploadVideo();
  const del = useDeleteVideo();
  const update = useUpdateVideo();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const results = await Promise.all(files.map((f) => upload.mutateAsync(f)));
    if (results.length === 1) {
      navigate({ to: "/videos/$id", params: { id: results[0].id } });
    }
  };

  const allVideos = videos.data ?? [];

  let groups: { key: string; videos: Video[] }[];
  if (groupBy === "none") {
    groups = [{ key: "", videos: allVideos }];
  } else {
    const map = new Map<string, Video[]>();
    for (const v of allVideos) {
      const k = groupKey(v, groupBy);
      const existing = map.get(k) ?? [];
      existing.push(v);
      map.set(k, existing);
    }
    groups = Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === "") return 1;
        if (b === "") return -1;
        return a.localeCompare(b);
      })
      .map(([key, vs]) => ({ key, videos: vs }));
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-6">
      <h1 className="mb-4 text-xl font-semibold">Shooting video analysis</h1>

      <div
        className={`mb-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-emerald-500 bg-emerald-500/5" : "border-muted"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("video/"));
          handleFiles(files);
        }}
      >
        <p className="mb-2 text-muted-foreground">Drop stage videos here (MP4, MOV)</p>
        <button
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? "Uploading…" : "Choose files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) handleFiles(files);
            e.target.value = "";
          }}
        />
      </div>

      {videos.isLoading && <p className="text-muted-foreground">Loading…</p>}

      {allVideos.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Group by:</span>
          {(["none", "match", "shooter", "stage"] as GroupBy[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setGroupBy(opt)}
              className={`rounded-md px-3 py-1 text-sm capitalize ${
                groupBy === opt ? "bg-emerald-600 text-white" : "border hover:bg-accent"
              }`}
            >
              {opt === "none" ? "None" : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      )}

      {groups.map(({ key, videos: groupVideos }) => (
        <div key={key} className="mb-6">
          {groupBy !== "none" && (
            <h2 className="mb-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {groupLabel(key, groupBy)}
              <span className="ml-2 text-xs font-normal">({groupVideos.length})</span>
            </h2>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupVideos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onOpen={() => navigate({ to: "/videos/$id", params: { id: v.id } })}
                onDelete={() => del.mutate(v.id)}
                onUpdate={(patch) => update.mutate({ id: v.id, patch })}
              />
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}

const statusColor: Record<Video["status"], string> = {
  uploaded: "bg-zinc-500",
  analyzing: "bg-blue-500",
  analyzed: "bg-emerald-500",
  error: "bg-red-500",
};

function VideoCard({
  video,
  onOpen,
  onDelete,
  onUpdate,
}: {
  video: Video;
  onOpen: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Pick<Video, "matchName" | "shooterName" | "stageName">>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [match, setMatch] = useState(video.matchName ?? "");
  const [shooter, setShooter] = useState(video.shooterName ?? "");
  const [stage, setStage] = useState(video.stageName ?? "");

  const handleSave = () => {
    onUpdate({
      matchName: match.trim() || null,
      shooterName: shooter.trim() || null,
      stageName: stage.trim() || null,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setMatch(video.matchName ?? "");
    setShooter(video.shooterName ?? "");
    setStage(video.stageName ?? "");
    setEditing(false);
  };

  const tags = [
    video.matchName && { label: "Match", value: video.matchName },
    video.shooterName && { label: "Shooter", value: video.shooterName },
    video.stageName && { label: "Stage", value: video.stageName },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="group flex flex-col rounded-lg border bg-card p-3 hover:border-emerald-500/50">
      <button className="flex-1 text-left" onClick={onOpen}>
        <div className="mb-1 flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor[video.status]}`} />
          <span className="truncate font-medium">{video.originalName}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {video.status} · {fmtTime(video.durationS)} {video.width ? `· ${video.width}×${video.height}` : ""}
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t.label} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {t.label}: {t.value}
              </span>
            ))}
          </div>
        )}
      </button>

      {editing ? (
        <div className="mt-3 space-y-2 border-t pt-3">
          <TagField label="Match" value={match} onChange={setMatch} />
          <TagField label="Shooter" value={shooter} onChange={setShooter} />
          <TagField label="Stage" value={stage} onChange={setStage} />
          <div className="flex gap-2 pt-1">
            <button
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
              onClick={handleSave}
            >
              Save
            </button>
            <button className="rounded-md border px-3 py-1 text-xs hover:bg-accent" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex justify-between">
          <button
            className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            Edit tags
          </button>
          <button
            className="text-xs text-red-500 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function TagField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-16 shrink-0 text-xs text-muted-foreground">{label}</label>
      <input
        className="flex-1 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${label.toLowerCase()}…`}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.blur();
        }}
      />
    </div>
  );
}
