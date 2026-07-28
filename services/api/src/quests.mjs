export const questPrerequisites = Object.freeze({
  "signal-fire": [],
  "forked-path": ["signal-fire"],
  "echo-loop": ["forked-path"],
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
