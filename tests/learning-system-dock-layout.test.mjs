import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Learning OS stays clear of quest and OJ submit controls", async () => {
  const [dock, layout] = await Promise.all([
    read("components/learning-system-dock.tsx"),
    read("components/learning-system-dock-layout.module.css"),
  ]);

  assert.match(dock, /dockLayoutStyles\.launcher/);
  assert.match(dock, /dockLayoutStyles\.shell/);
  assert.match(layout, /body:has\(\.oj-submit-code\)/);
  assert.match(layout, /body:has\(\.mission-actions\)/);
  assert.match(layout, /safe-area-inset-bottom/);
  assert.match(layout, /@media \(max-width: 720px\)/);
});
