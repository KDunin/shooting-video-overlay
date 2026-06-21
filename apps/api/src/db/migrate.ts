import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "../config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

// Extract the database name and build a URL pointing at the maintenance DB so
// we can CREATE the target database if it doesn't exist yet (idempotent).
const url = new URL(config.databaseUrl);
const dbName = url.pathname.slice(1);
const maintenanceUrl = new URL(config.databaseUrl);
maintenanceUrl.pathname = "/postgres";

const admin = postgres(maintenanceUrl.toString(), { max: 1 });
await admin.unsafe(`CREATE DATABASE "${dbName}"`).catch((e: { code?: string }) => {
  if (e.code !== "42P04") throw e; // 42P04 = duplicate_database, already exists
});
await admin.end();

const sql = postgres(config.databaseUrl, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder });
console.log("Migrations applied.");
await sql.end();
