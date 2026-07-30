export type QuestStatus = "available" | "locked" | "secret";

export type QuestProblem = {
  story: string[];
  guidance: string[];
  input: string;
  constraints: string;
  output: string;
  sampleInput: string;
  sampleOutput: string;
  hint: string;
  hintMarker: string;
  hintCode: string;
  starterCode: string;
  testCaseCount: number;
  timeLimitSeconds: number;
  memoryLimitMb: number;
};

export type Quest = {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  xp: number;
  status: QuestStatus;
  prerequisites: string[];
  chapter: string;
  gridArea: string;
  mapPosition: { x: number; y: number };
  description: string;
  skills: string[];
  problem?: QuestProblem;
};

export const quests: Quest[] = [
  {
    id: "signal-fire",
    index: "01",
    title: "Signal Fire",
    subtitle: "Input, output & arithmetic",
    difficulty: 1,
    xp: 120,
    status: "available",
    prerequisites: [],
    chapter: "CH.01 / AWAKENING",
    gridArea: "q1",
    mapPosition: { x: 13, y: 28 },
    description:
      "Wake the dormant relay by reading two energy values and printing their sum.",
    skills: ["cin / cout", "variables", "arithmetic"],
    problem: {
      story: [
        "The outpost relay has slept for 4,096 cycles. Two energy cells remain, carrying a and b units.",
        "Read both values and output their sum to ignite the signal fire.",
      ],
      guidance: [
        "Read the mission story and locate the INPUT, OUTPUT and SAMPLE panels.",
        "Find the TODO marker in main.cpp. The editor autosaves every change.",
        "Replace the TODO with a cout statement, then use RUN SAMPLE.",
        "When the sample passes, use SUBMIT SOLUTION to run every hidden case.",
        "After AC, close the congratulations card and return to the map.",
      ],
      input: "One line containing two integers a and b.",
      constraints: "-10⁹ ≤ a, b ≤ 10⁹",
      output: "Print one integer: the combined energy.",
      sampleInput: "7 35",
      sampleOutput: "42",
      hint: "The relay listens through cout. Send it the value of a + b.",
      hintMarker: "    // TODO: transmit the combined energy",
      hintCode: "    cout << a + b << '\\n';",
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long a, b;
    cin >> a >> b;

    // TODO: transmit the combined energy

    return 0;
}`,
      testCaseCount: 4,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  },
  {
    id: "forked-path",
    index: "02",
    title: "Forked Path",
    subtitle: "Conditionals",
    difficulty: 1,
    xp: 140,
    status: "locked",
    prerequisites: ["signal-fire"],
    chapter: "CH.01 / AWAKENING",
    gridArea: "q2",
    mapPosition: { x: 34, y: 25 },
    description:
      "Choose the safer tunnel by comparing two danger readings.",
    skills: ["if / else", "comparison"],
    problem: {
      story: [
        "The road divides beneath the mountain. The left and right tunnels report separate danger readings.",
        "Choose the tunnel with the smaller reading. If both readings match, hold position.",
      ],
      guidance: [
        "List the three possible relationships: left is smaller, right is smaller, or equal.",
        "Use if / else if / else so exactly one answer is printed.",
        "Run the sample first, then submit to check all edge cases.",
      ],
      input: "One line containing two integers left and right.",
      constraints: "-10⁹ ≤ left, right ≤ 10⁹",
      output:
        'Print "LEFT" if left is safer, "RIGHT" if right is safer, or "EQUAL" if they match.',
      sampleInput: "17 29",
      sampleOutput: "LEFT",
      hint:
        "Compare the readings with if and else if. Remember the equality case.",
      hintMarker: "    // TODO: choose the safer tunnel",
      hintCode: `    if (left < right) cout << "LEFT\\n";
    else if (right < left) cout << "RIGHT\\n";
    else cout << "EQUAL\\n";`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long left, right;
    cin >> left >> right;

    // TODO: choose the safer tunnel

    return 0;
}`,
      testCaseCount: 5,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  },
  {
    id: "echo-loop",
    index: "03",
    title: "Echo Loop",
    subtitle: "Iteration",
    difficulty: 1,
    xp: 160,
    status: "locked",
    prerequisites: ["forked-path"],
    chapter: "CH.01 / AWAKENING",
    gridArea: "q3",
    mapPosition: { x: 56, y: 30 },
    description: "Repeat the ancient signal until the gate responds.",
    skills: ["for", "while"],
    problem: {
      story: [
        "A sealed gate accepts a rising sequence of pulses, beginning at one.",
        "Transmit every pulse from 1 through n on one line, separated by spaces.",
      ],
      guidance: [
        "Identify the first value, last value and repeated step.",
        "Use a for or while loop and handle spaces without adding unwanted text.",
        "Run the sample, then submit to evaluate every hidden value of n.",
      ],
      input: "One integer n.",
      constraints: "1 ≤ n ≤ 1,000",
      output: "Print 1, 2, …, n on one line, separated by one space.",
      sampleInput: "5",
      sampleOutput: "1 2 3 4 5",
      hint:
        "A for loop can visit every value from 1 through n. Print a space only before values after the first.",
      hintMarker: "    // TODO: repeat the pulse",
      hintCode: `    for (int i = 1; i <= n; ++i) {
        if (i > 1) cout << ' ';
        cout << i;
    }
    cout << '\\n';`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    // TODO: repeat the pulse

    return 0;
}`,
      testCaseCount: 5,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  },
  {
    id: "array-vault",
    index: "04",
    title: "Array Vault",
    subtitle: "Linear containers",
    difficulty: 2,
    xp: 220,
    status: "locked",
    prerequisites: ["echo-loop"],
    chapter: "CH.02 / FIRST DATA",
    gridArea: "q4",
    mapPosition: { x: 27, y: 67 },
    description: "Reconstruct a key hidden across a sequence of memory cells.",
    skills: ["arrays", "traversal"],
  },
  {
    id: "sorting-ruins",
    index: "05",
    title: "Sorting Ruins",
    subtitle: "Ordering",
    difficulty: 2,
    xp: 260,
    status: "locked",
    prerequisites: ["array-vault"],
    chapter: "CH.02 / FIRST DATA",
    gridArea: "q5",
    mapPosition: { x: 52, y: 66 },
    description: "Restore a shattered archive by returning every rune to order.",
    skills: ["sort", "complexity"],
  },
  {
    id: "binary-gate",
    index: "06",
    title: "Binary Gate",
    subtitle: "Divide the search",
    difficulty: 2,
    xp: 300,
    status: "locked",
    prerequisites: ["sorting-ruins"],
    chapter: "CH.02 / FIRST DATA",
    gridArea: "q6",
    mapPosition: { x: 76, y: 72 },
    description: "Find one frequency among millions before the gate closes.",
    skills: ["binary search", "invariants"],
  },
  {
    id: "nameless-room",
    index: "??",
    title: "Nameless Room",
    subtitle: "Hidden encounter",
    difficulty: 3,
    xp: 500,
    status: "secret",
    prerequisites: [],
    chapter: "SECRET / UNKNOWN",
    gridArea: "secret",
    mapPosition: { x: 84, y: 24 },
    description: "The wall sounds hollow here. Something waits behind it.",
    skills: ["???"],
  },
];

export function isQuestUnlocked(quest: Quest, cleared: Set<string>) {
  return (
    quest.status !== "secret" &&
    quest.problem !== undefined &&
    quest.prerequisites.every((questId) => cleared.has(questId))
  );
}
