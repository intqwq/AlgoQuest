export const quests = {
  "signal-fire": {
    language: "cpp14",
    timeLimitMs: 1000,
    memoryLimitMb: 64,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "7 35\n", expected: "42\n" },
      { id: "02", input: "-19 8\n", expected: "-11\n" },
      { id: "03", input: "1000000000 1000000000\n", expected: "2000000000\n" },
      { id: "04", input: "-1000000000 1000000000\n", expected: "0\n" }
    ]
  }
};
