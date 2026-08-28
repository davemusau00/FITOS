import type { AuthMeResponse } from "@fitos/contracts";
import { describe, expect, it } from "vitest";
import { can } from "../src/app/auth.js";
import { returnPathFromLocationState } from "../src/features/auth/LoginPage.js";
import { filterCommandItems } from "../src/app/command-palette.js";

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

describe("permission-filtered command navigation", () => {
  it("hides restricted entries and deduplicates paths", () => {
    const items = filterCommandItems(
      [
        {
          id: "allowed",
          label: "Allowed",
          type: "Navigation",
          icon: "dashboard",
          to: "/same",
          permission: "tenant:read"
        },
        {
          id: "restricted",
          label: "Restricted",
          type: "Navigation",
          icon: "shield",
          to: "/restricted",
          permission: "staff:manage"
        },
        { id: "duplicate", label: "Duplicate", type: "Action", icon: "plus", to: "/same" }
      ],
      ["tenant:read"]
    );
    expect(items.map((item) => item.to)).toEqual(["/same"]);
  });
});
