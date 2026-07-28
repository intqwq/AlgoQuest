export type QuestStatus = "available" | "locked" | "secret";

export type Quest = {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  xp: number;
  status: QuestStatus;
  chapter: string;
  gridArea: string;
  description: string;
  skills: string[];
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
    chapter: "CH.01 / AWAKENING",
    gridArea: "q1",
    description:
      "Wake the dormant relay by reading two energy values and printing their sum.",
    skills: ["cin / cout", "variables", "arithmetic"],
  },
  {
    id: "forked-path",
    index: "02",
    title: "Forked Path",
    subtitle: "Conditionals",
    difficulty: 1,
    xp: 140,
    status: "available",
    chapter: "CH.01 / AWAKENING",
    gridArea: "q2",
    description:
      "Choose the safer tunnel by comparing two danger readings.",
    skills: ["if / else", "comparison"],
  },
  {
    id: "echo-loop",
    index: "03",
    title: "Echo Loop",
    subtitle: "Iteration",
    difficulty: 1,
    xp: 160,
    status: "locked",
    chapter: "CH.01 / AWAKENING",
    gridArea: "q3",
    description: "Repeat the ancient signal until the gate responds.",
    skills: ["for", "while"],
  },
  {
    id: "array-vault",
    index: "04",
    title: "Array Vault",
    subtitle: "Linear containers",
    difficulty: 2,
    xp: 220,
    status: "locked",
    chapter: "CH.02 / FIRST DATA",
    gridArea: "q4",
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
    chapter: "CH.02 / FIRST DATA",
    gridArea: "q5",
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
    chapter: "CH.02 / FIRST DATA",
    gridArea: "q6",
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
    chapter: "SECRET / UNKNOWN",
    gridArea: "secret",
    description: "The wall sounds hollow here. Something waits behind it.",
    skills: ["???"],
  },
];

