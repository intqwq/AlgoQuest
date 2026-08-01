const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");
const sessionKey = "algoquest.session-token";

export function apiPath(path: string) {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  const token = typeof window !== "undefined" ? window.localStorage.getItem(sessionKey) : null;
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(apiPath(path), { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `HTTP_${response.status}`);
  return body;
}

export function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function parseJson(value: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label}_INVALID_JSON`);
  }
}

export function localText(value: Record<string, string> | undefined) {
  return value?.en ?? Object.values(value ?? {})[0] ?? "";
}

