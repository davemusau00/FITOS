import { describe, expect, it } from "vitest";
import {
  createCsrfToken,
  createOpaqueSessionToken,
  hashSessionToken,
  verifyCsrfToken
} from "./sessions.js";

describe("session primitives", () => {
  it("creates opaque tokens and stores a non-reversible HMAC", () => {
    const token = createOpaqueSessionToken();
    expect(token).toHaveLength(43);
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("binds CSRF tokens to their session", () => {
    const session = createOpaqueSessionToken();
    const token = createCsrfToken(session);
    expect(verifyCsrfToken(token, session)).toBe(true);
    expect(verifyCsrfToken(token, createOpaqueSessionToken())).toBe(false);
  });
});
