import type { AnalyzeInput, CreateMarkerInput, Marker, UpdateMarkerInput, Video, WaveformPeaks } from "shared";
import { api } from "./api";

/** Unwrap an Eden treaty response, throwing on transport/HTTP error. */
function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw new Error(typeof res.error === "string" ? res.error : "Request failed");
  return res.data as T;
}

export const videosApi = {
  list: async (): Promise<Video[]> => unwrap(await api.videos.get()),

  get: async (id: string): Promise<Video> => unwrap(await api.videos({ id }).get()),

  upload: async (file: File): Promise<Video> => unwrap(await api.videos.post({ file })),

  remove: async (id: string): Promise<void> => {
    await api.videos({ id }).delete();
  },

  analyze: async (id: string, input: AnalyzeInput = {}): Promise<{ jobId: string }> =>
    unwrap(await api.videos({ id }).analyze.post(input)),

  markers: async (id: string): Promise<Marker[]> => unwrap(await api.videos({ id }).markers.get()),

  addMarker: async (id: string, input: CreateMarkerInput): Promise<Marker> =>
    unwrap(await api.videos({ id }).markers.post(input)),

  updateMarker: async (markerId: string, patch: UpdateMarkerInput): Promise<Marker> =>
    unwrap(await api.markers({ id: markerId }).patch(patch)),

  deleteMarker: async (markerId: string): Promise<void> => {
    await api.markers({ id: markerId }).delete();
  },

  job: async (jobId: string) => unwrap(await api.jobs({ id: jobId }).get()),
};

/** URLs served directly by the API (proxied via /api) — used by <video> and the waveform. */
export const mediaUrls = {
  stream: (id: string) => `/api/videos/${id}/stream`,
  peaks: (id: string) => `/api/videos/${id}/peaks`,
};

/** Fetch a video's waveform peaks JSON; null if not available yet or on error. */
export async function fetchPeaks(id: string): Promise<WaveformPeaks | null> {
  try {
    const res = await fetch(mediaUrls.peaks(id));
    if (!res.ok) return null;
    return (await res.json()) as WaveformPeaks;
  } catch {
    return null;
  }
}
