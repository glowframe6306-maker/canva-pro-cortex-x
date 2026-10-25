import crypto from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";
const PENDING_COOKIE = "admin_pending";
const WEBAUTHN_COOKIE = "admin_webauthn_challenge";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const PENDING_TTL_SECONDS = 60 * 10;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type AttemptState = { count: number; lockedUntil: number };
const attempts = new Map<string, AttemptState>();
const revokedSessions = new Set<string>();

function getSecret(name: string): string {
  return String(process.env[name] || "").trim();
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(value: string): string {
  const secret = getSecret("ADMIN_SESSION_SECRET");
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured.");
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function createToken(type: "session" | "pending", ttlSeconds: number): string {
  const payload = `${type}.${Date.now() + ttlSeconds * 1000}.${crypto.randomBytes(24).toString("hex")}`;
  return `${encode(payload)}.${sign(payload)}`;
}

function isValidToken(token: string | undefined, expectedType: "session" | "pending"): boolean {
  if (!token) return false;
  if (expectedType === "session" && revokedSessions.has(token)) return false;
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return false;

  try {
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const [type, expiresAt] = payload.split(".");
    const expectedSignature = sign(payload);
    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature),
    );
    return type === expectedType && signaturesMatch && Number(expiresAt) > Date.now();
  } catch {
    return false;
  }
}

function verifyHash(value: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex || !value) return false;

  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = crypto.scryptSync(value, salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function attemptKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function canAttempt(key: string): boolean {
  const state = attempts.get(key);
  if (!state) return true;
  if (state.lockedUntil > Date.now()) return false;
  if (state.lockedUntil) attempts.delete(key);
  return true;
}

function recordFailure(key: string): void {
  const state = attempts.get(key) || { count: 0, lockedUntil: 0 };
  state.count += 1;
  if (state.count >= MAX_ATTEMPTS) state.lockedUntil = Date.now() + LOCKOUT_MS;
  attempts.set(key, state);
}

function clearFailures(key: string): void {
  attempts.delete(key);
}

export function getAdminAuthConfigError(): string | null {
  const missing = ["ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "ADMIN_SECURITY_PIN_HASH", "ADMIN_SESSION_SECRET"]
    .filter((name) => !getSecret(name));
  return missing.length ? `Missing server authentication configuration: ${missing.join(", ")}` : null;
}

export function verifyAdminCredentials(request: NextRequest, username: string, password: string): { ok: boolean; locked: boolean } {
  const key = `login:${attemptKey(request)}`;
  if (!canAttempt(key)) return { ok: false, locked: true };

  const ok = username.trim() === getSecret("ADMIN_USERNAME")
    && verifyHash(password, getSecret("ADMIN_PASSWORD_HASH"));
  if (!ok) recordFailure(key);
  else clearFailures(key);
  return { ok, locked: false };
}

export function verifyAdminPin(request: NextRequest, pin: string): { ok: boolean; locked: boolean } {
  const key = `pin:${attemptKey(request)}`;
  if (!canAttempt(key)) return { ok: false, locked: true };

  const ok = verifyHash(pin, getSecret("ADMIN_SECURITY_PIN_HASH"));
  if (!ok) recordFailure(key);
  else clearFailures(key);
  return { ok, locked: false };
}

export function setPendingLogin(response: NextResponse): void {
  response.cookies.set(PENDING_COOKIE, createToken("pending", PENDING_TTL_SECONDS), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: PENDING_TTL_SECONDS,
    path: "/",
  });
}

export function completeAdminLogin(request: NextRequest, response: NextResponse): boolean {
  if (!isValidToken(request.cookies.get(PENDING_COOKIE)?.value, "pending")) return false;
  response.cookies.set(SESSION_COOKIE, createToken("session", SESSION_TTL_SECONDS), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  response.cookies.set(PENDING_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return true;
}

export function createAdminSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, createToken("session", SESSION_TTL_SECONDS), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export function setWebAuthnChallenge(response: NextResponse, challenge: string, purpose: "registration" | "authentication"): void {
  const payload = `${purpose}.${challenge}`;
  response.cookies.set(WEBAUTHN_COOKIE, `${encode(payload)}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: PENDING_TTL_SECONDS,
    path: "/",
  });
}

export function getWebAuthnChallenge(request: NextRequest, purpose: "registration" | "authentication"): string | null {
  const token = request.cookies.get(WEBAUTHN_COOKIE)?.value;
  if (!token) return null;
  try {
    const [encodedPayload, providedSignature] = token.split(".");
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const expectedSignature = sign(payload);
    const valid = crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature));
    const [storedPurpose, challenge] = payload.split(".");
    return valid && storedPurpose === purpose ? challenge : null;
  } catch {
    return null;
  }
}

export function clearWebAuthnChallenge(response: NextResponse): void {
  response.cookies.set(WEBAUTHN_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
}

export function hasAdminSession(request: NextRequest): boolean {
  return isValidToken(request.cookies.get(SESSION_COOKIE)?.value, "session");
}

export function clearAdminSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  response.cookies.set(PENDING_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
}

export function revokeAdminSession(request: NextRequest): void {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) revokedSessions.add(token);
}

export function requireAdminSession(request: NextRequest): NextResponse | null {
  if (hasAdminSession(request)) return null;
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  }) as NextResponse;
}
