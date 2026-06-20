import type { AnalysisJob, Marker, Video } from "shared";
import type { AnalysisJobRow, MarkerRow, VideoRow } from "./db/schema";

const iso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export const toVideo = (r: VideoRow): Video => ({
  id: r.id,
  originalName: r.originalName,
  status: r.status as Video["status"],
  durationS: r.durationS,
  fps: r.fps,
  width: r.width,
  height: r.height,
  sampleRate: r.sampleRate,
  hasPeaks: r.peaksPath != null,
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
});

export const toMarker = (r: MarkerRow): Marker => ({
  id: r.id,
  videoId: r.videoId,
  kind: r.kind as Marker["kind"],
  tSeconds: r.tSeconds,
  confidence: r.confidence,
  source: r.source as Marker["source"],
  isIgnored: r.isIgnored,
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
});

export const toJob = (r: AnalysisJobRow): AnalysisJob => ({
  id: r.id,
  videoId: r.videoId,
  status: r.status as AnalysisJob["status"],
  approach: r.approach as AnalysisJob["approach"],
  params: r.params,
  error: r.error,
  attempts: r.attempts,
  createdAt: iso(r.createdAt),
  startedAt: r.startedAt ? iso(r.startedAt) : null,
  finishedAt: r.finishedAt ? iso(r.finishedAt) : null,
});
