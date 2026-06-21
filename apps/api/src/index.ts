import { Elysia, t } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { config } from "./config";
import { Logger } from "./lib/logger";
import { jobRoutes } from "./routes/jobs";
import { markerRoutes } from "./routes/markers";
import { videoRoutes } from "./routes/videos";
import { ensureMediaDirs } from "./services/storage";

const logger = new Logger();

await ensureMediaDirs();
logger.log("media dirs ready");

const app = new Elysia()
  .decorate("logger", logger)
  .use(openapi())
  .get(
    "/health",
    () => ({ status: "OK" as const }),
    { response: t.Object({ status: t.Literal("OK") }) },
  )
  .use(videoRoutes)
  .use(markerRoutes)
  .use(jobRoutes)
  .listen(config.port);

export type App = typeof app;

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
