import { z } from "zod";

export const VideoStatus = z.enum(["uploaded", "analyzing", "analyzed", "error"]);
export type VideoStatus = z.infer<typeof VideoStatus>;

export const Video = z.object({
  id: z.string().uuid(),
  originalName: z.string(),
  status: VideoStatus,
  durationS: z.number().nullable(),
  fps: z.number().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  sampleRate: z.number().int().nullable(),
  /** True once a peaks.json has been generated and is servable. */
  hasPeaks: z.boolean(),
  matchName: z.string().nullable(),
  shooterName: z.string().nullable(),
  stageName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Video = z.infer<typeof Video>;

export const UpdateVideoInput = z.object({
  matchName: z.string().nullable().optional(),
  shooterName: z.string().nullable().optional(),
  stageName: z.string().nullable().optional(),
});
export type UpdateVideoInput = z.infer<typeof UpdateVideoInput>;

/** Waveform peaks payload served at GET /videos/:id/peaks and rendered on the timeline. */
export const WaveformPeaks = z.object({
  /** Number of peak buckets per second of audio. */
  pointsPerSecond: z.number(),
  /** Total audio duration the peaks cover, seconds. */
  durationS: z.number(),
  /** Normalised 0..1 max-amplitude per bucket. */
  peaks: z.array(z.number()),
});
export type WaveformPeaks = z.infer<typeof WaveformPeaks>;
