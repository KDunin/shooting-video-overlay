import { z } from "zod";

export const envs = z.object({
  VITE_BASE_URL: z.url(),
  PROD: z.boolean(),
  DEV: z.boolean(),
});

export type Env = z.infer<typeof envs>;

export const env = envs.parse(import.meta.env);
