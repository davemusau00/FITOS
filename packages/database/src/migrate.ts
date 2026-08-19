import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./client.js";

const { db, pool } = createDatabase();

try {
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
  process.stdout.write("FITOS migrations applied.\n");
} finally {
  await pool.end();
}
