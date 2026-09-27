import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { getEnv } from "@/config/env";

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: getEnv().DATABASE_URL, max: 10 });
  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  database ??= drizzle(getPool(), { schema });
  return database;
}

export async function closeDb(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
  database = undefined;
}
