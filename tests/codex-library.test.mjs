import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Codex contains a complete learning path linked to campaign quests", async () => {
  const data = await read("lib/codex.ts");

  const questIds = [
    "signal-fire",
    "forked-path",
    "echo-loop",
    "array-vault",
    "sorting-ruins",
    "binary-gate",
    "prefix-beacon",
    "stack-sentinel",
    "grid-rescue",
    "dijkstra-citadel",
    "union-forge",
    "topological-crown",
  ];

  for (const questId of questIds) {
    assert.match(data, new RegExp(`questId: "${questId}"`));
  }
  assert.equal(
    data.match(
      /id: "(?:io-arithmetic|branching|iteration|arrays-traversal|sorting|binary-search|prefix-sums|stack|bfs|dijkstra|dsu|topological-sort)"/g,
    )?.length,
    12,
  );
  assert.match(data, /timeComplexity/);
  assert.match(data, /spaceComplexity/);
  assert.match(data, /checkpoints/);
});

test("Codex UI supports search, managed entries, progress and quest launch", async () => {
  const [component, admin, client, page, css] = await Promise.all([
    read("components/codex-library.tsx"),
    read("components/admin-console.tsx"),
    read("lib/api-client.ts"),
    read("app/page.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(component, /id="codex"/);
  assert.match(component, /type="search"/);
  assert.match(component, /codexCategories\.map/);
  assert.match(component, /discoveredCount/);
  assert.match(component, /loadPublishedCodexEntries/);
  assert.match(component, /algoquest:codex-updated/);
  assert.match(component, /REFERENCE IMPLEMENTATION \/\/ C\+\+14/);
  assert.match(component, /onOpenQuest\(selected\.questId\)/);
  assert.match(
    page,
    /import \{ CodexLibrary \} from "@\/components\/codex-library"/,
  );
  assert.match(page, /<CodexLibrary/);
  assert.match(css, /\.codex-section/);
  assert.match(css, /\.codex-layout/);
  assert.match(css, /\.codex-reader/);
  assert.match(admin, /tab === "codex"/);
  assert.match(admin, /saveAdminCodexEntry/);
  assert.match(admin, /deleteAdminCodexEntry/);
  assert.match(client, /\/admin\/codex/);
  assert.match(client, /loadPublishedCodexEntries/);
});
