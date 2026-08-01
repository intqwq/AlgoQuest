import { readFile } from "node:fs/promises";

const partNames = Array.from({ length: 8 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const parts = await Promise.all(
  partNames.map((name) =>
    readFile(
      new URL(`./learning-extension.parts/${name}.jsfrag`, import.meta.url),
      "utf8",
    ),
  ),
);

const authUrl = new URL("./auth.mjs", import.meta.url).href;
const pgUrl = import.meta.resolve("pg");
const source = parts
  .join("")
  .replace('from "pg";', `from ${JSON.stringify(pgUrl)};`)
  .replace(
    'from "./auth.mjs";',
    `from ${JSON.stringify(authUrl)};`,
  );
const loaded = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

export const computeStreak = loaded.computeStreak;
export const evaluateRule = loaded.evaluateRule;
export const diffLines = loaded.diffLines;
export const ensureQuestRuleAccess = loaded.ensureQuestRuleAccess;

