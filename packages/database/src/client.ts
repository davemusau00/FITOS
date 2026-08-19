import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type FitosDatabase = ReturnType<typeof createDatabase>["db"];

export function createDatabase(connectionString = process.env.DATABASE_URL): {
  db: ReturnType<typeof drizzle<typeof schema>>;
  pool: Pool;
} {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create the FITOS database client.");
  }

  const pool = new Pool({ connectionString, max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  return { db, pool };
}
