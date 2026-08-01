import crypto from "node:crypto";
import pg from "pg";
import { bearerToken, hashToken } from "./auth.mjs";

const { Pool } = pg;
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://algoquest:algoquest@127.0.0.1:5432/algoquest";
const pool = new Pool({
  connectionString: databaseUrl,
  max: Math.max(2, Number(process.env.DATABASE_POOL_SIZE ?? 10)),
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 30_000,
});

const BUILT_IN_QUESTS = [
  ["signal-fire", "Signal Fire", 120],
  ["forked-path", "Forked Path", 140],
  ["echo-loop", "Echo Loop", 160],
  ["array-vault", "Array Vault", 220],
  ["sorting-ruins", "Sorting Ruins", 260],
  ["binary-gate", "Binary Gate", 300],
  ["prefix-beacon", "Prefix Beacon", 340],
  ["stack-sentinel", "Stack Sentinel", 360],
  ["grid-rescue", "Grid Rescue", 420],
  ["dijkstra-citadel", "Dijkstra Citadel", 480],
  ["union-forge", "Union Forge", 520],
  ["topological-crown", "Topological Crown", 620],
  ["recursive-mirror", "Recursive Mirror", 680],
  ["greedy-caravan", "Greedy Caravan", 720],
  ["knapsack-forge", "Knapsack Forge", 820],
  ["lis-observatory", "LIS Observatory", 860],
  ["mst-skybridge", "Skybridge Protocol", 940],
  ["fenwick-pulse", "Fenwick Pulse", 980],
  ["segment-bastion", "Segment Bastion", 1080],
  ["lca-oracle", "LCA Oracle", 1160],
  ["scc-nexus", "SCC Nexus", 1260],
  ["maxflow-reactor", "Max-Flow Reactor", 1500],
];

const NAMELESS_ROOM = {
  id: "nameless-room",
  index: "??",
  title: "Nameless Room",
  subtitle: "Hidden encounter",
  difficulty: 3,
  xp: 500,
  status: "locked",
  prerequisites: [],
  chapter: "SECRET / UNKNOWN",
  gridArea: "secret",
  mapPosition: { x: 90, y: 18 },
  description:
    "A hidden room opens only after the archive recognizes sustained practice.",
  skills: ["state machines", "rule evaluation", "persistence"],
  sortOrder: 9900,
  problem: {
    story: [
      "The nameless terminal has recorded every step of your journey.",
      "It now asks you to compress a stream of repeated symbols into symbol-count pairs.",
    ],
    guidance: [
      "Scan the string from left to right.",
      "Keep the current character and the length of its run.",
      "Flush each run when the character changes, then flush the final run.",
    ],
    input: "One non-empty string containing printable non-space ASCII characters.",
    constraints: "1 ≤ length ≤ 500,000.",
    output: "Print each maximal run as character followed by its count, separated by one space.",
    sampleInput: "aaabbccccd",
    sampleOutput: "a3 b2 c4 d1",
    hint: "A run ends when the next character differs from the current one.",
    hintMarker: "    // TODO: compress the hidden signal",
    hintCode: `    for (int i = 0; i < (int)s.size();) {
        int j = i;
        while (j < (int)s.size() && s[j] == s[i]) ++j;
        if (i) cout << ' ';
        cout << s[i] << (j - i);
        i = j;
    }
    cout << '\\n';`,
    starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string s;
    cin >> s;

    // TODO: compress the hidden signal

    return 0;
}`,
    testCaseCount: 6,
    passScore: 100,
    timeLimitSeconds: 1,
    memoryLimitMb: 64,
  },
};

const NAMELESS_JUDGE = {
  language: "cpp14",
  timeLimitMs: 1000,
  memoryLimitMb: 64,
  compileLimitMs: 15000,
  passScore: 100,
  tests: [
    { id: "01", input: "aaabbccccd\n", expected: "a3 b2 c4 d1\n" },
    { id: "02", input: "x\n", expected: "x1\n" },
    { id: "03", input: "1111222\n", expected: "14 23\n" },
    { id: "04", input: "ababab\n", expected: "a1 b1 a1 b1 a1 b1\n" },
    { id: "05", input: "zzzzzzzzzz\n", expected: "z10\n" },
    { id: "06", input: "AABcccDDDD\n", expected: "A2 B1 c3 D4\n" },
  ],
};

const ACHIEVEMENTS = [
  {
    id: "first-ac",
    icon: "[AC]",
    title: "First Signal",
    description: "Clear your first quest.",
    test: (metrics) => metrics.acceptedCount >= 1,
  },
  {
    id: "triple-clear",
    icon: "[03]",
    title: "Branch Walker",
    description: "Clear three quests.",
    test: (metrics) => metrics.clearedCount >= 3,
  },
  {
    id: "seven-clear",
    icon: "[07]",
    title: "Archive Keeper",
    description: "Clear seven quests.",
    test: (metrics) => metrics.clearedCount >= 7,
  },
  {
    id: "campaign-clear",
    icon: "[12]",
    title: "Topological Crown",
    description: "Clear the twelve-mission main campaign.",
    test: (metrics) => metrics.clearedCount >= 12,
  },
  {
    id: "streak-3",
    icon: "[3D]",
    title: "Warm Cache",
    description: "Stay active for three consecutive days.",
    test: (metrics) => metrics.currentStreak >= 3,
  },
  {
    id: "streak-7",
    icon: "[7D]",
    title: "Persistent Process",
    description: "Stay active for seven consecutive days.",
    test: (metrics) => metrics.currentStreak >= 7,
  },
  {
    id: "ten-submissions",
    icon: "[10]",
    title: "Relentless Debugger",
    description: "Send ten judged submissions.",
    test: (metrics) => metrics.submissionCount >= 10,
  },
  {
    id: "clean-sweep",
    icon: "[80]",
    title: "Clean Sweep",
    description: "Reach at least 80% acceptance after five submissions.",
    test: (metrics) =>
      metrics.submissionCount >= 5 && metrics.acceptanceRate >= 80,
  },
  {
    id: "speed-signal",
    icon: "[<1]",
    title: "Fast Path",
    description: "Earn an AC with every reported case under 100 ms.",
    test: (metrics) => metrics.fastAccepted,
  },
  {
    id: "hidden-room",
    icon: "[??]",
    title: "Wall Listener",
    description: "Unlock the Nameless Room.",
    test: (metrics) => metrics.unlockedQuestIds.has("nameless-room"),
  },
];

class ExtensionError extends Error {
  constructor(status, code, details = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function corsHeaders() {
  return {
    "access-control-allow-origin": process.env.API_ALLOWED_ORIGIN ?? "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-expose-headers": "location, retry-after",
    vary: "Origin",
  };
}

function sendJson(response, status, body, headers = {}) {
  if (response.writableEnded) return;
  response.writeHead(status, {
    ...corsHeaders(),
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(status === 204 ? undefined : JSON.stringify(body));
}

async function readJson(request, limit = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new ExtensionError(413, "PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ExtensionError(400, "INVALID_JSON");
  }
}

function boundedText(value, maxLength, fallback = "") {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, maxLength)
    : fallback;
}

function validSlug(value, max = 96) {
  return typeof value === "string" && new RegExp(`^[a-z0-9-]{1,${max}}$`).test(value);
}

function asIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function authenticate(request) {
  const token = bearerToken(request);
  if (!token) return undefined;
  const result = await pool.query(
    `SELECT
       u.id, u.display_name, u.email, u.email_verified_at, u.is_guest, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  if (!result.rowCount) return undefined;
  const row = result.rows[0];
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
    isGuest: row.is_guest,
    role: row.role,
  };
}

function requirePlayer(player) {
  if (!player) throw new ExtensionError(401, "UNAUTHORIZED");
  if (player.isGuest || !player.emailVerified) {
    throw new ExtensionError(403, "VERIFIED_ACCOUNT_REQUIRED");
  }
}

function requireAdmin(player) {
  requirePlayer(player);
  if (!["admin", "owner"].includes(player.role)) {
    throw new ExtensionError(403, "ADMIN_REQUIRED");
  }
}

function utcDay(value = new Date()) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function computeStreak(days) {
  const unique = [...new Set(days.map((value) => utcDay(value)))].sort((a, b) => b - a);
  if (!unique.length) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index - 1] - unique[index] === 86_400_000) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
  }

  const today = utcDay();
  const startsTodayOrYesterday =
    unique[0] === today || unique[0] === today - 86_400_000;
  let current = startsTodayOrYesterday ? 1 : 0;
  if (current) {
    for (let index = 1; index < unique.length; index += 1) {
      if (unique[index - 1] - unique[index] !== 86_400_000) break;
      current += 1;
    }
  }
  return { current, longest };
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    throw new ExtensionError(400, "INVALID_UNLOCK_RULE");
  }
  const encoded = JSON.stringify(rule);
  if (encoded.length > 16 * 1024) {
    throw new ExtensionError(413, "UNLOCK_RULE_TOO_LARGE");
  }
  validateRuleNode(rule, 0);
  return rule;
}

function validateRuleNode(node, depth) {
  if (depth > 8 || !node || typeof node !== "object" || Array.isArray(node)) {
    throw new ExtensionError(400, "INVALID_UNLOCK_RULE");
  }
  const keys = Object.keys(node);
  if (keys.length !== 1) throw new ExtensionError(400, "INVALID_UNLOCK_RULE");
  const [key] = keys;
  const value = node[key];
  if (key === "all" || key === "any") {
    if (!Array.isArray(value) || !value.length || value.length > 16) {
      throw new ExtensionError(400, "INVALID_UNLOCK_RULE");
    }
    value.forEach((child) => validateRuleNode(child, depth + 1));
    return;
  }
  if (key === "not") {
    validateRuleNode(value, depth + 1);
    return;
  }
  const numericKeys = new Set([
    "clearedAtLeast",
    "submissionCountAtLeast",
    "acceptedCountAtLeast",
    "streakAtLeast",
    "totalXpAtLeast",
  ]);
  if (numericKeys.has(key)) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      throw new ExtensionError(400, "INVALID_UNLOCK_RULE");
    }
    return;
  }
  if (["clearedQuest", "achievement"].includes(key)) {
    if (!validSlug(value)) throw new ExtensionError(400, "INVALID_UNLOCK_RULE");
    return;
  }
  if (key === "verdictCount") {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.verdict !== "string" ||
      !Number.isFinite(Number(value.count)) ||
      Number(value.count) < 0
    ) {
      throw new ExtensionError(400, "INVALID_UNLOCK_RULE");
    }
    return;
  }
  throw new ExtensionError(400, "INVALID_UNLOCK_RULE");
}

export function evaluateRule(rule, metrics) {
  if (!rule || typeof rule !== "object") return true;
  if (Array.isArray(rule.all)) return rule.all.every((item) => evaluateRule(item, metrics));
  if (Array.isArray(rule.any)) return rule.any.some((item) => evaluateRule(item, metrics));
  if (rule.not) return !evaluateRule(rule.not, metrics);
  if (rule.clearedAtLeast !== undefined) {
    return metrics.clearedCount >= Number(rule.clearedAtLeast);
  }
  if (rule.submissionCountAtLeast !== undefined) {
    return metrics.submissionCount >= Number(rule.submissionCountAtLeast);
  }
  if (rule.acceptedCountAtLeast !== undefined) {
    return metrics.acceptedCount >= Number(rule.acceptedCountAtLeast);
  }
  if (rule.streakAtLeast !== undefined) {
    return metrics.currentStreak >= Number(rule.streakAtLeast);
  }
  if (rule.totalXpAtLeast !== undefined) {
    return metrics.totalXp >= Number(rule.totalXpAtLeast);
  }
  if (rule.clearedQuest !== undefined) {
    return metrics.clearedQuestIds.has(rule.clearedQuest);
  }
  if (rule.achievement !== undefined) {
    return metrics.achievementIds.has(rule.achievement);
  }
  if (rule.verdictCount) {
    return (
      Number(metrics.verdictCounts[rule.verdictCount.verdict] ?? 0) >=
      Number(rule.verdictCount.count)
    );
  }
  return false;
}

async function loadActivityDays(userId) {
  const result = await pool.query(
    `SELECT active_day
       FROM (
         SELECT created_at::date AS active_day
           FROM submissions
          WHERE user_id = $1
         UNION
         SELECT updated_at::date AS active_day
           FROM quest_progress
          WHERE user_id = $1
         UNION
         SELECT started_at::date AS active_day
           FROM learning_sessions
          WHERE user_id = $1
       ) activity
      ORDER BY active_day DESC`,
    [userId],
  );
  return result.rows.map((row) => row.active_day);
}

async function loadMetrics(userId) {
  const [progress, submission, verdicts, achievements, activityDays, dynamicXp, fast] =
    await Promise.all([
      pool.query(
        `SELECT quest_id, status, best_score, updated_at
           FROM quest_progress
          WHERE user_id = $1`,
        [userId],
      ),
      pool.query(
        `SELECT
           COUNT(*)::integer AS submissions,
           COUNT(*) FILTER (WHERE verdict = 'AC')::integer AS accepted
         FROM submissions
         WHERE user_id = $1`,
        [userId],
      ),
      pool.query(
        `SELECT COALESCE(verdict, status) AS verdict, COUNT(*)::integer AS count
           FROM submissions
          WHERE user_id = $1
          GROUP BY COALESCE(verdict, status)`,
        [userId],
      ),
      pool.query(
        `SELECT achievement_id
           FROM player_achievements
          WHERE user_id = $1`,
        [userId],
      ),
      loadActivityDays(userId),
      pool.query(
        `SELECT id, COALESCE((public_definition->>'xp')::integer, 0) AS xp
           FROM quest_catalog
          WHERE archived = false`,
      ),
      pool.query(
        `SELECT 1
           FROM submissions
          WHERE user_id = $1
            AND verdict = 'AC'
            AND COALESCE(jsonb_array_length(details->'cases'), 0) > 0
            AND NOT EXISTS (
              SELECT 1
                FROM jsonb_array_elements(details->'cases') AS c
               WHERE COALESCE((c->>'timeMs')::numeric, 1000000) >= 100
            )
          LIMIT 1`,
        [userId],
      ),
    ]);

  const clearedQuestIds = new Set(
    progress.rows.filter((row) => row.status === "cleared").map((row) => row.quest_id),
  );
  const achievementIds = new Set(achievements.rows.map((row) => row.achievement_id));
  const verdictCounts = Object.fromEntries(
    verdicts.rows.map((row) => [row.verdict ?? "UNKNOWN", row.count]),
  );
  const streak = computeStreak(activityDays);
  const builtInXp = new Map(BUILT_IN_QUESTS.map(([id, , xp]) => [id, xp]));
  const dynamicXpMap = new Map(dynamicXp.rows.map((row) => [row.id, row.xp]));
  let totalXp = 0;
  for (const questId of clearedQuestIds) {
    totalXp += dynamicXpMap.get(questId) ?? builtInXp.get(questId) ?? 0;
  }
  const submissionCount = submission.rows[0]?.submissions ?? 0;
  const acceptedCount = submission.rows[0]?.accepted ?? 0;

  return {
    clearedQuestIds,
    clearedCount: clearedQuestIds.size,
    submissionCount,
    acceptedCount,
    acceptanceRate: submissionCount
      ? Math.round((acceptedCount / submissionCount) * 100)
      : 0,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    totalXp,
    achievementIds,
    verdictCounts,
    fastAccepted: Boolean(fast.rowCount),
    unlockedQuestIds: new Set(),
  };
}

async function loadUnlockRules() {

  const result = await pool.query(
    `SELECT quest_id, enabled, label, rule, updated_at
       FROM quest_unlock_rules
      ORDER BY quest_id`,
  );
  return result.rows.map((row) => ({
    questId: row.quest_id,
    enabled: row.enabled,
    label: row.label,
    rule: row.rule,
    updatedAt: asIso(row.updated_at),
  }));
}

async function unlockedQuestIdsFor(player) {
  const rules = await loadUnlockRules();
  if (!player || player.isGuest || !player.emailVerified) {
    return { rules, unlocked: new Set(), metrics: undefined };
  }
  const metrics = await loadMetrics(player.id);
  const unlocked = new Set();
  for (const rule of rules) {
    if (!rule.enabled || ["admin", "owner"].includes(player.role) || evaluateRule(rule.rule, metrics)) {
      unlocked.add(rule.questId);
    }
  }
  metrics.unlockedQuestIds = unlocked;
  return { rules, unlocked, metrics };
}

export async function ensureQuestRuleAccess(playerId, questId) {
  if (!validSlug(questId)) return true;
  const result = await pool.query(
    `SELECT enabled, rule
       FROM quest_unlock_rules
      WHERE quest_id = $1`,
    [questId],
  );
  if (!result.rowCount || !result.rows[0].enabled) return true;
  const role = await pool.query(`SELECT role FROM users WHERE id = $1`, [playerId]);
  if (["admin", "owner"].includes(role.rows[0]?.role)) return true;
  const metrics = await loadMetrics(playerId);
  return evaluateRule(result.rows[0].rule, metrics);
}

async function syncAchievements(userId, metrics) {
  const unlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (!achievement.test(metrics)) continue;
    await pool.query(
      `INSERT INTO player_achievements(user_id, achievement_id, unlocked_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id, achievement_id) DO NOTHING`,
      [userId, achievement.id],
    );
    unlocked.push(achievement.id);
  }
  const rows = await pool.query(
    `SELECT achievement_id, unlocked_at
       FROM player_achievements
      WHERE user_id = $1`,
    [userId],
  );
  const times = new Map(rows.rows.map((row) => [row.achievement_id, asIso(row.unlocked_at)]));
  return ACHIEVEMENTS.map(({ test, ...achievement }) => {
    void test;
    return {
      ...achievement,
      unlockedAt: times.get(achievement.id) ?? null,
      unlocked: times.has(achievement.id),
    };
  });
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

async function activityTimeline(userId, days = 30) {
  const result = await pool.query(
    `WITH dates AS (
       SELECT generate_series(
         current_date - ($2::integer - 1),
         current_date,
         interval '1 day'
       )::date AS day
     ), activity AS (
       SELECT created_at::date AS day, COUNT(*)::integer AS submissions, 0::integer AS minutes
         FROM submissions
        WHERE user_id = $1
          AND created_at >= current_date - ($2::integer - 1)
        GROUP BY created_at::date
       UNION ALL
       SELECT started_at::date AS day, 0::integer, SUM(minutes)::integer
         FROM learning_sessions
        WHERE user_id = $1
          AND started_at >= current_date - ($2::integer - 1)
        GROUP BY started_at::date
     )
     SELECT
       dates.day,
       COALESCE(SUM(activity.submissions), 0)::integer AS submissions,
       COALESCE(SUM(activity.minutes), 0)::integer AS minutes
     FROM dates
     LEFT JOIN activity ON activity.day = dates.day
     GROUP BY dates.day
     ORDER BY dates.day`,
    [userId, days],
  );
  return result.rows.map((row) => ({
    day: dateKey(row.day),
    submissions: row.submissions,
    minutes: row.minutes,
  }));
}

async function nextRecommendation(metrics) {
  const dynamic = await pool.query(
    `SELECT id, public_definition
       FROM quest_catalog
      WHERE archived = false
      ORDER BY COALESCE((public_definition->>'sortOrder')::integer, 999999), id`,
  );
  const dynamicById = new Map(dynamic.rows.map((row) => [row.id, row.public_definition]));
  const order = [
    ...BUILT_IN_QUESTS.map(([id, title]) => ({ id, title })),
    ...dynamic.rows
      .filter((row) => !BUILT_IN_QUESTS.some(([id]) => id === row.id))
      .map((row) => ({ id: row.id, title: row.public_definition.title ?? row.id })),
  ];
  const next = order.find((quest) => !metrics.clearedQuestIds.has(quest.id));
  if (!next) {
    return {
      questId: null,
      title: "Campaign complete",
      reason: "Review weak areas, publish an explanation, or attempt a hidden quest.",
    };
  }
  const definition = dynamicById.get(next.id);
  return {
    questId: next.id,
    title: definition?.title ?? next.title,
    reason:
      metrics.submissionCount === 0
        ? "Start with one focused attempt and record what changed."
        : "This is the next uncleared quest in your current learning route.",
  };
}

async function weakAreas(userId) {
  const result = await pool.query(
    `SELECT
       quest_id,
       COUNT(*) FILTER (WHERE verdict <> 'AC' OR verdict IS NULL)::integer AS misses,
       COUNT(*) FILTER (WHERE verdict = 'AC')::integer AS accepted
     FROM submissions
     WHERE user_id = $1
     GROUP BY quest_id
     ORDER BY misses DESC, accepted ASC, quest_id
     LIMIT 5`,
    [userId],
  );
  return result.rows.map((row) => ({
    questId: row.quest_id,
    misses: row.misses,
    accepted: row.accepted,
  }));
}

async function learningDashboard(player) {
  const { unlocked, metrics } = await unlockedQuestIdsFor(player);
  metrics.unlockedQuestIds = unlocked;
  const achievements = await syncAchievements(player.id, metrics);
  const [goal, today, timeline, recommendation, weak] = await Promise.all([
    pool.query(
      `SELECT daily_minutes, weekly_quest_target, updated_at
         FROM learning_goals
        WHERE user_id = $1`,
      [player.id],
    ),
    pool.query(
      `SELECT COALESCE(SUM(minutes), 0)::integer AS minutes
         FROM learning_sessions
        WHERE user_id = $1 AND started_at::date = current_date`,
      [player.id],
    ),
    activityTimeline(player.id, 30),
    nextRecommendation(metrics),
    weakAreas(player.id),
  ]);
  const goalRow = goal.rows[0] ?? {
    daily_minutes: 30,
    weekly_quest_target: 3,
    updated_at: new Date(0),
  };
  const todayMinutes = today.rows[0]?.minutes ?? 0;
  return {
    metrics: {
      clearedCount: metrics.clearedCount,
      submissionCount: metrics.submissionCount,
      acceptedCount: metrics.acceptedCount,
      acceptanceRate: metrics.acceptanceRate,
      currentStreak: metrics.currentStreak,
      longestStreak: metrics.longestStreak,
      totalXp: metrics.totalXp,
      unlockedHiddenCount: unlocked.size,
    },
    goal: {
      dailyMinutes: goalRow.daily_minutes,
      weeklyQuestTarget: goalRow.weekly_quest_target,
      todayMinutes,
      completionPercent: Math.min(
        100,
        Math.round((todayMinutes / Math.max(1, goalRow.daily_minutes)) * 100),
      ),
      updatedAt: asIso(goalRow.updated_at),
    },
    timeline,
    recommendation,
    weakAreas: weak,
    achievements,
  };
}

function defaultHandle(player) {
  const base =
    boundedText(player.displayName, 24, "player")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "player";
  return `${base.slice(0, 22)}-${player.id.slice(0, 6)}`;
}

async function ensureProfile(player) {
  await pool.query(
    `INSERT INTO player_profiles(user_id, handle, bio, is_public, show_code, created_at, updated_at)
     VALUES ($1, $2, '', false, false, now(), now())
     ON CONFLICT (user_id) DO NOTHING`,
    [player.id, defaultHandle(player)],
  );
  const result = await pool.query(
    `SELECT handle, bio, is_public, show_code, created_at, updated_at
       FROM player_profiles
      WHERE user_id = $1`,
    [player.id],
  );
  const row = result.rows[0];
  return {

    handle: row.handle,
    bio: row.bio,
    isPublic: row.is_public,
    showCode: row.show_code,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

async function profileStatistics(userId) {
  const metrics = await loadMetrics(userId);
  const achievements = await syncAchievements(userId, metrics);
  const recent = await pool.query(
    `SELECT quest_id, best_score, cleared_at, updated_at
       FROM quest_progress
      WHERE user_id = $1 AND status = 'cleared'
      ORDER BY COALESCE(cleared_at, updated_at) DESC
      LIMIT 12`,
    [userId],
  );
  return {
    clearedCount: metrics.clearedCount,
    submissionCount: metrics.submissionCount,
    acceptedCount: metrics.acceptedCount,
    acceptanceRate: metrics.acceptanceRate,
    currentStreak: metrics.currentStreak,
    longestStreak: metrics.longestStreak,
    totalXp: metrics.totalXp,
    achievements: achievements.filter((item) => item.unlocked),
    recentClears: recent.rows.map((row) => ({
      questId: row.quest_id,
      bestScore: row.best_score,
      clearedAt: asIso(row.cleared_at ?? row.updated_at),
    })),
  };
}

function submissionRow(row, includeSource = false) {
  const item = {
    id: row.id,
    judgeSubmissionId: row.judge_submission_id,
    questId: row.quest_id,
    status: row.status,
    verdict: row.verdict,
    score: row.score ?? 0,
    language: row.language,
    mode: row.mode,
    details: row.details ?? {},
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
  if (includeSource) item.source = row.source_code;
  return item;
}

function submissionFilters(url, userId) {
  const values = [userId];
  const conditions = [`user_id = $1`];
  const add = (sql, value) => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };
  const questId = url.searchParams.get("questId");
  const verdict = url.searchParams.get("verdict");
  const mode = url.searchParams.get("mode");
  const language = url.searchParams.get("language");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (questId && validSlug(questId)) add("quest_id = ?", questId);
  if (verdict && /^[A-Z_]{1,24}$/.test(verdict)) add("verdict = ?", verdict);
  if (mode && ["sample", "submit"].includes(mode)) add("mode = ?", mode);
  if (language && /^[a-z0-9-]{1,24}$/.test(language)) add("language = ?", language);
  if (from && !Number.isNaN(Date.parse(from))) add("created_at >= ?::timestamptz", from);
  if (to && !Number.isNaN(Date.parse(to))) add("created_at <= ?::timestamptz", to);
  return { values, where: conditions.join(" AND ") };
}

async function listSubmissions(url, player) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(5, Number(url.searchParams.get("limit")) || 20));
  const filters = submissionFilters(url, player.id);
  const offset = (page - 1) * limit;
  const values = [...filters.values, limit, offset];
  const list = await pool.query(
    `SELECT
       id, judge_submission_id, quest_id, status, verdict, score,
       language, mode, details, created_at, updated_at
     FROM submissions
     WHERE ${filters.where}
     ORDER BY created_at DESC
     LIMIT $${values.length - 1}::integer
     OFFSET $${values.length}::integer`,
    values,
  );
  const [count, stats, trend] = await Promise.all([
    pool.query(`SELECT COUNT(*)::integer AS total FROM submissions WHERE ${filters.where}`, filters.values),
    pool.query(
      `SELECT
         COUNT(*)::integer AS total,
         COUNT(*) FILTER (WHERE verdict = 'AC')::integer AS accepted,
         COALESCE(AVG(score), 0)::numeric(8,2) AS average_score,
         COALESCE(AVG(
           CASE
             WHEN jsonb_typeof(details->'cases') = 'array'
             THEN (
               SELECT MAX(COALESCE((item->>'timeMs')::numeric, 0))
                 FROM jsonb_array_elements(details->'cases') AS item
             )
           END
         ), 0)::numeric(10,2) AS average_time_ms
       FROM submissions
       WHERE ${filters.where}`,
      filters.values,
    ),
    pool.query(
      `SELECT created_at::date AS day, COUNT(*)::integer AS total,
              COUNT(*) FILTER (WHERE verdict = 'AC')::integer AS accepted
         FROM submissions
        WHERE user_id = $1 AND created_at >= current_date - 13
        GROUP BY created_at::date
        ORDER BY created_at::date`,
      [player.id],
    ),
  ]);
  const verdictRows = await pool.query(
    `SELECT COALESCE(verdict, status) AS verdict, COUNT(*)::integer AS count
       FROM submissions
      WHERE ${filters.where}
      GROUP BY COALESCE(verdict, status)`,
    filters.values,
  );
  const stat = stats.rows[0];
  return {
    submissions: list.rows.map((row) => submissionRow(row)),
    pagination: {
      page,
      limit,
      total: count.rows[0]?.total ?? 0,
      pages: Math.max(1, Math.ceil((count.rows[0]?.total ?? 0) / limit)),
    },
    statistics: {
      total: stat.total,
      accepted: stat.accepted,
      acceptanceRate: stat.total ? Math.round((stat.accepted / stat.total) * 100) : 0,
      averageScore: Number(stat.average_score),
      averageTimeMs: Number(stat.average_time_ms),
      verdictCounts: Object.fromEntries(verdictRows.rows.map((row) => [row.verdict, row.count])),
      trend: trend.rows.map((row) => ({
        day: dateKey(row.day),
        total: row.total,
        accepted: row.accepted,
      })),
    },
  };
}

function coarseDiff(left, right) {
  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < left.length - prefix &&
    suffix < right.length - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return [
    ...left.slice(0, prefix).map((line) => ({ type: "equal", line })),
    ...left.slice(prefix, left.length - suffix).map((line) => ({ type: "remove", line })),
    ...right.slice(prefix, right.length - suffix).map((line) => ({ type: "add", line })),
    ...left.slice(left.length - suffix).map((line) => ({ type: "equal", line })),
  ];
}

export function diffLines(previousSource, currentSource) {
  const left = String(previousSource ?? "").split("\n");
  const right = String(currentSource ?? "").split("\n");
  let operations;
  if (left.length * right.length > 180_000) {
    operations = coarseDiff(left, right);
  } else {
    const table = Array.from({ length: left.length + 1 }, () =>
      new Uint16Array(right.length + 1),
    );
    for (let i = left.length - 1; i >= 0; i -= 1) {
      for (let j = right.length - 1; j >= 0; j -= 1) {
        table[i][j] =
          left[i] === right[j]
            ? table[i + 1][j + 1] + 1
            : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    operations = [];
    let i = 0;
    let j = 0;
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && left[i] === right[j]) {
        operations.push({ type: "equal", line: left[i] });
        i += 1;
        j += 1;
      } else if (j < right.length && (i === left.length || table[i][j + 1] >= table[i + 1][j])) {
        operations.push({ type: "add", line: right[j] });
        j += 1;
      } else {
        operations.push({ type: "remove", line: left[i] });
        i += 1;
      }
    }
  }
  const summary = operations.reduce(
    (accumulator, operation) => {
      if (operation.type === "add") accumulator.added += 1;
      if (operation.type === "remove") accumulator.removed += 1;
      if (operation.type === "equal") accumulator.unchanged += 1;
      return accumulator;
    },
    { added: 0, removed: 0, unchanged: 0 },
  );

  return { operations, summary };
}

async function submissionDiff(player, submissionId, against) {
  const current = await pool.query(
    `SELECT * FROM submissions WHERE id = $1 AND user_id = $2`,
    [submissionId, player.id],
  );
  if (!current.rowCount) throw new ExtensionError(404, "SUBMISSION_NOT_FOUND");
  const row = current.rows[0];
  let baseline;
  if (against && /^[0-9a-f-]{36}$/.test(against)) {
    baseline = await pool.query(
      `SELECT * FROM submissions WHERE id = $1 AND user_id = $2`,
      [against, player.id],
    );
  } else if (against === "accepted") {
    baseline = await pool.query(
      `SELECT * FROM submissions
        WHERE user_id = $1 AND quest_id = $2 AND verdict = 'AC' AND id <> $3
        ORDER BY created_at DESC LIMIT 1`,
      [player.id, row.quest_id, row.id],
    );
  } else {
    baseline = await pool.query(
      `SELECT * FROM submissions
        WHERE user_id = $1 AND quest_id = $2 AND created_at < $3
        ORDER BY created_at DESC LIMIT 1`,
      [player.id, row.quest_id, row.created_at],
    );
  }
  const base = baseline.rows[0];
  const diff = diffLines(base?.source_code ?? "", row.source_code);
  return {
    current: submissionRow(row, true),
    baseline: base ? submissionRow(base, true) : null,
    ...diff,
  };
}

function validateQuestDraft(body) {
  const questId = boundedText(body.questId, 96);
  if (!validSlug(questId)) throw new ExtensionError(400, "INVALID_QUEST_ID");
  if (!body.publicDefinition || typeof body.publicDefinition !== "object") {
    throw new ExtensionError(400, "INVALID_QUEST_DEFINITION");
  }
  if (!body.judgeDefinition || typeof body.judgeDefinition !== "object") {
    throw new ExtensionError(400, "INVALID_JUDGE_DEFINITION");
  }
  const tests = body.judgeDefinition.tests;
  if (!Array.isArray(tests) || !tests.length || tests.length > 50) {
    throw new ExtensionError(400, "INVALID_TEST_CASES");
  }
  for (const test of tests) {
    if (
      !test ||
      typeof test.input !== "string" ||
      typeof test.expected !== "string" ||
      Buffer.byteLength(test.input, "utf8") > 64 * 1024 ||
      Buffer.byteLength(test.expected, "utf8") > 64 * 1024
    ) {
      throw new ExtensionError(400, "INVALID_TEST_CASE");
    }
  }
  return {
    questId,
    title: boundedText(body.title, 160, body.publicDefinition.title ?? questId),
    publicDefinition: { ...body.publicDefinition, id: questId },
    judgeDefinition: {
      ...body.judgeDefinition,
      language: "cpp14",
      tests: tests.map((test, index) => ({
        id: String(index + 1).padStart(2, "0"),
        input: test.input,
        expected: test.expected,
      })),
    },
  };
}

function mapDraft(row) {
  return {
    id: row.id,
    questId: row.quest_id,
    title: row.title,
    publicDefinition: row.public_definition,
    judgeDefinition: row.judge_definition,
    revision: row.revision,
    status: row.status,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

async function publishDraft(player, draftId, note) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const draft = await client.query(
      `SELECT * FROM quest_content_drafts WHERE id = $1 FOR UPDATE`,
      [draftId],
    );
    if (!draft.rowCount) throw new ExtensionError(404, "QUEST_DRAFT_NOT_FOUND");
    const row = draft.rows[0];
    const version = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next
         FROM quest_versions
        WHERE quest_id = $1`,
      [row.quest_id],
    );
    const nextVersion = Number(version.rows[0].next);
    await client.query(
      `INSERT INTO quest_versions
         (quest_id, version, public_definition, judge_definition, note, created_by, created_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, now())`,
      [
        row.quest_id,
        nextVersion,
        JSON.stringify(row.public_definition),
        JSON.stringify(row.judge_definition),
        boundedText(note, 240, `Publish draft revision ${row.revision}`),
        player.id,
      ],
    );
    await client.query(
      `INSERT INTO quest_catalog
         (id, public_definition, judge_definition, archived, created_by, updated_by)
       VALUES ($1, $2::jsonb, $3::jsonb, false, $4, $4)
       ON CONFLICT (id) DO UPDATE SET
         public_definition = EXCLUDED.public_definition,
         judge_definition = EXCLUDED.judge_definition,
         archived = false,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [
        row.quest_id,
        JSON.stringify(row.public_definition),
        JSON.stringify(row.judge_definition),
        player.id,
      ],
    );
    await client.query(
      `UPDATE quest_content_drafts
          SET status = 'published', updated_by = $2, updated_at = now()
        WHERE id = $1`,
      [draftId, player.id],
    );
    await client.query("COMMIT");
    return { questId: row.quest_id, version: nextVersion };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rollbackQuest(player, questId, version, note) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const source = await client.query(
      `SELECT * FROM quest_versions WHERE quest_id = $1 AND version = $2 FOR UPDATE`,
      [questId, version],
    );
    if (!source.rowCount) throw new ExtensionError(404, "QUEST_VERSION_NOT_FOUND");
    const next = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next
         FROM quest_versions WHERE quest_id = $1`,
      [questId],
    );
    const nextVersion = Number(next.rows[0].next);
    const row = source.rows[0];
    await client.query(
      `INSERT INTO quest_versions
         (quest_id, version, public_definition, judge_definition, note, created_by, created_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, now())`,
      [
        questId,
        nextVersion,
        JSON.stringify(row.public_definition),
        JSON.stringify(row.judge_definition),
        boundedText(note, 240, `Rollback to version ${version}`),
        player.id,
      ],
    );
    await client.query(
      `INSERT INTO quest_catalog
         (id, public_definition, judge_definition, archived, created_by, updated_by)
       VALUES ($1, $2::jsonb, $3::jsonb, false, $4, $4)
       ON CONFLICT (id) DO UPDATE SET
         public_definition = EXCLUDED.public_definition,
         judge_definition = EXCLUDED.judge_definition,
         archived = false,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [
        questId,
        JSON.stringify(row.public_definition),
        JSON.stringify(row.judge_definition),
        player.id,
      ],
    );
    await client.query("COMMIT");
    return { questId, version: nextVersion, rolledBackFrom: Number(version) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function localized(value, fallback = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      en: boundedText(value.en, 2000, fallback),
      "zh-CN": boundedText(value["zh-CN"], 2000, value.en ?? fallback),
      ja: boundedText(value.ja, 2000, value.en ?? fallback),
    };
  }
  const text = boundedText(value, 2000, fallback);
  return { en: text, "zh-CN": text, ja: text };
}

function validateCodex(body, existingId) {
  const id = existingId ?? boundedText(body.id, 64);
  if (!validSlug(id, 64)) throw new ExtensionError(400, "INVALID_CODEX_ID");
  const categories = new Set(["fundamentals", "algorithms", "data-structures", "graphs"]);
  const category = categories.has(body.category) ? body.category : "algorithms";

  const checkpoints = Array.isArray(body.checkpoints)
    ? body.checkpoints.slice(0, 16).map((item) => localized(item))
    : [];
  if (!checkpoints.length) checkpoints.push(localized("Explain the invariant before coding."));
  return {
    id,
    category,
    questId: validSlug(body.questId) ? body.questId : "signal-fire",
    marker: boundedText(body.marker, 8, "++"),
    title: localized(body.title, id),
    summary: localized(body.summary),
    explanation: localized(body.explanation),
    checkpoints,
    timeComplexity: boundedText(body.timeComplexity, 80, "O(?)"),
    spaceComplexity: boundedText(body.spaceComplexity, 80, "O(?)"),
    tags: Array.isArray(body.tags)
      ? body.tags.map((tag) => boundedText(tag, 40)).filter(Boolean).slice(0, 20)
      : [],
    code: typeof body.code === "string" ? body.code.slice(0, 64 * 1024) : "",
    published: body.published !== false,
    sortOrder: Math.max(0, Math.min(999999, Math.round(Number(body.sortOrder) || 0))),
  };
}

function codexRow(row) {
  return {
    id: row.id,
    category: row.category,
    questId: row.quest_id,
    marker: row.marker,
    title: row.title,
    summary: row.summary,
    explanation: row.explanation,
    checkpoints: row.checkpoints,
    timeComplexity: row.time_complexity,
    spaceComplexity: row.space_complexity,
    tags: row.tags,
    code: row.code,
    published: row.published,
    sortOrder: row.sort_order,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

async function personalizedQuestCatalog(request) {
  const player = await authenticate(request);
  const access = await unlockedQuestIdsFor(player);
  const ruleIds = new Set(access.rules.filter((rule) => rule.enabled).map((rule) => rule.questId));
  if (player && access.unlocked.has("nameless-room")) {
    await pool.query(
      `INSERT INTO quest_catalog
         (id, public_definition, judge_definition, archived, created_by, updated_by)
       VALUES ($1, $2::jsonb, $3::jsonb, false, $4, $4)
       ON CONFLICT (id) DO NOTHING`,
      [
        "nameless-room",
        JSON.stringify(NAMELESS_ROOM),
        JSON.stringify(NAMELESS_JUDGE),
        player.id,
      ],
    );
  }
  const [records, layout] = await Promise.all([
    pool.query(
      `SELECT id, public_definition, archived
         FROM quest_catalog
        ORDER BY COALESCE((public_definition->>'sortOrder')::integer, 999999), id`,
    ),
    pool.query(`SELECT quest_id, x, y FROM quest_map_layout ORDER BY quest_id`),
  ]);
  const quests = records.rows
    .filter((row) => !row.archived)
    .map((row) => {
      const definition = { ...row.public_definition };
      if (!ruleIds.has(row.id)) return definition;
      return access.unlocked.has(row.id)
        ? { ...definition, status: "locked", prerequisites: [] }
        : { ...definition, status: "secret" };
    });
  if (access.unlocked.has("nameless-room")) {
    const existing = quests.findIndex((quest) => quest.id === "nameless-room");
    if (existing >= 0) quests[existing] = { ...quests[existing], status: "locked", prerequisites: [] };
    else quests.push(NAMELESS_ROOM);
  }
  return {
    quests,
    archivedQuestIds: records.rows.filter((row) => row.archived).map((row) => row.id),
    mapLayout: Object.fromEntries(
      layout.rows.map((row) => [row.quest_id, { x: Number(row.x), y: Number(row.y) }]),
    ),
    learning: {
      authenticated: Boolean(player && !player.isGuest && player.emailVerified),
      unlockedHiddenQuestIds: [...access.unlocked],
    },
  };
}

async function handleExtensionRoute(request, response) {
  const url = new URL(request.url ?? "/", "http://api.local");

  if (request.method === "GET" && url.pathname === "/v1/quests") {
    sendJson(response, 200, await personalizedQuestCatalog(request));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/codex") {
    const result = await pool.query(
      `SELECT * FROM codex_entries WHERE published = true ORDER BY sort_order, id`,
    );
    sendJson(response, 200, { entries: result.rows.map(codexRow) });
    return true;
  }

  const publicProfileMatch = url.pathname.match(/^\/v1\/players\/([a-z0-9-]{3,32})$/);
  if (request.method === "GET" && publicProfileMatch) {
    const profile = await pool.query(
      `SELECT p.*, u.display_name
         FROM player_profiles p
         JOIN users u ON u.id = p.user_id
        WHERE p.handle = $1 AND p.is_public = true`,
      [publicProfileMatch[1]],
    );
    if (!profile.rowCount) throw new ExtensionError(404, "PUBLIC_PROFILE_NOT_FOUND");
    const row = profile.rows[0];
    sendJson(response, 200, {
      profile: {
        handle: row.handle,
        displayName: row.display_name,
        bio: row.bio,
        showCode: row.show_code,
        joinedAt: asIso(row.created_at),
      },
      statistics: await profileStatistics(row.user_id),
    });
    return true;
  }

  if (!url.pathname.startsWith("/v1/learning") &&
      !url.pathname.startsWith("/v1/achievements") &&
      !url.pathname.startsWith("/v1/me/public-profile") &&
      !url.pathname.startsWith("/v1/me/submissions") &&
      !url.pathname.startsWith("/v1/admin/quest-drafts") &&
      !url.pathname.startsWith("/v1/admin/unlock-rules") &&
      !url.pathname.startsWith("/v1/admin/codex") &&
      !url.pathname.match(/^\/v1\/admin\/quests\/[a-z0-9-]{1,96}\/versions/)) {
    return false;
  }

  const player = await authenticate(request);
  requirePlayer(player);

  if (request.method === "GET" && url.pathname === "/v1/learning/dashboard") {
    sendJson(response, 200, { dashboard: await learningDashboard(player) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/learning/sessions") {
    const body = await readJson(request, 8 * 1024);
    const minutes = Math.max(1, Math.min(480, Math.round(Number(body.minutes) || 0)));
    const kind = ["study", "practice", "review"].includes(body.kind)
      ? body.kind
      : "practice";
    if (!minutes) throw new ExtensionError(400, "INVALID_SESSION_MINUTES");
    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO learning_sessions(id, user_id, minutes, kind, note, started_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING *`,
      [id, player.id, minutes, kind, boundedText(body.note, 240)],
    );
    sendJson(response, 201, {
      session: {
        id,
        minutes,
        kind,
        note: result.rows[0].note,
        startedAt: asIso(result.rows[0].started_at),
      },
      dashboard: await learningDashboard(player),
    });
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/v1/learning/goal") {
    const body = await readJson(request, 8 * 1024);
    const dailyMinutes = Math.max(5, Math.min(480, Math.round(Number(body.dailyMinutes) || 30)));
    const weeklyQuestTarget = Math.max(
      1,
      Math.min(50, Math.round(Number(body.weeklyQuestTarget) || 3)),
    );
    const result = await pool.query(
      `INSERT INTO learning_goals(user_id, daily_minutes, weekly_quest_target, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE SET
         daily_minutes = EXCLUDED.daily_minutes,
         weekly_quest_target = EXCLUDED.weekly_quest_target,
         updated_at = now()
       RETURNING *`,
      [player.id, dailyMinutes, weeklyQuestTarget],
    );
    const row = result.rows[0];
    sendJson(response, 200, {
      goal: {
        dailyMinutes: row.daily_minutes,
        weeklyQuestTarget: row.weekly_quest_target,
        updatedAt: asIso(row.updated_at),
      },
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/achievements") {
    const { unlocked, metrics } = await unlockedQuestIdsFor(player);

    metrics.unlockedQuestIds = unlocked;
    sendJson(response, 200, {
      achievements: await syncAchievements(player.id, metrics),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/me/public-profile") {
    sendJson(response, 200, {
      profile: await ensureProfile(player),
      statistics: await profileStatistics(player.id),
    });
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/v1/me/public-profile") {
    await ensureProfile(player);
    const body = await readJson(request, 16 * 1024);
    const handle = boundedText(body.handle, 32).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(handle)) {
      throw new ExtensionError(400, "INVALID_PROFILE_HANDLE");
    }
    try {
      const result = await pool.query(
        `UPDATE player_profiles
            SET handle = $2, bio = $3, is_public = $4, show_code = $5, updated_at = now()
          WHERE user_id = $1
          RETURNING *`,
        [
          player.id,
          handle,
          boundedText(body.bio, 280),
          Boolean(body.isPublic),
          Boolean(body.showCode),
        ],
      );
      const row = result.rows[0];
      sendJson(response, 200, {
        profile: {
          handle: row.handle,
          bio: row.bio,
          isPublic: row.is_public,
          showCode: row.show_code,
          createdAt: asIso(row.created_at),
          updatedAt: asIso(row.updated_at),
        },
      });
    } catch (error) {
      if (error.code === "23505") throw new ExtensionError(409, "PROFILE_HANDLE_TAKEN");
      throw error;
    }
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/me/submissions") {
    sendJson(response, 200, await listSubmissions(url, player));
    return true;
  }

  const submissionMatch = url.pathname.match(/^\/v1\/me\/submissions\/([0-9a-f-]{36})$/);
  if (request.method === "GET" && submissionMatch) {
    const result = await pool.query(
      `SELECT * FROM submissions WHERE id = $1 AND user_id = $2`,
      [submissionMatch[1], player.id],
    );
    if (!result.rowCount) throw new ExtensionError(404, "SUBMISSION_NOT_FOUND");
    sendJson(response, 200, { submission: submissionRow(result.rows[0], true) });
    return true;
  }

  const diffMatch = url.pathname.match(
    /^\/v1\/me\/submissions\/([0-9a-f-]{36})\/diff$/,
  );
  if (request.method === "GET" && diffMatch) {
    sendJson(
      response,
      200,
      await submissionDiff(player, diffMatch[1], url.searchParams.get("against")),
    );
    return true;
  }

  requireAdmin(player);

  if (request.method === "GET" && url.pathname === "/v1/admin/quest-drafts") {
    const result = await pool.query(
      `SELECT * FROM quest_content_drafts ORDER BY updated_at DESC LIMIT 200`,
    );
    sendJson(response, 200, { drafts: result.rows.map(mapDraft) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/admin/quest-drafts") {
    const input = validateQuestDraft(await readJson(request));
    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO quest_content_drafts
         (id, quest_id, title, public_definition, judge_definition, revision, status,
          created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 1, 'draft', $6, $6, now(), now())
       RETURNING *`,
      [
        id,
        input.questId,
        input.title,
        JSON.stringify(input.publicDefinition),
        JSON.stringify(input.judgeDefinition),
        player.id,
      ],
    );
    sendJson(response, 201, { draft: mapDraft(result.rows[0]) });
    return true;
  }

  const draftMatch = url.pathname.match(/^\/v1\/admin\/quest-drafts\/([0-9a-f-]{36})$/);
  if (draftMatch && request.method === "GET") {
    const result = await pool.query(`SELECT * FROM quest_content_drafts WHERE id = $1`, [draftMatch[1]]);
    if (!result.rowCount) throw new ExtensionError(404, "QUEST_DRAFT_NOT_FOUND");
    sendJson(response, 200, { draft: mapDraft(result.rows[0]) });
    return true;
  }
  if (draftMatch && request.method === "PUT") {
    const input = validateQuestDraft(await readJson(request));
    const result = await pool.query(
      `UPDATE quest_content_drafts
          SET quest_id = $2, title = $3, public_definition = $4::jsonb,
              judge_definition = $5::jsonb, revision = revision + 1,
              status = 'draft', updated_by = $6, updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [
        draftMatch[1],
        input.questId,
        input.title,
        JSON.stringify(input.publicDefinition),
        JSON.stringify(input.judgeDefinition),
        player.id,
      ],
    );
    if (!result.rowCount) throw new ExtensionError(404, "QUEST_DRAFT_NOT_FOUND");
    sendJson(response, 200, { draft: mapDraft(result.rows[0]) });
    return true;
  }
  if (draftMatch && request.method === "DELETE") {
    const result = await pool.query(
      `DELETE FROM quest_content_drafts WHERE id = $1 RETURNING id`,
      [draftMatch[1]],
    );
    if (!result.rowCount) throw new ExtensionError(404, "QUEST_DRAFT_NOT_FOUND");
    sendJson(response, 204, {});
    return true;
  }

  const previewMatch = url.pathname.match(
    /^\/v1\/admin\/quest-drafts\/([0-9a-f-]{36})\/preview$/,
  );
  if (request.method === "POST" && previewMatch) {
    const result = await pool.query(`SELECT * FROM quest_content_drafts WHERE id = $1`, [previewMatch[1]]);
    if (!result.rowCount) throw new ExtensionError(404, "QUEST_DRAFT_NOT_FOUND");
    const row = result.rows[0];
    const warnings = [];
    if (!row.public_definition?.problem?.sampleInput) warnings.push("Sample input is empty.");
    if (!row.public_definition?.problem?.sampleOutput) warnings.push("Sample output is empty.");
    if ((row.judge_definition?.tests?.length ?? 0) < 3) warnings.push("Fewer than three tests.");
    sendJson(response, 200, {
      preview: {
        token: crypto.randomUUID(),
        questId: row.quest_id,
        publicDefinition: row.public_definition,
        judgeSummary: {
          tests: row.judge_definition?.tests?.length ?? 0,
          language: row.judge_definition?.language ?? "cpp14",
          timeLimitMs: row.judge_definition?.timeLimitMs ?? 1000,
          memoryLimitMb: row.judge_definition?.memoryLimitMb ?? 64,
        },
        warnings,
      },
    });
    return true;
  }

  const publishMatch = url.pathname.match(
    /^\/v1\/admin\/quest-drafts\/([0-9a-f-]{36})\/publish$/,
  );
  if (request.method === "POST" && publishMatch) {
    const body = await readJson(request, 8 * 1024);
    sendJson(response, 200, {
      release: await publishDraft(player, publishMatch[1], body.note),
    });
    return true;
  }

  const versionsMatch = url.pathname.match(
    /^\/v1\/admin\/quests\/([a-z0-9-]{1,96})\/versions$/,
  );
  if (request.method === "GET" && versionsMatch) {
    const result = await pool.query(
      `SELECT quest_id, version, public_definition, judge_definition, note, created_at
         FROM quest_versions
        WHERE quest_id = $1
        ORDER BY version DESC`,
      [versionsMatch[1]],
    );
    sendJson(response, 200, {
      versions: result.rows.map((row) => ({
        questId: row.quest_id,
        version: row.version,
        publicDefinition: row.public_definition,
        judgeDefinition: row.judge_definition,
        note: row.note,
        createdAt: asIso(row.created_at),
      })),
    });
    return true;
  }

  const rollbackMatch = url.pathname.match(
    /^\/v1\/admin\/quests\/([a-z0-9-]{1,96})\/versions\/(\d+)\/rollback$/,
  );
  if (request.method === "POST" && rollbackMatch) {
    const body = await readJson(request, 8 * 1024);
    sendJson(response, 200, {

      release: await rollbackQuest(
        player,
        rollbackMatch[1],
        Number(rollbackMatch[2]),
        body.note,
      ),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/unlock-rules") {
    sendJson(response, 200, { rules: await loadUnlockRules() });
    return true;
  }

  const ruleMatch = url.pathname.match(
    /^\/v1\/admin\/unlock-rules\/([a-z0-9-]{1,96})$/,
  );
  if (request.method === "PUT" && ruleMatch) {
    const body = await readJson(request, 32 * 1024);
    const rule = normalizeRule(body.rule);
    const result = await pool.query(
      `INSERT INTO quest_unlock_rules(quest_id, enabled, label, rule, updated_by, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, now())
       ON CONFLICT (quest_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         label = EXCLUDED.label,
         rule = EXCLUDED.rule,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING *`,
      [
        ruleMatch[1],
        body.enabled !== false,
        boundedText(body.label, 160, ruleMatch[1]),
        JSON.stringify(rule),
        player.id,
      ],
    );
    const row = result.rows[0];
    sendJson(response, 200, {
      rule: {
        questId: row.quest_id,
        enabled: row.enabled,
        label: row.label,
        rule: row.rule,
        updatedAt: asIso(row.updated_at),
      },
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/codex") {
    const result = await pool.query(`SELECT * FROM codex_entries ORDER BY sort_order, id`);
    sendJson(response, 200, { entries: result.rows.map(codexRow) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/admin/codex") {
    const input = validateCodex(await readJson(request));
    try {
      const result = await pool.query(
        `INSERT INTO codex_entries
           (id, category, quest_id, marker, title, summary, explanation, checkpoints,
            time_complexity, space_complexity, tags, code, published, sort_order,
            created_by, updated_by, created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
            $9, $10, $11::jsonb, $12, $13, $14, $15, $15, now(), now())
         RETURNING *`,
        [
          input.id,
          input.category,
          input.questId,
          input.marker,
          JSON.stringify(input.title),
          JSON.stringify(input.summary),
          JSON.stringify(input.explanation),
          JSON.stringify(input.checkpoints),
          input.timeComplexity,
          input.spaceComplexity,
          JSON.stringify(input.tags),
          input.code,
          input.published,
          input.sortOrder,
          player.id,
        ],
      );
      sendJson(response, 201, { entry: codexRow(result.rows[0]) });
    } catch (error) {
      if (error.code === "23505") throw new ExtensionError(409, "CODEX_ENTRY_EXISTS");
      throw error;
    }
    return true;
  }

  const codexMatch = url.pathname.match(/^\/v1\/admin\/codex\/([a-z0-9-]{1,64})$/);
  if (codexMatch && request.method === "PUT") {
    const input = validateCodex(await readJson(request), codexMatch[1]);
    const result = await pool.query(
      `UPDATE codex_entries
          SET category = $2, quest_id = $3, marker = $4, title = $5::jsonb,
              summary = $6::jsonb, explanation = $7::jsonb,
              checkpoints = $8::jsonb, time_complexity = $9,
              space_complexity = $10, tags = $11::jsonb, code = $12,
              published = $13, sort_order = $14, updated_by = $15, updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [
        input.id,
        input.category,
        input.questId,
        input.marker,
        JSON.stringify(input.title),
        JSON.stringify(input.summary),
        JSON.stringify(input.explanation),
        JSON.stringify(input.checkpoints),
        input.timeComplexity,
        input.spaceComplexity,
        JSON.stringify(input.tags),
        input.code,
        input.published,
        input.sortOrder,
        player.id,
      ],
    );
    if (!result.rowCount) throw new ExtensionError(404, "CODEX_ENTRY_NOT_FOUND");
    sendJson(response, 200, { entry: codexRow(result.rows[0]) });
    return true;
  }
  if (codexMatch && request.method === "DELETE") {
    const result = await pool.query(`DELETE FROM codex_entries WHERE id = $1 RETURNING id`, [codexMatch[1]]);
    if (!result.rowCount) throw new ExtensionError(404, "CODEX_ENTRY_NOT_FOUND");
    sendJson(response, 204, {});
    return true;
  }

  return false;
}

function handleExtensionFailure(response, error) {
  if (response.writableEnded) return;
  if (error instanceof ExtensionError) {
    sendJson(response, error.status, { error: error.code, ...error.details });
    return;
  }
  console.error(JSON.stringify({
    level: "error",
    service: "core-api",
    event: "learning_request_failed",
    message: error.message,
  }));
  sendJson(response, 500, { error: "LEARNING_REQUEST_FAILURE" });
}

export async function handleLearningRequest(request, response) {
  try {
    return await handleExtensionRoute(request, response);
  } catch (error) {
    handleExtensionFailure(response, error);
    return true;
  }
}
