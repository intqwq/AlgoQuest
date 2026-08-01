import type { Quest } from "@/lib/quests";
import type { CodexEntry } from "@/lib/codex";

export type Player = {
  id: string;
  displayName: string;
  email: string | null;
  emailVerified: boolean;
  isGuest: boolean;
  role: "player" | "admin" | "owner";
  learningProfile: {
    hasCppFoundation: boolean;
    hasAlgorithmFoundation: boolean;
    configured: boolean;
  };
  tutorialCompleted: boolean;
  recommendedQuestId: string;
};

export type QuestStoryProgress = {
  questId: string;
  completedAt: string;
};

type SessionResponse = {
  sessionToken: string;
  player: Player;
};

export type AuthConfig = {
  turnstileSiteKey: string;
  emailDelivery: "resend" | "local-log";
  registrationEnabled: boolean;
  maintenanceMessage: string;
};

export type ManagedPlayer = Player & {
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  clearedCount: number;
  submissionCount: number;
};

export type JudgeQuestDefinition = {
  language: "cpp14";
  timeLimitMs: number;
  memoryLimitMb: number;
  compileLimitMs: number;
  passScore: number;
  tests: Array<{ id: string; input: string; expected: string }>;
};

export type AdminQuestRecord = {
  id: string;
  publicDefinition: Quest;
  judgeDefinition: JudgeQuestDefinition | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ManagedCodexEntry = CodexEntry & {
  published: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type EditorialKind = "discussion" | "solution";
export type EditorialStatus = "pending" | "published" | "rejected";
export type EditorialContentFormat = "plain" | "tiptap-json-v1";

export type EditorialPost = {
  id: string;
  questId: string;
  kind: EditorialKind;
  title: string;
  content: string;
  contentFormat: EditorialContentFormat;
  status: EditorialStatus;
  author: {
    id: string;
    displayName: string;
    role: Player["role"];
  };
  createdAt: string;
  updatedAt: string;
  moderatedAt: string | null;
};

export type EditorialEligibility = {
  discussion: boolean;
  solution: boolean;
  directPublish: boolean;
};

export type OjProblemStatus = "pending" | "published" | "rejected" | "archived";

export type OjTagCategory = {
  id: string;
  label: { en: string; "zh-CN": string; ja: string };
  tags: string[];
};

export type OjTestCase = {
  id?: string;
  input: string;
  expected: string;
  sample: boolean;
};

export type OjProblemSummary = {
  publicId: number;
  title: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  difficulty: number;
  tags: string[];
  author: { id: string; displayName: string };
  submissionCount: number;
  acceptedCount: number;
  createdAt: string;
  publishedAt: string | null;
};

export type OjProblem = OjProblemSummary & {
  statement: string;
  statementFormat: EditorialContentFormat;
  samples: Array<{ id: string; input: string; output: string }>;
};

export type OjProblemDraft = {
  id: string;
  publicId: number | null;
  status: OjProblemStatus;
  title: string;
  statement: string;
  statementFormat: EditorialContentFormat;
  timeLimitMs: number;
  memoryLimitMb: number;
  difficulty: number;
  tags: string[];
  tests: OjTestCase[];
  stdSource: string;
  reviewNote: string;
  author: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};

export type OjProblemInput = {
  title: string;
  statement: string;
  statementFormat: EditorialContentFormat;
  timeLimitMs: number;
  memoryLimitMb: number;
  difficulty: number;
  tags: string[];
  tests: OjTestCase[];
  stdSource: string;
};

export type JudgeSubmissionState = {
  id: string;
  status: "QUEUED" | "COMPILING" | "RUNNING" | "DONE" | "ERROR";
  queuePosition?: number;
  pollAfterMs?: number;
  verdict?: "AC" | "WA" | "CE" | "RE" | "TLE" | "MLE" | "OLE" | "JE";
  score?: number;
  compilerOutput?: string;
  error?: string;
  cases: Array<{
    id: string;
    verdict: string;
    timeMs?: number;
    memoryKb?: number;
    input?: string;
    expected?: string;
    received?: string;
    stderr?: string;
    exitCode?: number;
    signal?: number;
  }>;
};

export type ServerOverview = {
  settings: {
    registrationEnabled: boolean;
    judgeEnabled: boolean;
    maintenanceMessage: string;
    submissionCooldownSeconds: number;
    updatedAt: string;
  };
  statistics: {
    players: number;
    admins: number;
    owners: number;
    submissions: number;
    accepted: number;
    quests: number;
    databaseBytes: number;
  };
  runtime: {
    node: string;
    platform: string;
    architecture: string;
    uptimeSeconds: number;
    judge: Record<string, unknown>;
  };
};

export type QuestProgress = {
  questId: string;
  status: "started" | "cleared";
  bestScore: number;
  updatedAt: string;
};

export type QuestDraft = {
  questId: string;
  source: string;
  updatedAt: string;
};

export type SaveSubmission = {
  id: string;
  judgeSubmissionId: string;
  questId: string;
  status: string;
  verdict: string | null;
  score: number;
  source: string;
  language: string;
  mode: "sample" | "submit";
  details: {
    cases?: Array<{
      id: string;
      verdict: string;
      timeMs: number;
      memoryKb: number;
    }>;
    compilerOutput?: string;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type PlayerSave = {
  version: 2;
  accountId: string;
  updatedAt: string;
  progress: QuestProgress[];
  drafts: QuestDraft[];
  submissions: SaveSubmission[];
};

export class AuthApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

const apiBase = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1"
).replace(/\/$/, "");
const sessionStorageKey = "algoquest.session-token";
const pendingGuestSessionKey = "algoquest.pending-guest-session";
let sessionPromise: Promise<string> | undefined;
const transientApiStatuses = new Set([429, 502, 503, 504]);

async function retryingFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  attempts = 3,
) {
  let response: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      response = await fetch(input, init);
      if (
        !transientApiStatuses.has(response.status) ||
        attempt === attempts - 1
      ) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
    }
    await new Promise((resolve) =>
      window.setTimeout(resolve, 300 * 2 ** attempt),
    );
  }
  if (response) return response;
  throw lastError ?? new Error("API request failed.");
}

export function apiUrl(path: string) {
  return `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
}

function storeSession(session: SessionResponse) {
  window.localStorage.setItem(sessionStorageKey, session.sessionToken);
  window.dispatchEvent(
    new CustomEvent("algoquest:session", { detail: session.player }),
  );
  return session.player;
}

function forgetSession() {
  window.localStorage.removeItem(sessionStorageKey);
}

async function createSession() {
  const response = await fetch(apiUrl("/sessions"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: "INLINEINT" }),
  });
  if (!response.ok) {
    throw new Error(`Session API returned HTTP ${response.status}.`);
  }
  const body = (await response.json()) as SessionResponse;
  storeSession(body);
  return body.sessionToken;
}

export async function ensureSession() {
  const existing = window.localStorage.getItem(sessionStorageKey);
  if (existing) return existing;
  sessionPromise ??= createSession().finally(() => {
    sessionPromise = undefined;
  });
  return sessionPromise;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const existing = window.localStorage.getItem(sessionStorageKey);
  if (!existing) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const request = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const response = await request(existing);
  if (response.status !== 401) return response;

  forgetSession();
  window.dispatchEvent(
    new CustomEvent("algoquest:session", { detail: undefined }),
  );
  return response;
}

async function parseAuthResponse(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<SessionResponse>;
  if (!response.ok) {
    throw new AuthApiError(body.error ?? "AUTH_REQUEST_FAILED", response.status);
  }
  return body;
}

async function authPost(
  path: string,
  payload: Record<string, unknown>,
  { includeSession = true }: { includeSession?: boolean } = {},
) {
  const headers = new Headers({ "content-type": "application/json" });
  const token = includeSession
    ? window.localStorage.getItem(sessionStorageKey)
    : null;
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  return parseAuthResponse(response);
}

export async function loadAuthConfig(): Promise<AuthConfig> {
  try {
    const response = await retryingFetch(apiUrl("/auth/config"), {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new AuthApiError("AUTH_CONFIG_UNAVAILABLE", response.status);
    }
    return response.json() as Promise<AuthConfig>;
  } catch (error) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError("AUTH_CONFIG_UNAVAILABLE", 0);
  }
}

export async function loadCurrentPlayer(): Promise<Player | undefined> {
  const token = window.localStorage.getItem(sessionStorageKey);
  if (!token) return undefined;
  const response = await retryingFetch(apiUrl("/me"), {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401) {
    forgetSession();
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Player API returned HTTP ${response.status}.`);
  }
  const body = (await response.json()) as { player: Player };
  return body.player;
}

export async function loadQuestCatalog(): Promise<{
  quests: Quest[];
  archivedQuestIds: string[];
  mapLayout: Record<string, { x: number; y: number }>;
}> {
  const response = await retryingFetch(apiUrl("/quests"), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return { quests: [], archivedQuestIds: [], mapLayout: {} };
  const body = (await response.json()) as {
    quests?: Quest[];
    archivedQuestIds?: string[];
    mapLayout?: Record<string, { x: number; y: number }>;
  };
  return {
    quests: Array.isArray(body.quests) ? body.quests : [],
    archivedQuestIds: Array.isArray(body.archivedQuestIds)
      ? body.archivedQuestIds
      : [],
    mapLayout:
      body.mapLayout && typeof body.mapLayout === "object"
        ? body.mapLayout
        : {},
  };
}

export async function loadPublishedCodexEntries() {
  const response = await retryingFetch(apiUrl("/codex"), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { entries?: ManagedCodexEntry[] };
  return Array.isArray(body.entries) ? body.entries : [];
}

async function adminJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(apiUrl(path), init);
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;
  if (!response.ok) {
    throw new AuthApiError(body.error ?? "ADMIN_REQUEST_FAILED", response.status);
  }
  return body;
}

export async function loadManagedPlayers(query = "") {
  const body = await adminJson<{ users: ManagedPlayer[] }>(
    `/admin/users?query=${encodeURIComponent(query)}`,
    { headers: { accept: "application/json" } },
  );
  return body.users;
}

export async function updateManagedPlayer(
  playerId: string,
  update: {
    displayName: string;
    emailVerified: boolean;
    role: "player" | "admin";
  },
) {
  const body = await adminJson<{ player: ManagedPlayer }>(
    `/admin/users/${encodeURIComponent(playerId)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update),
    },
  );
  return body.player;
}

export async function loadAdminQuests() {
  const body = await adminJson<{ quests: AdminQuestRecord[] }>("/admin/quests", {
    headers: { accept: "application/json" },
  });
  return body.quests;
}

export async function loadAdminCodexEntries() {
  const body = await adminJson<{ entries: ManagedCodexEntry[] }>(
    "/admin/codex",
    { headers: { accept: "application/json" } },
  );
  return body.entries;
}

export async function saveAdminCodexEntry(
  entry: ManagedCodexEntry,
  create: boolean,
) {
  const body = await adminJson<{ entry: ManagedCodexEntry }>(
    create
      ? "/admin/codex"
      : `/admin/codex/${encodeURIComponent(entry.id)}`,
    {
      method: create ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    },
  );
  return body.entry;
}

export async function deleteAdminCodexEntry(entryId: string) {
  await adminJson<Record<string, never>>(
    `/admin/codex/${encodeURIComponent(entryId)}`,
    { method: "DELETE" },
  );
}

export async function saveAdminQuest(
  questId: string,
  publicDefinition: Quest,
  judgeDefinition: JudgeQuestDefinition | null,
  create: boolean,
) {
  const body = await adminJson<{ quest: AdminQuestRecord }>(
    create ? "/admin/quests" : `/admin/quests/${encodeURIComponent(questId)}`,
    {
      method: create ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: questId,
        publicDefinition,
        judgeDefinition,
      }),
    },
  );
  return body.quest;
}

export async function archiveAdminQuest(questId: string) {
  await adminJson<Record<string, never>>(
    `/admin/quests/${encodeURIComponent(questId)}`,
    { method: "DELETE" },
  );
}

export async function saveQuestMapLayout(
  positions: Array<{ id: string; x: number; y: number }>,
) {
  const body = await adminJson<{
    mapLayout: Record<string, { x: number; y: number }>;
  }>("/admin/quest-map-layout", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ positions }),
  });
  return body.mapLayout;
}

export async function loadQuestEditorial(questId: string) {
  return adminJson<{
    posts: EditorialPost[];
    eligibility: EditorialEligibility;
  }>(`/editorial/quests/${encodeURIComponent(questId)}`, {
    headers: { accept: "application/json" },
  });
}

export async function createEditorialPost(
  questId: string,
  input: {
    kind: EditorialKind;
    title: string;
    content: string;
    contentFormat: EditorialContentFormat;
  },
) {
  const body = await adminJson<{ post: EditorialPost }>(
    `/editorial/quests/${encodeURIComponent(questId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return body.post;
}

export async function loadEditorialModeration(status: EditorialStatus = "pending") {
  const body = await adminJson<{ posts: EditorialPost[] }>(
    `/admin/editorial?status=${encodeURIComponent(status)}`,
    { headers: { accept: "application/json" } },
  );
  return body.posts;
}

export async function moderateEditorialPost(
  postId: string,
  status: Extract<EditorialStatus, "published" | "rejected">,
) {
  const body = await adminJson<{ post: EditorialPost }>(
    `/admin/editorial/${encodeURIComponent(postId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  return body.post;
}

export async function loadOjTags() {
  const response = await retryingFetch(apiUrl("/oj/tags"), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new AuthApiError("OJ_TAGS_UNAVAILABLE", response.status);
  const body = (await response.json()) as { tags?: string[]; categories?: OjTagCategory[] };
  return {
    tags: Array.isArray(body.tags) ? body.tags : [],
    categories: Array.isArray(body.categories) ? body.categories : [],
  };
}

export async function loadOjProblems(filters: {
  query?: string;
  difficulty?: number;
  tag?: string;
  page?: number;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.difficulty) params.set("difficulty", String(filters.difficulty));
  if (filters.tag) params.set("tag", filters.tag);
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 30));
  const response = await retryingFetch(apiUrl(`/oj/problems?${params}`), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new AuthApiError("OJ_INDEX_UNAVAILABLE", response.status);
  return response.json() as Promise<{
    problems: OjProblemSummary[];
    total: number;
    page: number;
    limit: number;
  }>;
}

export async function loadOjProblem(publicId: number) {
  const response = await retryingFetch(apiUrl(`/oj/problems/${publicId}`), {
    headers: { accept: "application/json" },
  });
  const body = (await response.json().catch(() => ({}))) as {
    problem?: OjProblem;
    error?: string;
  };
  if (!response.ok || !body.problem) {
    throw new AuthApiError(body.error ?? "OJ_PROBLEM_UNAVAILABLE", response.status);
  }
  return body.problem;
}

export async function submitOjProblem(input: OjProblemInput) {
  const body = await adminJson<{ problem: OjProblemDraft }>("/oj/problems", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return body.problem;
}

export async function resubmitOjProblem(problemId: string, input: OjProblemInput) {
  const body = await adminJson<{ problem: OjProblemDraft }>(
    `/oj/drafts/${encodeURIComponent(problemId)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return body.problem;
}

export async function loadMyOjProblems() {
  const body = await adminJson<{ problems: OjProblemDraft[] }>("/oj/mine", {
    headers: { accept: "application/json" },
  });
  return body.problems;
}

export async function loadOjModeration(status: OjProblemStatus = "pending") {
  const body = await adminJson<{ problems: OjProblemDraft[] }>(
    `/admin/oj/problems?status=${encodeURIComponent(status)}`,
    { headers: { accept: "application/json" } },
  );
  return body.problems;
}

export async function moderateOjProblem(
  problemId: string,
  status: Extract<OjProblemStatus, "published" | "rejected">,
  reviewNote: string,
) {
  const body = await adminJson<{ problem: OjProblemDraft }>(
    `/admin/oj/problems/${encodeURIComponent(problemId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, reviewNote }),
    },
  );
  return body.problem;
}

export async function adminUpdateOjProblem(problemId: string, input: OjProblemInput) {
  const body = await adminJson<{ problem: OjProblemDraft }>(
    `/admin/oj/problems/${encodeURIComponent(problemId)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return body.problem;
}

export async function archiveOjProblem(problemId: string) {
  const body = await adminJson<{ problem: OjProblemDraft }>(
    `/admin/oj/problems/${encodeURIComponent(problemId)}/archive`,
    { method: "POST" },
  );
  return body.problem;
}

export async function deleteOjProblem(problemId: string) {
  await adminJson(`/admin/oj/problems/${encodeURIComponent(problemId)}`, {
    method: "DELETE",
  });
}

export async function submitOjSolution(
  publicId: number,
  source: string,
  options: { mode?: "sample" | "submit"; sampleIndex?: number } = {},
) {
  const body = await adminJson<{ submission: JudgeSubmissionState }>(
    `/oj/problems/${publicId}/submissions`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source, mode: options.mode ?? "submit", sampleIndex: options.sampleIndex }),
    },
  );
  return body.submission;
}

export async function loadJudgeSubmission(submissionId: string) {
  const body = await adminJson<{ submission: JudgeSubmissionState }>(
    `/judge/submissions/${encodeURIComponent(submissionId)}`,
    { headers: { accept: "application/json" } },
  );
  return body.submission;
}

export async function loadServerOverview() {
  return adminJson<ServerOverview>("/owner/server", {
    headers: { accept: "application/json" },
  });
}

export async function updateServerSettings(
  settings: Omit<ServerOverview["settings"], "updatedAt">,
) {
  const body = await adminJson<{
    settings: ServerOverview["settings"];
  }>("/owner/server", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(settings),
  });
  return body.settings;
}

export async function requireCurrentPlayer(): Promise<Player> {
  const player = await loadCurrentPlayer();
  if (!player) throw new AuthApiError("UNAUTHORIZED", 401);
  return player;
}

export async function loadPlayerSave(): Promise<PlayerSave> {
  let response = await authenticatedFetch(apiUrl("/me/save"), {
    headers: { accept: "application/json" },
  });
  for (
    let attempt = 0;
    transientApiStatuses.has(response.status) && attempt < 2;
    attempt += 1
  ) {
    await new Promise((resolve) =>
      window.setTimeout(resolve, 300 * 2 ** attempt),
    );
    response = await authenticatedFetch(apiUrl("/me/save"), {
      headers: { accept: "application/json" },
    });
  }
  if (!response.ok) {
    throw new Error(`Save API returned HTTP ${response.status}.`);
  }
  const body = (await response.json()) as { save: PlayerSave };
  return body.save;
}

export async function registerAccount(input: {
  displayName: string;
  email: string;
  password: string;
  turnstileToken: string;
  hasCppFoundation: boolean;
  hasAlgorithmFoundation: boolean;
}) {
  await ensureSession();
  await authPost("/auth/register", input);
  return requireCurrentPlayer();
}

export async function loginAccount(input: {
  email: string;
  password: string;
  turnstileToken: string;
}) {
  const previousToken = window.localStorage.getItem(sessionStorageKey);
  const body = await authPost("/auth/login", input);
  const player = storeSession(body as SessionResponse);
  if (previousToken && previousToken !== (body as SessionResponse).sessionToken) {
    window.localStorage.setItem(pendingGuestSessionKey, previousToken);
  }
  return player;
}

export async function resendVerification(input: {
  email: string;
  turnstileToken: string;
}) {
  await authPost("/auth/resend-verification", input);
}

export async function verifyEmail(token: string) {
  const body = await authPost(
    "/auth/verify-email",
    { token },
    { includeSession: false },
  );
  return storeSession(body as SessionResponse);
}

export async function requestPasswordReset(input: {
  email: string;
  turnstileToken: string;
}) {
  await authPost("/auth/forgot-password", input);
}

export async function resetPassword(input: {
  token: string;
  password: string;
  turnstileToken: string;
}) {
  const body = await authPost(
    "/auth/reset-password",
    input,
    { includeSession: false },
  );
  return storeSession(body as SessionResponse);
}

export async function updatePlayerProfile(input: {
  displayName: string;
  hasCppFoundation: boolean;
  hasAlgorithmFoundation: boolean;
}) {
  const response = await authenticatedFetch(apiUrl("/me/profile"), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await parseAuthResponse(response);
  const player = (body as unknown as { player: Player }).player;
  window.dispatchEvent(
    new CustomEvent("algoquest:session", { detail: player }),
  );
  return player;
}

export async function completeWebTutorial() {
  const response = await authenticatedFetch(apiUrl("/me/learning/tutorial"), {
    method: "PUT",
  });
  const body = await parseAuthResponse(response);
  const player = (body as unknown as { player: Player }).player;
  window.dispatchEvent(
    new CustomEvent("algoquest:session", { detail: player }),
  );
  return player;
}

export async function loadQuestStoryProgress(): Promise<QuestStoryProgress[]> {
  const response = await authenticatedFetch(apiUrl("/me/learning/stories"), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Story progress API returned HTTP ${response.status}.`);
  }
  const body = (await response.json()) as { stories: QuestStoryProgress[] };
  return body.stories;
}

export async function completeQuestStory(questId: string) {
  const response = await authenticatedFetch(
    apiUrl(`/me/learning/stories/${encodeURIComponent(questId)}`),
    { method: "PUT" },
  );
  if (!response.ok) {
    throw new Error(`Story progress API returned HTTP ${response.status}.`);
  }
  const body = (await response.json()) as { story: QuestStoryProgress };
  return body.story;
}

export async function logoutAccount() {
  const token = window.localStorage.getItem(sessionStorageKey);
  if (token) {
    await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  forgetSession();
  window.localStorage.removeItem(pendingGuestSessionKey);
}

export async function loadQuestProgress(): Promise<QuestProgress[]> {
  const response = await authenticatedFetch(apiUrl("/me/progress"), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Progress API returned HTTP ${response.status}.`);
  }
  const body = (await response.json()) as { progress: QuestProgress[] };
  return body.progress;
}

export async function saveQuestProgress(questId: string, score: number) {
  const response = await authenticatedFetch(
    apiUrl(`/me/progress/${encodeURIComponent(questId)}`),
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "cleared", score }),
    },
  );
  if (!response.ok) {
    throw new Error(`Progress API returned HTTP ${response.status}.`);
  }
}

export async function saveQuestDraft(questId: string, source: string) {
  const response = await authenticatedFetch(
    apiUrl(`/me/drafts/${encodeURIComponent(questId)}`),
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source }),
    },
  );
  if (!response.ok) {
    throw new Error(`Draft API returned HTTP ${response.status}.`);
  }
  const body = (await response.json()) as { draft: QuestDraft };
  return body.draft;
}

export async function resolvePlayerSave(
  choice: "local" | "cloud",
  localSave: PlayerSave,
) {
  const guestToken = window.localStorage.getItem(pendingGuestSessionKey);
  const response = await authenticatedFetch(apiUrl("/me/save/resolve"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      choice,
      guestToken,
      localSave: {
        clearedQuestIds: localSave.progress
          .filter((item) => item.status === "cleared")
          .map((item) => item.questId),
        drafts: localSave.drafts.map(({ questId, source }) => ({
          questId,
          source,
        })),
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Save resolution returned HTTP ${response.status}.`);
  }
  window.localStorage.removeItem(pendingGuestSessionKey);
  const body = (await response.json()) as { save: PlayerSave };
  return body.save;
}
