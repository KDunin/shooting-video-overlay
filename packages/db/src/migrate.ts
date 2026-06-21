import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { join } from "path";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const db = drizzle(process.env.DATABASE_URL);

console.log("Running migrations...");
await migrate(db, { migrationsFolder: join(import.meta.dir, "../migrations") });
console.log("Migrations complete.");

process.exit(0);
