import { z } from "zod";
import { DetectionApproach, DetectionParams } from "./detection";

export const JobStatus = z.enum(["queued", "running", "done", "error"]);
export type JobStatus = z.infer<typeof JobStatus>;

export const AnalysisJob = z.object({
  id: z.string().uuid(),
  videoId: z.string().uuid(),
  status: JobStatus,
  approach: DetectionApproach,
  params: DetectionParams,
  error: z.string().nullable(),
  attempts: z.number().int(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});
export type AnalysisJob = z.infer<typeof AnalysisJob>;

/** Body for POST /videos/:id/analyze. All fields optional → server fills defaults. */
export const AnalyzeInput = DetectionParams.partial();
export type AnalyzeInput = z.infer<typeof AnalyzeInput>;
