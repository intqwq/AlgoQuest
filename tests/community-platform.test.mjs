import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("community and personal page are localized top-level destinations", async () => {
  const [page, community, profile, publicProfile, css] = await Promise.all([
    read("app/page.tsx"),
    read("components/community-hub.tsx"),
    read("components/profile-hub.tsx"),
    read("app/player/[handle]/page.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(page, /portal === "community"/);
  assert.match(page, /portal === "profile"/);
  assert.match(page, /<CommunityHub/);
  assert.match(page, /<ProfileHub/);
  assert.match(community, /en:[\s\S]*"zh-CN":[\s\S]*ja:/);
  assert.match(community, /searchCommunityUsers/);
  assert.match(community, /EditorialComposer/);
  assert.match(profile, /loadMyPublicProfile/);
  assert.match(profile, /AUTHORED OJ PROBLEMS/);
  assert.match(publicProfile, /loadPublicPlayer/);
  assert.match(publicProfile, /contributions\.problems/);
  assert.match(css, /\.community-shell/);
  assert.match(css, /\.profile-shell/);
});

test("OJ editorials expose rich solutions, discussions, and profile links", async () => {
  const [hub, editorial, questEditorial, api] = await Promise.all([
    read("components/oj-hub.tsx"),
    read("components/oj-editorial.tsx"),
    read("components/editorial-panel.tsx"),
    read("lib/api-client.ts"),
  ]);
  assert.match(hub, /<OjEditorial/);
  assert.match(editorial, /createOjEditorialPost/);
  assert.match(editorial, /EditorialComposer/);
  assert.match(editorial, /\/player\/\$\{post\.author\.handle\}/);
  assert.match(questEditorial, /profile-link/);
  assert.match(api, /loadOjEditorial/);
  assert.match(api, /createCommunityPost/);
});
