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
  },
  "forked-path": {
    language: "cpp14",
    timeLimitMs: 1000,
    memoryLimitMb: 64,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "17 29\n", expected: "LEFT\n" },
      { id: "02", input: "42 7\n", expected: "RIGHT\n" },
      { id: "03", input: "11 11\n", expected: "EQUAL\n" },
      { id: "04", input: "-1000000000 1000000000\n", expected: "LEFT\n" },
      { id: "05", input: "999999999 -999999999\n", expected: "RIGHT\n" }
    ]
  },
  "echo-loop": {
    language: "cpp14",
    timeLimitMs: 1000,
    memoryLimitMb: 64,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "5\n", expected: "1 2 3 4 5\n" },
      { id: "02", input: "1\n", expected: "1\n" },
      { id: "03", input: "2\n", expected: "1 2\n" },
      {
        id: "04",
        input: "10\n",
        expected: "1 2 3 4 5 6 7 8 9 10\n"
      },
      {
        id: "05",
        input: "20\n",
        expected: "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20\n"
      }
    ]
  }
};
