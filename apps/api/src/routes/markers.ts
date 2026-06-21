import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "db";
import { markers } from "db";
import { toMarker } from "../serializers";

export const markerRoutes = new Elysia({ name: "markers" })
  // Nudge a marker's time or toggle its ignored flag.
  .patch(
    "/markers/:id",
    async ({ params, body, set }) => {
      const patch: Partial<typeof markers.$inferInsert> = { updatedAt: new Date() };
      if (body.tSeconds !== undefined) patch.tSeconds = body.tSeconds;
      if (body.isIgnored !== undefined) patch.isIgnored = body.isIgnored;

      const [row] = await db.update(markers).set(patch).where(eq(markers.id, params.id)).returning();
      if (!row) return ((set.status = 404), { error: "Not found" });
      return toMarker(row);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        tSeconds: t.Optional(t.Number()),
        isIgnored: t.Optional(t.Boolean()),
      }),
    },
  )

  .delete(
    "/markers/:id",
    async ({ params }) => {
      await db.delete(markers).where(eq(markers.id, params.id));
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  );
