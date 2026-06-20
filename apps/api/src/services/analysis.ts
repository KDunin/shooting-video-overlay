import { and, eq } from "drizzle-orm";
import { defaultDetectionParams, type AnalyzeInput, type DetectionParams } from "shared";
import { db } from "../db/client";
import { analysisJobs, markers, videos } from "../db/schema";

/**
 * Enqueue an analysis run for a video. Re-running clears prior *auto* markers only —
 * manual edits survive (see plan §4). The analyzer worker claims the queued job.
 */
export async function enqueueAnalysis(videoId: string, input: AnalyzeInput = {}): Promise<string> {
  const params: DetectionParams = { ...defaultDetectionParams(), ...input };

  return db.transaction(async (tx) => {
    // Drop superseded auto detections; keep manual markers.
    await tx.delete(markers).where(and(eq(markers.videoId, videoId), eq(markers.source, "auto")));

    await tx.update(videos).set({ status: "analyzing", updatedAt: new Date() }).where(eq(videos.id, videoId));

    const [job] = await tx
      .insert(analysisJobs)
      .values({ videoId, status: "queued", approach: params.approach, params })
      .returning({ id: analysisJobs.id });

    return job!.id;
  });
}
