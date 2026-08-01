import type { Locale } from "@/lib/i18n";
import type { Quest } from "@/lib/quests";

export type StoryScene = {
  mode: "cinematic" | "dialogue" | "knowledge" | "mission";
  speaker: string;
  text: string;
  note?: string;
  glyph: string;
  effect: "pulse" | "drift" | "scan" | "shake" | "rise";
};

type Theme = {
  speaker: string;
  glyph: string;
  effect: StoryScene["effect"];
  stage: string;
};

const themes: Record<string, Theme> = {
  "signal-fire": { speaker: "MIRA // RELAY KEEPER", glyph: "((  •  ))", effect: "pulse", stage: "DORMANT RELAY" },
  "forked-path": { speaker: "LYRA // PATHFINDER", glyph: "<==  ?  ==>", effect: "drift", stage: "TWIN TUNNELS" },
  "echo-loop": { speaker: "ECHO // CLOCKWORK SPRITE", glyph: "1 2 3 ... ∞", effect: "scan", stage: "RESONANCE HALL" },
  "array-vault": { speaker: "VAULT-7 // ARCHIVIST", glyph: "[ ][ ][ ][ ]", effect: "scan", stage: "MEMORY VAULT" },
  "sorting-ruins": { speaker: "RUNE // RESTORER", glyph: "7 2 9 → 2 7 9", effect: "drift", stage: "SHUFFLED RUINS" },
  "binary-gate": { speaker: "HALF // GATE SENTINEL", glyph: "|<--- • --->|", effect: "shake", stage: "BINARY GATE" },
  "prefix-beacon": { speaker: "SIGMA // BEACON AI", glyph: "Σ[1..r] - Σ[1..l)", effect: "pulse", stage: "RANGE BEACON" },
  "stack-sentinel": { speaker: "BRACKET // SENTINEL", glyph: "{ [ ( • ) ] }", effect: "rise", stage: "SEAL CHAMBER" },
  "grid-rescue": { speaker: "NOVA // RESCUE DRONE", glyph: "S · · # · T", effect: "scan", stage: "FLOODED GRID" },
  "dijkstra-citadel": { speaker: "DIJK // CARTOGRAPHER", glyph: "1 --2--> 3 --5--> n", effect: "drift", stage: "WEIGHTED CITADEL" },
  "union-forge": { speaker: "ROOT // FORGE CORE", glyph: "{1,2} ∪ {3,4}", effect: "shake", stage: "ALLIANCE FORGE" },
  "topological-crown": { speaker: "CROWN // DEPENDENCY ORACLE", glyph: "A → B → C", effect: "rise", stage: "ORDER THRONE" },
  "recursive-mirror": { speaker: "RECURSA // MIRROR WITCH", glyph: "f(n) ↘ f(n/2)", effect: "pulse", stage: "INFINITE MIRROR" },
  "greedy-caravan": { speaker: "SAFI // CARAVAN MASTER", glyph: "[--] [---] [--]", effect: "drift", stage: "SAND GATE" },
  "knapsack-forge": { speaker: "DP-0 // FORGE MIND", glyph: "W: [0 1 2 ...]", effect: "shake", stage: "STATE FORGE" },
  "lis-observatory": { speaker: "ALTAIR // SIGNAL WATCHER", glyph: "↗  ↗    ↗", effect: "rise", stage: "LIS OBSERVATORY" },
  "mst-skybridge": { speaker: "KRUSKAL // BRIDGEWRIGHT", glyph: "○—○   ○—○", effect: "drift", stage: "FLOATING ARCHIPELAGO" },
  "fenwick-pulse": { speaker: "BIT // PULSE ENGINE", glyph: "i += i & -i", effect: "pulse", stage: "INDEXED REACTOR" },
  "segment-bastion": { speaker: "NODE // BASTION CORE", glyph: "[1..n] / \\ [L] [R]", effect: "scan", stage: "SEGMENT BASTION" },
  "lca-oracle": { speaker: "ANCESTOR // TREE ORACLE", glyph: "u ↗ LCA ↖ v", effect: "rise", stage: "ANCIENT CANOPY" },
  "scc-nexus": { speaker: "KOSA // NEXUS PILOT", glyph: "A ⇄ B → C ⇄ D", effect: "shake", stage: "CYCLIC NEXUS" },
  "maxflow-reactor": { speaker: "DINIC // REACTOR HEART", glyph: "SOURCE ≫≫ SINK", effect: "pulse", stage: "FINAL CIRCUIT" },
};

const fallbackTheme: Theme = {
  speaker: "CODEX // FIELD GUIDE",
  glyph: "< QUEST DATA >",
  effect: "scan",
  stage: "UNKNOWN ENCOUNTER",
};

const storyLabels: Record<Locale, { system: string; codex: string; mission: string; rule: string }> = {
  en: { system: "WORLD SYSTEM", codex: "CODEX TRANSMISSION", mission: "MISSION CONTROL", rule: "CORE IDEA" },
  "zh-CN": { system: "世界系统", codex: "知识库传输", mission: "任务控制", rule: "核心知识" },
  ja: { system: "ワールドシステム", codex: "CODEX 通信", mission: "ミッション管制", rule: "核心知識" },
};

export function buildQuestStory(quest: Quest, locale: Locale): StoryScene[] {
  const problem = quest.problem;
  if (!problem) return [];
  const theme = themes[quest.id] ?? fallbackTheme;
  const labels = storyLabels[locale];
  return [
    {
      mode: "cinematic",
      speaker: labels.system,
      text: problem.story[0] ?? quest.description,
      note: theme.stage,
      glyph: theme.glyph,
      effect: theme.effect,
    },
    {
      mode: "dialogue",
      speaker: theme.speaker,
      text: problem.story[1] ?? problem.guidance[0],
      note: quest.subtitle,
      glyph: theme.glyph,
      effect: theme.effect,
    },
    {
      mode: "knowledge",
      speaker: labels.codex,
      text: problem.guidance[0],
      note: `${labels.rule} // ${quest.skills.slice(0, 3).join(" · ")}`,
      glyph: `{ C++14 }
  ↓
[ idea ]`,
      effect: "scan",
    },
    {
      mode: "mission",
      speaker: labels.mission,
      text: problem.guidance.slice(1).join(" "),
      note: `${problem.testCaseCount} TESTS // +${quest.xp} XP`,
      glyph: `READY?
> ENTER_`,
      effect: "rise",
    },
  ];
}
