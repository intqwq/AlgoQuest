import crypto from "node:crypto";

export const turnstileTestSiteKey = "1x00000000000000000000AA";
export const turnstileTestSecretKey = "1x0000000000000000000000000000000AA";

export function createTurnstileVerifier({
  secretKey,
  expectedHostname = "",
  fetchImpl = fetch,
}) {
  return {
    async verify({ token, remoteIp, action }) {
      if (!secretKey) {
        return { ok: false, code: "TURNSTILE_NOT_CONFIGURED" };
      }
      if (typeof token !== "string" || !token || token.length > 2048) {
        return { ok: false, code: "TURNSTILE_TOKEN_REQUIRED" };
      }

      try {
        const response = await fetchImpl(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              secret: secretKey,
              response: token,
              remoteip: remoteIp,
              idempotency_key: crypto.randomUUID(),
            }),
            signal: AbortSignal.timeout(8_000),
          },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          return {
            ok: false,
            code: "TURNSTILE_REJECTED",
            errors: result["error-codes"] ?? [],
          };
        }
        if (action && result.action !== action) {
          return { ok: false, code: "TURNSTILE_ACTION_MISMATCH" };
        }
        if (expectedHostname && result.hostname !== expectedHostname) {
          return { ok: false, code: "TURNSTILE_HOSTNAME_MISMATCH" };
        }
        return { ok: true };
      } catch {
        return { ok: false, code: "TURNSTILE_UNAVAILABLE" };
      }
    },
  };
}
