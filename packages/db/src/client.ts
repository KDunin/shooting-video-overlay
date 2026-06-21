import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

export const db = drizzle(process.env.DATABASE_URL, { schema });

export type DB = typeof db;
