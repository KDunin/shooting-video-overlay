import { Elysia, t } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { Logger } from "./lib/logger";

const app = new Elysia()
  .decorate("logger", new Logger())
  .use(openapi())
  .get(
    "/health",
    () => ({
      status: "OK" as const,
    }),
    {
      response: t.Object({
        status: t.Literal("OK"),
      }),
    },
  )
  .listen(3001);

export type App = typeof app;

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
