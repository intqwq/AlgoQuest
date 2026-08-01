import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { communityCategories } from "../src/routes/community-routes.mjs";

test("community categories have unique ids and complete locale labels", () => {
  assert.ok(communityCategories.length >= 4);
  assert.equal(new Set(communityCategories.map((item) => item.id)).size, communityCategories.length);
  for (const category of communityCategories) {
    assert.match(category.id, /^[a-z][a-z0-9-]+$/);
    assert.ok(category.label.en && category.label["zh-CN"] && category.label.ja);
  }
});

test("community migration and routes preserve scoped moderation and user discovery", async () => {
  const [migration, routes, database, learning, server] = await Promise.all([
    readFile(new URL("../migrations/102_community_hub.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/community-routes.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/database.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/learning-router.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/server.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /scope IN \('quest', 'oj', 'community'\)/);
  assert.match(routes, /OJ_ACCEPTED_REQUIRED/);
  assert.match(routes, /community_post:user/);
  assert.match(database, /searchPublicPlayers/);
  assert.match(database, /author_handle/);
  assert.match(learning, /profileContributions/);
  assert.match(server, /handlePublicCommunityRoutes/);
  assert.match(server, /handlePlayerCommunityRoutes/);
});
