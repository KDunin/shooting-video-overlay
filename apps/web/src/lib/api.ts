import { treaty } from "@elysiajs/eden";
import type { App } from "api/src/index";
import { env } from "./envs";

export const api = treaty<App>(env.VITE_BASE_URL + "/api");
