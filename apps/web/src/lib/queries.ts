import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnalyzeInput, CreateMarkerInput, Marker, UpdateMarkerInput } from "shared";
import { fetchPeaks, videosApi } from "./videos-api";

export const qk = {
  videos: ["videos"] as const,
  video: (id: string) => ["videos", id] as const,
  markers: (id: string) => ["markers", id] as const,
  peaks: (id: string) => ["peaks", id] as const,
  job: (id: string) => ["jobs", id] as const,
};

// --- Videos ----------------------------------------------------------------
export const useVideos = () => useQuery({ queryKey: qk.videos, queryFn: videosApi.list });

export const useVideo = (id: string) =>
  useQuery({
    queryKey: qk.video(id),
    queryFn: () => videosApi.get(id),
    // Poll while analysis is in flight so the editor unlocks automatically when it finishes.
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "analyzing" || s === "uploaded" ? 1500 : false;
    },
  });

export function useUploadVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => videosApi.upload(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.videos }),
  });
}

export function useDeleteVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => videosApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.videos }),
  });
}

// --- Analysis job ----------------------------------------------------------
export function useAnalyze(videoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnalyzeInput = {}) => videosApi.analyze(videoId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.video(videoId) }),
  });
}

/** Poll a job until it is done/errored. */
export function useAnalysisJob(jobId: string | null) {
  return useQuery({
    queryKey: qk.job(jobId ?? "none"),
    queryFn: () => videosApi.job(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "done" || s === "error" ? false : 1000;
    },
  });
}

// --- Waveform peaks --------------------------------------------------------
/** Load a video's waveform peaks once they exist; stays null while unavailable. */
export const usePeaks = (videoId: string, hasPeaks: boolean | undefined) =>
  useQuery({
    queryKey: qk.peaks(videoId),
    queryFn: () => fetchPeaks(videoId),
    enabled: !!hasPeaks,
  });

// --- Markers (optimistic for instant recompute) ----------------------------
export const useMarkers = (videoId: string) =>
  useQuery({ queryKey: qk.markers(videoId), queryFn: () => videosApi.markers(videoId) });

function patchCache(qc: ReturnType<typeof useQueryClient>, videoId: string, fn: (m: Marker[]) => Marker[]) {
  qc.setQueryData<Marker[]>(qk.markers(videoId), (prev) => (prev ? fn(prev) : prev));
}

export function useAddMarker(videoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMarkerInput) => videosApi.addMarker(videoId, input),
    onSuccess: (created) => patchCache(qc, videoId, (m) => [...m, created].sort((a, b) => a.tSeconds - b.tSeconds)),
  });
}

export function useUpdateMarker(videoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateMarkerInput }) => videosApi.updateMarker(id, patch),
    // Optimistic: apply immediately so splits recompute with no round-trip.
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.markers(videoId) });
      const prev = qc.getQueryData<Marker[]>(qk.markers(videoId));
      patchCache(qc, videoId, (m) =>
        m.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort((a, b) => a.tSeconds - b.tSeconds),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.markers(videoId), ctx.prev),
  });
}

export function useDeleteMarker(videoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => videosApi.deleteMarker(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.markers(videoId) });
      const prev = qc.getQueryData<Marker[]>(qk.markers(videoId));
      patchCache(qc, videoId, (m) => m.filter((x) => x.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.markers(videoId), ctx.prev),
  });
}
