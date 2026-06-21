import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { Elysia, t } from "elysia";
import { desc, eq } from "drizzle-orm";
import { computeResults } from "shared";
import { config, mediaPaths } from "../config";
import { db } from "db";
import { markers as markersTable, videos } from "db";
import { enqueueAnalysis } from "../services/analysis";
import { probeVideo } from "../services/ffprobe";
import { deleteMedia, saveUpload } from "../services/storage";
import { toMarker, toVideo } from "../serializers";

const contentTypeFor = (name: string): string => {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  if (ext === "mkv") return "video/x-matroska";
  return "video/mp4";
};

export const videoRoutes = new Elysia({ name: "videos" })
  // --- Upload ---------------------------------------------------------------
  .post(
    "/videos",
    async ({ body, set }) => {
      const { file } = body;
      if (file.size > config.maxUploadBytes) {
        set.status = 413;
        return { error: "File too large" };
      }

      const [created] = await db
        .insert(videos)
        .values({ originalName: file.name, storagePath: "", status: "uploaded" })
        .returning();
      const video = created!;

      const storagePath = await saveUpload(video.id, file);
      const meta = await probeVideo(storagePath);

      const [updated] = await db
        .update(videos)
        .set({ storagePath, ...meta, updatedAt: new Date() })
        .where(eq(videos.id, video.id))
        .returning();

      return toVideo(updated!);
    },
    {
      body: t.Object({ file: t.File({ maxSize: "4g" }) }),
    },
  )

  // --- List / detail / delete ----------------------------------------------
  .get("/videos", async () => {
    const rows = await db.select().from(videos).orderBy(desc(videos.createdAt));
    return rows.map(toVideo);
  })

  .get(
    "/videos/:id",
    async ({ params, set }) => {
      const [row] = await db.select().from(videos).where(eq(videos.id, params.id));
      if (!row) return ((set.status = 404), { error: "Not found" });
      return toVideo(row);
    },
    { params: t.Object({ id: t.String() }) },
  )

  .patch(
    "/videos/:id",
    async ({ params, body, set }) => {
      const patch: Partial<typeof videos.$inferInsert> = {};
      if ("matchName" in body) patch.matchName = body.matchName ?? null;
      if ("shooterName" in body) patch.shooterName = body.shooterName ?? null;
      if ("stageName" in body) patch.stageName = body.stageName ?? null;
      const [updated] = await db
        .update(videos)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(videos.id, params.id))
        .returning();
      if (!updated) return ((set.status = 404), { error: "Not found" });
      return toVideo(updated);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        matchName: t.Optional(t.Nullable(t.String())),
        shooterName: t.Optional(t.Nullable(t.String())),
        stageName: t.Optional(t.Nullable(t.String())),
      }),
    },
  )

  .delete(
    "/videos/:id",
    async ({ params }) => {
      await db.delete(videos).where(eq(videos.id, params.id));
      await deleteMedia(params.id);
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  )

  // --- Range-aware video streaming -----------------------------------------
  .get(
    "/videos/:id/stream",
    async ({ params, request, set }) => {
      const [row] = await db.select().from(videos).where(eq(videos.id, params.id));
      if (!row) return ((set.status = 404), { error: "Not found" });

      const file = Bun.file(row.storagePath);
      const size = file.size;
      const type = contentTypeFor(row.originalName);
      const range = request.headers.get("range");

      // Return explicit Response objects so Elysia's return-value serialisation
      // cannot override content-type (files have no extension → octet-stream) or
      // drop the 206 status on the range slice path.
      const base = { "accept-ranges": "bytes", "content-type": type };

      // Parse requested range (default to the full file).
      const [startStr, endStr] = (range ?? "bytes=0-").replace("bytes=", "").split("-");
      const start = Number(startStr);
      const end = endStr ? Number(endStr) : size - 1;
      const chunkSize = end - start + 1;

      // createReadStream with explicit start/end is the reliable way to serve
      // a byte slice — BunFile.slice() does not honour the offset correctly
      // when serialised as a Response body, causing playback to stall once the
      // browser's initial buffer is exhausted.
      const nodeStream = createReadStream(row.storagePath, { start, end });
      const body = Readable.toWeb(nodeStream) as ReadableStream;

      return new Response(body, {
        status: range ? 206 : 200,
        headers: {
          ...base,
          "content-length": String(chunkSize),
          ...(range ? { "content-range": `bytes ${start}-${end}/${size}` } : {}),
        },
      });
    },
    { params: t.Object({ id: t.String() }) },
  )

  // --- Waveform peaks -------------------------------------------------------
  .get(
    "/videos/:id/peaks",
    async ({ params, set }) => {
      const file = Bun.file(mediaPaths.peaks(params.id));
      if (!(await file.exists())) return ((set.status = 404), { error: "No peaks yet" });
      set.headers["content-type"] = "application/json";
      return file;
    },
    { params: t.Object({ id: t.String() }) },
  )

  // --- Trigger / re-run analysis -------------------------------------------
  .post(
    "/videos/:id/analyze",
    async ({ params, body }) => {
      const jobId = await enqueueAnalysis(params.id, body ?? {});
      return { jobId };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Optional(
        t.Object({
          approach: t.Optional(t.Union([t.Literal("peak"), t.Literal("spectral"), t.Literal("hybrid")])),
          sensitivity: t.Optional(t.Number()),
          refractoryMs: t.Optional(t.Number()),
          beepFreqMinHz: t.Optional(t.Number()),
          beepFreqMaxHz: t.Optional(t.Number()),
          beepMinMs: t.Optional(t.Number()),
        }),
      ),
    },
  )

  // --- Markers for a video --------------------------------------------------
  .get(
    "/videos/:id/markers",
    async ({ params }) => {
      const rows = await db
        .select()
        .from(markersTable)
        .where(eq(markersTable.videoId, params.id))
        .orderBy(markersTable.tSeconds);
      return rows.map(toMarker);
    },
    { params: t.Object({ id: t.String() }) },
  )

  .post(
    "/videos/:id/markers",
    async ({ params, body }) => {
      const [row] = await db
        .insert(markersTable)
        .values({
          videoId: params.id,
          kind: body.kind ?? "shot",
          tSeconds: body.tSeconds,
          confidence: null,
          source: "manual",
          isIgnored: false,
        })
        .returning();
      return toMarker(row!);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        kind: t.Optional(t.Union([t.Literal("beep"), t.Literal("shot")])),
        tSeconds: t.Number(),
      }),
    },
  )

  // --- Computed stage results ----------------------------------------------
  .get(
    "/videos/:id/results",
    async ({ params }) => {
      const rows = await db
        .select()
        .from(markersTable)
        .where(eq(markersTable.videoId, params.id))
        .orderBy(markersTable.tSeconds);
      return computeResults(rows.map(toMarker));
    },
    { params: t.Object({ id: t.String() }) },
  );
