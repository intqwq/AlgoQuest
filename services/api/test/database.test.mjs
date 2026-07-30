import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createEditorialListQuery,
  createRateLimitQuery,
  createSaveProgressQuery,
  mapPlayer,
} from "../src/database.mjs";

test("editorial list SQL never leaves unused PostgreSQL parameters", () => {
  const player = createEditorialListQuery({
    questId: "signal-fire",
    viewerId: "af8b337a-0985-4805-b76c-612e8055d141",
  });
  assert.deepEqual(player.values, [
    "signal-fire",
    "af8b337a-0985-4805-b76c-612e8055d141",
  ]);
  assert.match(player.text, /p\.quest_id = \$1/);
  assert.match(player.text, /p\.author_id = \$2/);

  const moderatorQuest = createEditorialListQuery({
    questId: "signal-fire",
    viewerId: "unused",
    includeModeration: true,
  });
  assert.deepEqual(moderatorQuest.values, ["signal-fire"]);
  assert.match(moderatorQuest.text, /p\.quest_id = \$1/);
  assert.doesNotMatch(moderatorQuest.text, /\$2/);

  const queue = createEditorialListQuery({
    viewerId: "unused",
    includeModeration: true,
    status: "pending",
  });
  assert.deepEqual(queue.values, ["pending"]);
  assert.match(queue.text, /p\.status = \$1/);

  const byId = createEditorialListQuery({
    viewerId: "unused",
    includeModeration: true,
  });
  assert.deepEqual(byId.values, []);
  assert.doesNotMatch(byId.text, /\$\d+/);
});

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

test("editorial insert gives its reused author parameter one UUID type", async () => {
  const database = await readFile(
    new URL("../src/database.mjs", import.meta.url),
    "utf8",
  );
  const createPost = database.match(
    /async createEditorialPost\([\s\S]*?async moderateEditorialPost/,
  )?.[0];

  assert.ok(createPost);
  assert.equal(createPost.match(/\$3::uuid/g)?.length, 2);
  assert.doesNotMatch(createPost, /THEN \$3 END/);
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

test("authenticated player payload retains the database role", () => {
  assert.deepEqual(
    mapPlayer({
      id: "player-id",
      display_name: "INLINEINT",
      email: "owner@example.com",
      email_verified_at: new Date(),
      is_guest: false,
      role: "owner",
    }),
    {
      id: "player-id",
      displayName: "INLINEINT",
      email: "owner@example.com",
      emailVerified: true,
      isGuest: false,
      role: "owner",
    },
  );
});

test("map layout migration stores durable collision-free coordinates", async () => {
  const migration = await readFile(
    new URL("../migrations/005_quest_map_layout.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS quest_map_layout/);
  assert.match(migration, /quest_id varchar\(96\) PRIMARY KEY/);
  assert.match(migration, /CHECK \(x BETWEEN 2 AND 98\)/);
  assert.match(migration, /CHECK \(y BETWEEN 2 AND 98\)/);
});

test("editorial migration separates discussions, solutions and moderation state", async () => {
  const migration = await readFile(
    new URL("../migrations/006_editorial.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS editorial_posts/);
  assert.match(migration, /kind IN \('discussion', 'solution'\)/);
  assert.match(migration, /status IN \('pending', 'published', 'rejected'\)/);
  assert.match(migration, /author_id uuid NOT NULL REFERENCES users/);
  assert.match(migration, /moderated_by uuid REFERENCES users/);
});

test("editorial routes enforce submission, clear and moderator requirements", async () => {
  const server = await readFile(
    new URL("../src/server.mjs", import.meta.url),
    "utf8",
  );
  assert.match(server, /QUEST_SUBMISSION_REQUIRED/);
  assert.match(server, /QUEST_CLEAR_REQUIRED/);
  assert.match(server, /moderator \? "published" : "pending"/);
  assert.match(server, /requireAdmin\(player\)[\s\S]*moderateEditorialPost/);
});
