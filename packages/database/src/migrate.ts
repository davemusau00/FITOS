import "dotenv/config";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./client.js";

const { db, pool } = createDatabase();

try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  process.stdout.write("FITOS migrations applied.\n");
} finally {
  await pool.end();
}
