import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { join } from "path";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.slice(1);
url.pathname = "/postgres";

const admin = new SQL(url.toString());
await admin.unsafe(`CREATE DATABASE "${dbName}"`).catch((e: { code?: string }) => {
  if (e.code !== "42P04") throw e;
});
await admin.close();

const db = drizzle(process.env.DATABASE_URL);
await migrate(db, { migrationsFolder: join(import.meta.dir, "../migrations") });
console.log("Migrations complete.");

process.exit(0);
