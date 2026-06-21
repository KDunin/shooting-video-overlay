import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "../config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

const sql = postgres(config.databaseUrl, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder });
console.log("Migrations applied.");
await sql.end();
