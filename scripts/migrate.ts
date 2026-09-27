import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, closeDb } from "../src/db/client";

try {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.info("Database migrations applied.");
} catch (error) {
  console.error(
    "Database migration failed.",
    error instanceof Error ? { name: error.name } : {},
  );
  process.exitCode = 1;
} finally {
  await closeDb();
}
