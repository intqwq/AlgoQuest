import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { createDatabase, migrateWithRetry } from "../src/database.mjs";

const databaseUrl = process.env.TEST_DATABASE_URL;

test(
  "tracked migrations apply to a real PostgreSQL database exactly once",
  { skip: !databaseUrl },
  async () => {
    const database = createDatabase(databaseUrl);
    await migrateWithRetry(database, 1);
    await database.ping();
    const settings = await database.getServerSettings();
    assert.equal(typeof settings.judgeEnabled, "boolean");
    await database.close();

    const pool = new pg.Pool({ connectionString: databaseUrl });
    const first = await pool.query(
      "SELECT filename, checksum FROM schema_migrations ORDER BY filename",
    );
    assert.ok(first.rowCount >= 10);
    assert.ok(first.rows.every((row) => /^[a-f0-9]{64}$/.test(row.checksum)));

    const secondDatabase = createDatabase(databaseUrl);
    await migrateWithRetry(secondDatabase, 1);
    await secondDatabase.close();
    const second = await pool.query("SELECT count(*)::integer AS count FROM schema_migrations");
    assert.equal(second.rows[0].count, first.rowCount);
    await pool.end();
  },
);
