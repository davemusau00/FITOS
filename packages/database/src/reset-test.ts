import "dotenv/config";
import { sql } from "drizzle-orm";
import { createDatabase } from "./client.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl || !/(test|ci)/i.test(databaseUrl)) {
  throw new Error(
    "Refusing to reset a database unless TEST_DATABASE_URL names a test/ci database."
  );
}

const { db, pool } = createDatabase(databaseUrl);
try {
  await db.execute(sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  process.stdout.write("Test database schema reset. Run db:migrate before tests that need it.\n");
} finally {
  await pool.end();
}
