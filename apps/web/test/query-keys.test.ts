import { describe, expect, it } from "vitest";
import { branchQueryKeys } from "../src/lib/query-keys";

describe("branchQueryKeys", () => {
  it("normalizes missing branch scope to an explicit all marker", () => {
    expect(branchQueryKeys.list("members", undefined)).toEqual(["members", { branchId: "all" }]);
    expect(branchQueryKeys.list("members", null)).toEqual(["members", { branchId: "all" }]);
  });

  it("keeps concrete branch scopes and suffixes stable", () => {
    expect(branchQueryKeys.list("schedule", "branch-1", "agenda")).toEqual([
      "schedule",
      { branchId: "branch-1" },
      "agenda"
    ]);
  });
});
