import { createHash, randomBytes } from "node:crypto";

export const createOpaqueSessionToken = (): string => randomBytes(32).toString("base64url");

export const hashSessionToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("base64url");

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
