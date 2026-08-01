export type Player = {
  id: string;
  displayName: string;
  email: string | null;
  emailVerified: boolean;
  isGuest: boolean;
  role: "player" | "admin" | "owner";
};

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

export type Dashboard = {
  metrics: {
    clearedCount: number;
    submissionCount: number;
    acceptedCount: number;
    acceptanceRate: number;
    currentStreak: number;
    longestStreak: number;
    totalXp: number;
    unlockedHiddenCount: number;
  };
  goal: {
    dailyMinutes: number;
    weeklyQuestTarget: number;
    todayMinutes: number;
    completionPercent: number;
  };
  timeline: Array<{ day: string; submissions: number; minutes: number }>;
  recommendation: { questId: string | null; title: string; reason: string };
  weakAreas: Array<{ questId: string; misses: number; accepted: number }>;
  achievements: Achievement[];
};

export type PublicProfile = {
  handle: string;
  bio: string;
  isPublic: boolean;
  showCode: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Submission = {
  id: string;
  judgeSubmissionId: string;
  questId: string;
  status: string;
  verdict: string | null;
  score: number;
  language: string;
  mode: "sample" | "submit";
  details: Record<string, unknown>;
  source?: string;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionPage = {
  submissions: Submission[];
  pagination: { page: number; limit: number; total: number; pages: number };
  statistics: {
    total: number;
    accepted: number;
    acceptanceRate: number;
    averageScore: number;
    averageTimeMs: number;
    verdictCounts: Record<string, number>;
    trend: Array<{ day: string; total: number; accepted: number }>;
  };
};

export type DiffResult = {
  current: Submission;
  baseline: Submission | null;
  operations: Array<{ type: "equal" | "add" | "remove"; line: string }>;
  summary: { added: number; removed: number; unchanged: number };
};

export type QuestDraft = {
  id: string;
  questId: string;
  title: string;
  publicDefinition: Record<string, unknown>;
  judgeDefinition: Record<string, unknown>;
  revision: number;
  status: string;
  updatedAt: string;
};

export type QuestVersion = {
  questId: string;
  version: number;
  publicDefinition: Record<string, unknown>;
  judgeDefinition: Record<string, unknown>;
  note: string;
  createdAt: string;
};

export type UnlockRule = {
  questId: string;
  enabled: boolean;
  label: string;
  rule: Record<string, unknown>;
  updatedAt: string;
};

export type CodexEntry = {
  id: string;
  category: string;
  questId: string;
  marker: string;
  title: Record<string, string>;
  summary: Record<string, string>;
  explanation: Record<string, string>;
  checkpoints: Array<Record<string, string>>;
  timeComplexity: string;
  spaceComplexity: string;
  tags: string[];
  code: string;
  published: boolean;
  sortOrder: number;
};

