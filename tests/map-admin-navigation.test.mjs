import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("quest map exposes a larger canvas and wider layout range", async () => {
  const [map, layout, css] = await Promise.all([
    read("components/quest-map.tsx"),
    read("lib/map-layout.ts"),
    read("app/globals.css"),
  ]);

  assert.match(map, /canvas = \{ width: 1800, height: 1050 \}/);
  assert.match(map, /panLimit/);
  assert.doesNotMatch(map, /Math\.max\(-360/);
  assert.match(layout, /minX: 5/);
  assert.match(layout, /maxX: 95/);
  assert.match(layout, /minY: 7/);
  assert.match(layout, /maxY: 93/);
  assert.match(css, /\.quest-map-viewport \{\s*height: 760px/);
  assert.match(css, /\.quest-map-canvas \{\s*width: 1800px;\s*height: 1050px/);
});

test("control deck is a manager-only top navigation tab", async () => {
  const [page, account] = await Promise.all([
    read("app/page.tsx"),
    read("components/account-panel.tsx"),
  ]);

  assert.match(page, /const canManage = player\?\.role === "admin" \|\| player\?\.role === "owner"/);
  assert.match(page, /className="topbar-admin-tab"/);
  assert.match(page, /algoquest:open-admin/);
  assert.match(page, /\{canManage && \(/);
  assert.doesNotMatch(account, /\[ \{copy\.controlDeck\} \]/);
});
