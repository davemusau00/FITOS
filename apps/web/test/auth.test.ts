import type { AuthMeResponse } from "@fitos/contracts";
import { describe, expect, it } from "vitest";
import { can } from "../src/app/auth.js";
import { returnPathFromLocationState } from "../src/features/auth/LoginPage.js";

describe("permission-aware UI actions", () => {
  it("uses server-resolved capabilities and denies absent permissions", () => {
    const auth = {
      permissions: ["payment:read", "payment:record"]
    } as unknown as AuthMeResponse;

    expect(can(auth, "payment:record")).toBe(true);
    expect(can(auth, "payment:refund")).toBe(false);
    expect(can(null, "payment:record")).toBe(false);
  });
});

describe("session destination", () => {
  it("retains pathname, query, and hash after authentication", () => {
    expect(
      returnPathFromLocationState(
        { from: { pathname: "/app/members", search: "?query=active", hash: "#filters" } },
        "/app/overview"
      )
    ).toBe("/app/members?query=active#filters");
  });

  it("uses the workspace fallback for missing or malformed state", () => {
    expect(returnPathFromLocationState(null, "/app/overview")).toBe("/app/overview");
    expect(returnPathFromLocationState({ from: {} }, "/app/overview")).toBe("/app/overview");
  });
});
