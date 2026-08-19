import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const createOpaqueSessionToken = (): string => randomBytes(32).toString("base64url");

const secretFor = (name: "SESSION_SECRET" | "CSRF_SECRET"): string =>
  process.env[name] ?? "local-development-only-change-me";

/** Store an HMAC, not the opaque session token itself, in the database. */
export const hashSessionToken = (token: string): string =>
  createHmac("sha256", secretFor("SESSION_SECRET")).update(token, "utf8").digest("base64url");

/** A signed double-submit token is bound to the active opaque session. */
export const createCsrfToken = (sessionToken: string): string => {
  const nonce = randomBytes(24).toString("base64url");
  const signature = createHmac("sha256", secretFor("CSRF_SECRET"))
    .update(`${sessionToken}.${nonce}`, "utf8")
    .digest("base64url");
  return `${nonce}.${signature}`;
};

export const verifyCsrfToken = (token: string, sessionToken: string): boolean => {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;
  const nonce = token.slice(0, separator);
  const received = token.slice(separator + 1);
  const expected = createHmac("sha256", secretFor("CSRF_SECRET"))
    .update(`${sessionToken}.${nonce}`, "utf8")
    .digest("base64url");
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
};

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      return cookies;
    }
    const key = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      // Invalid cookie encoding is intentionally ignored.
    }
    return cookies;
  }, {});
}
