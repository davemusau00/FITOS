import type { AuthMeResponse } from "@fitos/contracts";
import { describe, expect, it } from "vitest";
import { can } from "../src/app/auth.js";

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
