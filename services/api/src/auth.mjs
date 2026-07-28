import crypto from "node:crypto";

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function bearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") return undefined;
  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]{32,})$/);
  return match?.[1];
}

export function cleanDisplayName(value) {
  if (typeof value !== "string") return "PLAYER";
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.slice(0, 64) || "PLAYER";
}
