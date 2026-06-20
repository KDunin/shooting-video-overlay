import { z } from "zod";

export const MarkerKind = z.enum(["beep", "shot"]);
export type MarkerKind = z.infer<typeof MarkerKind>;

export const MarkerSource = z.enum(["auto", "manual"]);
export type MarkerSource = z.infer<typeof MarkerSource>;

export const Marker = z.object({
  id: z.string().uuid(),
  videoId: z.string().uuid(),
  kind: MarkerKind,
  /** Absolute time within the audio/video track, in seconds. */
  tSeconds: z.number().min(0),
  /** Detector score 0..1; null for manually placed markers. */
  confidence: z.number().min(0).max(1).nullable(),
  source: MarkerSource,
  isIgnored: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Marker = z.infer<typeof Marker>;

/** Body for POST /videos/:id/markers — add a manual marker. */
export const CreateMarkerInput = z.object({
  kind: MarkerKind.default("shot"),
  tSeconds: z.number().min(0),
});
export type CreateMarkerInput = z.infer<typeof CreateMarkerInput>;

/** Body for PATCH /markers/:id — nudge / ignore / re-anchor. */
export const UpdateMarkerInput = z
  .object({
    tSeconds: z.number().min(0),
    isIgnored: z.boolean(),
  })
  .partial();
export type UpdateMarkerInput = z.infer<typeof UpdateMarkerInput>;
