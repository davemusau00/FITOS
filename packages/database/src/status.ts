import "dotenv/config";
import { sql } from "drizzle-orm";
import { createDatabase } from "./client.js";

const { db, pool } = createDatabase();

try {
  const result = await db.execute(sql`
    SELECT id, hash, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at ASC
  `);
  process.stdout.write(`${JSON.stringify(result.rows, null, 2)}\n`);
} catch (error) {
  if (error instanceof Error && error.message.includes("drizzle.__drizzle_migrations")) {
    process.stdout.write("No migrations have been applied.\n");
  } else {
    throw error;
  }
} finally {
  await pool.end();
}
