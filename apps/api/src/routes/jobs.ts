import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { analysisJobs } from "../db/schema";
import { toJob } from "../serializers";

export const jobRoutes = new Elysia({ name: "jobs" }).get(
  "/jobs/:id",
  async ({ params, set }) => {
    const [row] = await db.select().from(analysisJobs).where(eq(analysisJobs.id, params.id));
    if (!row) return ((set.status = 404), { error: "Not found" });
    return toJob(row);
  },
  { params: t.Object({ id: t.String() }) },
);
