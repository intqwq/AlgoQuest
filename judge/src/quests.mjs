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
  },
  "array-vault": {
    language: "cpp14",
    timeLimitMs: 1000,
    memoryLimitMb: 64,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "6\n-9 14 3 14 -2 8\n", expected: "14\n" },
      { id: "02", input: "1\n-2147483648\n", expected: "-2147483648\n" },
      { id: "03", input: "5\n-8 -3 -19 -4 -11\n", expected: "-3\n" },
      { id: "04", input: "7\n0 0 0 0 0 0 0\n", expected: "0\n" },
      { id: "05", input: "4\n2147483647 -1 7 42\n", expected: "2147483647\n" }
    ]
  },
  "sorting-ruins": {
    language: "cpp14",
    timeLimitMs: 1000,
    memoryLimitMb: 64,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "5\n8 -1 8 3 0\n", expected: "-1 0 3 8 8\n" },
      { id: "02", input: "1\n42\n", expected: "42\n" },
      { id: "03", input: "6\n6 5 4 3 2 1\n", expected: "1 2 3 4 5 6\n" },
      { id: "04", input: "5\n-2 -2 -9 0 -2\n", expected: "-9 -2 -2 -2 0\n" },
      { id: "05", input: "4\n1000000000 -1000000000 7 6\n", expected: "-1000000000 6 7 1000000000\n" }
    ]
  },
  "binary-gate": {
    language: "cpp14",
    timeLimitMs: 1000,
    memoryLimitMb: 64,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "7 4\n1 2 4 4 4 9 12\n", expected: "3\n" },
      { id: "02", input: "1 8\n8\n", expected: "1\n" },
      { id: "03", input: "5 0\n1 2 3 4 5\n", expected: "-1\n" },
      { id: "04", input: "6 -3\n-3 -3 -1 0 2 9\n", expected: "1\n" },
      { id: "05", input: "6 9\n-3 -1 0 2 9 9\n", expected: "5\n" },
      { id: "06", input: "4 10\n1 3 7 9\n", expected: "-1\n" }
    ]
  },
  "prefix-beacon": {
    language: "cpp14",
    timeLimitMs: 1000,
    memoryLimitMb: 96,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "5 3\n2 -1 4 7 3\n1 3\n2 5\n4 4\n", expected: "5\n13\n7\n" },
      { id: "02", input: "1 2\n-9\n1 1\n1 1\n", expected: "-9\n-9\n" },
      { id: "03", input: "4 3\n0 0 0 0\n1 4\n2 3\n4 4\n", expected: "0\n0\n0\n" },
      { id: "04", input: "5 2\n1000000000 1000000000 1000000000 1000000000 1000000000\n1 5\n2 4\n", expected: "5000000000\n3000000000\n" },
      { id: "05", input: "6 3\n3 -5 8 -2 7 -9\n1 6\n3 5\n2 2\n", expected: "2\n13\n-5\n" }
    ]
  },
  "stack-sentinel": {
    language: "cpp14",
    timeLimitMs: 1000,
    memoryLimitMb: 64,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "{[()()]}\n", expected: "YES\n" },
      { id: "02", input: "(\n", expected: "NO\n" },
      { id: "03", input: "([)]\n", expected: "NO\n" },
      { id: "04", input: "()[]{}\n", expected: "YES\n" },
      { id: "05", input: "}{\n", expected: "NO\n" },
      { id: "06", input: "{{[[(())]]}}\n", expected: "YES\n" }
    ]
  },
  "grid-rescue": {
    language: "cpp14",
    timeLimitMs: 2000,
    memoryLimitMb: 128,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "4 5\nS...#\n##..#\n...#.\n...T.\n", expected: "6\n" },
      { id: "02", input: "1 2\nST\n", expected: "1\n" },
      { id: "03", input: "2 2\nS#\n#T\n", expected: "-1\n" },
      { id: "04", input: "3 4\nS...\n.##.\n...T\n", expected: "5\n" },
      { id: "05", input: "5 5\nS....\n####.\n.....\n.####\n....T\n", expected: "16\n" }
    ]
  },
  "dijkstra-citadel": {
    language: "cpp14",
    timeLimitMs: 2000,
    memoryLimitMb: 192,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "5 6\n1 2 4\n1 3 2\n3 2 1\n2 5 7\n3 4 5\n4 5 1\n", expected: "8\n" },
      { id: "02", input: "2 1\n1 2 0\n", expected: "0\n" },
      { id: "03", input: "4 2\n1 2 5\n3 4 7\n", expected: "-1\n" },
      { id: "04", input: "4 3\n1 2 1000000000\n2 3 1000000000\n3 4 1000000000\n", expected: "3000000000\n" },
      { id: "05", input: "6 7\n1 2 8\n1 3 2\n3 4 2\n4 2 1\n2 6 3\n4 5 9\n5 6 1\n", expected: "8\n" }
    ]
  },
  "union-forge": {
    language: "cpp14",
    timeLimitMs: 2000,
    memoryLimitMb: 128,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "5 6\nU 1 2\nQ 1 3\nU 2 3\nQ 1 3\nQ 4 5\nQ 2 2\n", expected: "NO\nYES\nNO\nYES\n" },
      { id: "02", input: "1 2\nQ 1 1\nU 1 1\n", expected: "YES\n" },
      { id: "03", input: "4 5\nU 1 2\nU 3 4\nQ 2 4\nU 2 3\nQ 1 4\n", expected: "NO\nYES\n" },
      { id: "04", input: "6 6\nQ 1 6\nU 1 6\nQ 1 6\nU 2 5\nQ 2 5\nQ 3 4\n", expected: "NO\nYES\nYES\nNO\n" },
      { id: "05", input: "5 7\nU 1 2\nU 2 3\nU 3 4\nU 4 5\nQ 1 5\nQ 2 4\nQ 1 1\n", expected: "YES\nYES\nYES\n" }
    ]
  },
  "topological-crown": {
    language: "cpp14",
    timeLimitMs: 2000,
    memoryLimitMb: 160,
    compileLimitMs: 15000,
    tests: [
      { id: "01", input: "5 4\n1 3\n2 3\n3 4\n2 5\n", expected: "1 2 3 4 5\n" },
      { id: "02", input: "1 0\n", expected: "1\n" },
      { id: "03", input: "4 0\n", expected: "1 2 3 4\n" },
      { id: "04", input: "4 3\n1 4\n2 4\n3 4\n", expected: "1 2 3 4\n" },
      { id: "05", input: "6 6\n1 4\n1 5\n2 5\n3 5\n4 6\n5 6\n", expected: "1 2 3 4 5 6\n" }
    ]
  }
};
