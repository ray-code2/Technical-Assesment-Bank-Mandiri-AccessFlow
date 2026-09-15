import fs from "node:fs/promises";
import path from "node:path";
import { rawPool } from "./db.js";

async function migrate() {
  const migrationsDirectory = process.env.MIGRATIONS_DIR
    ? path.resolve(process.env.MIGRATIONS_DIR)
    : path.resolve(process.cwd(), "../database/migrations");
  const files = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await rawPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const filename of files) {
    const existing = await rawPool.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1",
      [filename],
    );
    if (existing.rowCount) continue;

    const sql = await fs.readFile(path.join(migrationsDirectory, filename), "utf8");
    const client = await rawPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`Applied migration: ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate()
  .then(() => rawPool.end())
  .catch(async (error) => {
    console.error("Migration failed", error);
    await rawPool.end();
    process.exit(1);
  });
