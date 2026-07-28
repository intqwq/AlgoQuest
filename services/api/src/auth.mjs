import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const passwordHashLength = 64;
const scryptParameters = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
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

export function normalizeEmail(value) {
  if (typeof value !== "string") return undefined;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined;
  return email;
}

export function passwordPolicyError(value) {
  if (typeof value !== "string") return "PASSWORD_REQUIRED";
  if (value.length < 10) return "PASSWORD_TOO_SHORT";
  if (value.length > 128) return "PASSWORD_TOO_LONG";
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return "PASSWORD_NEEDS_LETTER_AND_NUMBER";
  }
  return undefined;
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, passwordHashLength, scryptParameters);
  return [
    "scrypt",
    scryptParameters.N,
    scryptParameters.r,
    scryptParameters.p,
    salt.toString("base64url"),
    Buffer.from(derived).toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string") return false;
  const [algorithm, n, r, p, saltEncoded, hashEncoded] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !saltEncoded ||
    !hashEncoded ||
    Number(n) !== scryptParameters.N ||
    Number(r) !== scryptParameters.r ||
    Number(p) !== scryptParameters.p
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(hashEncoded, "base64url");
    const derived = Buffer.from(
      await scrypt(
        password,
        Buffer.from(saltEncoded, "base64url"),
        expected.length,
        scryptParameters,
      ),
    );
    return (
      expected.length === derived.length &&
      crypto.timingSafeEqual(expected, derived)
    );
  } catch {
    return false;
  }
}

export function clientIp(request) {
  const forwarded =
    request.headers["cf-connecting-ip"] ??
    request.headers["x-real-ip"] ??
    request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 128);
  }
  return request.socket?.remoteAddress?.slice(0, 128) ?? "unknown";
}
