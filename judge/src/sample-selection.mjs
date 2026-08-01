export function selectedQuest(quest, mode, sampleIndex = 0) {
  if (mode !== "sample") return quest;
  const explicitSamples = quest.tests.filter((test) => test.sample === true);
  const samples = explicitSamples.length ? explicitSamples : quest.tests;
  if (!Number.isInteger(sampleIndex) || sampleIndex < 0 || sampleIndex >= samples.length) {
    throw new Error("UNKNOWN_SAMPLE");
  }
  return {
    ...quest,
    passScore: 100,
    diagnostics: true,
    tests: [samples[sampleIndex]],
  };
}
