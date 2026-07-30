export const questPrerequisites = Object.freeze({
  "signal-fire": [],
  "forked-path": ["signal-fire"],
  "echo-loop": ["forked-path"],
  "array-vault": ["echo-loop"],
  "sorting-ruins": ["array-vault"],
  "binary-gate": ["sorting-ruins"],
  "prefix-beacon": ["binary-gate"],
  "stack-sentinel": ["binary-gate"],
  "grid-rescue": ["prefix-beacon", "stack-sentinel"],
  "dijkstra-citadel": ["grid-rescue"],
  "union-forge": ["dijkstra-citadel"],
  "topological-crown": ["union-forge"],
});

export function missingPrerequisites(questId, progress) {
  const prerequisites = questPrerequisites[questId];
  if (!prerequisites) return undefined;
  const cleared = new Set(
    progress
      .filter((item) => item.status === "cleared")
      .map((item) => item.questId),
  );
  return prerequisites.filter((quest) => !cleared.has(quest));
}
