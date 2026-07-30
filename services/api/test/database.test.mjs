import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createRateLimitQuery,
  createSaveProgressQuery,
} from "../src/database.mjs";

test("rate-limit SQL uses a contiguous, explicitly typed parameter list", () => {
  const query = createRateLimitQuery("guest_session:ip", "203.0.113.8", 3600);
  const parameterIndexes = [
    ...new Set(
      [...query.text.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])),
    ),
  ].sort((left, right) => left - right);

  assert.deepEqual(parameterIndexes, [1, 2, 3]);
  assert.equal(Math.max(...parameterIndexes), query.values.length);
  assert.equal(query.values[0], "guest_session:ip");
  assert.match(query.values[1], /^[a-f0-9]{64}$/);
  assert.equal(query.values[2], 3600);
  assert.match(query.text, /\$3::integer/);
});

test("progress SQL gives every reused parameter one PostgreSQL type", () => {
  const query = createSaveProgressQuery(
    "af8b337a-0985-4805-b76c-612e8055d141",
    "signal-fire",
    "cleared",
    100,
  );
  assert.match(query.text, /\$1::uuid/);
  assert.match(query.text, /\$2::varchar\(96\)/);
  assert.equal(query.text.match(/\$3::varchar\(16\)/g)?.length, 2);
  assert.match(query.text, /\$4::integer/);
  assert.equal(query.values.length, 4);
});

test("player save migration retains source snapshots and per-quest drafts", async () => {
  const migration = await readFile(
    new URL("../migrations/003_player_saves.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /ADD COLUMN IF NOT EXISTS source_code text/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS quest_drafts/);
  assert.match(migration, /PRIMARY KEY \(user_id, quest_id\)/);
});

test("admin migration adds protected roles, quest management and server controls", async () => {
  const migration = await readFile(
    new URL("../migrations/004_roles_admin.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /role varchar\(16\).*DEFAULT 'player'/);
  assert.match(migration, /CHECK \(role IN \('player', 'admin', 'owner'\)\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS quest_catalog/);
  assert.match(migration, /judge_definition jsonb/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS server_settings/);
  assert.match(migration, /submission_cooldown_seconds integer NOT NULL DEFAULT 5/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS submission_cooldowns/);
});
