import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import * as schema from "./schema";

/** Raw postgres-js client — also used for the migration bootstrap. */
export const sql = postgres(config.databaseUrl, { max: 10 });

export const db = drizzle(sql, { schema });

export { schema };
