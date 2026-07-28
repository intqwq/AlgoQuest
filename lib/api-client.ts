type SessionResponse = {
  sessionToken: string;
  player: {
    id: string;
    displayName: string;
  };
};

export type QuestProgress = {
  questId: string;
  status: "started" | "cleared";
  bestScore: number;
  updatedAt: string;
};

const apiBase = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1"
).replace(/\/$/, "");
const sessionStorageKey = "algoquest.session-token";
let sessionPromise: Promise<string> | undefined;

export function apiUrl(path: string) {
  return `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
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
  window.localStorage.setItem(sessionStorageKey, body.sessionToken);
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
  const request = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const response = await request(await ensureSession());
  if (response.status !== 401) return response;

  window.localStorage.removeItem(sessionStorageKey);
  return request(await ensureSession());
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
