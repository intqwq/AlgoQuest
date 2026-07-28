export type Player = {
  id: string;
  displayName: string;
  email: string | null;
  emailVerified: boolean;
  isGuest: boolean;
};

type SessionResponse = {
  sessionToken: string;
  player: Player;
};

export type AuthConfig = {
  turnstileSiteKey: string;
  emailDelivery: "resend" | "local-log";
};

export type QuestProgress = {
  questId: string;
  status: "started" | "cleared";
  bestScore: number;
  updatedAt: string;
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
let sessionPromise: Promise<string> | undefined;

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
  const request = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const response = await request(await ensureSession());
  if (response.status !== 401) return response;

  forgetSession();
  return request(await ensureSession());
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
  const response = await fetch(apiUrl("/auth/config"), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("Account security configuration is offline.");
  return response.json() as Promise<AuthConfig>;
}

export async function loadCurrentPlayer(): Promise<Player> {
  const response = await authenticatedFetch(apiUrl("/me"), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Player API returned HTTP ${response.status}.`);
  const body = (await response.json()) as { player: Player };
  return body.player;
}

export async function registerAccount(input: {
  displayName: string;
  email: string;
  password: string;
  turnstileToken: string;
}) {
  await ensureSession();
  await authPost("/auth/register", input);
  return loadCurrentPlayer();
}

export async function loginAccount(input: {
  email: string;
  password: string;
  turnstileToken: string;
}) {
  const body = await authPost("/auth/login", input);
  return storeSession(body as SessionResponse);
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

export async function updatePlayerProfile(displayName: string) {
  const response = await authenticatedFetch(apiUrl("/me/profile"), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  const body = await parseAuthResponse(response);
  const player = (body as unknown as { player: Player }).player;
  window.dispatchEvent(
    new CustomEvent("algoquest:session", { detail: player }),
  );
  return player;
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
