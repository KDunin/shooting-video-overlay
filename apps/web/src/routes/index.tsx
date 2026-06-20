import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { Video } from "shared";
import { fmtTime } from "#/lib/format";
import { useDeleteVideo, useUploadVideo, useVideos } from "#/lib/queries";

export const Route = createFileRoute("/")({ component: Library });

function Library() {
  const navigate = useNavigate();
  const videos = useVideos();
  const upload = useUploadVideo();
  const del = useDeleteVideo();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    const video = await upload.mutateAsync(file);
    navigate({ to: "/videos/$id", params: { id: video.id } });
  };

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
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <p className="mb-2 text-muted-foreground">Drop a stage video here (MP4, MOV)</p>
        <button
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? "Uploading…" : "Choose file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {videos.isLoading && <p className="text-muted-foreground">Loading…</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {videos.data?.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            onOpen={() => navigate({ to: "/videos/$id", params: { id: v.id } })}
            onDelete={() => del.mutate(v.id)}
          />
        ))}
      </div>
    </main>
  );
}

const statusColor: Record<Video["status"], string> = {
  uploaded: "bg-zinc-500",
  analyzing: "bg-blue-500",
  analyzed: "bg-emerald-500",
  error: "bg-red-500",
};

function VideoCard({ video, onOpen, onDelete }: { video: Video; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className="group flex flex-col rounded-lg border bg-card p-3 hover:border-emerald-500/50">
      <button className="flex-1 text-left" onClick={onOpen}>
        <div className="mb-1 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusColor[video.status]}`} />
          <span className="truncate font-medium">{video.originalName}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {video.status} · {fmtTime(video.durationS)} {video.width ? `· ${video.width}×${video.height}` : ""}
        </div>
      </button>
      <button
        className="mt-2 self-end text-xs text-red-500 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}
