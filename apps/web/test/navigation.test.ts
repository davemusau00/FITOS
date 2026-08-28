import { describe, expect, it } from "vitest";
import { routeManifest, routeMetaForPath } from "../src/app/navigation";

describe("route manifest", () => {
  it("contains unique canonical paths for navigable routes", () => {
    const paths = routeManifest.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("resolves query-bearing paths to their canonical metadata", () => {
    expect(routeMetaForPath("/app/schedule?view=agenda")).toMatchObject({
      path: "/app/schedule",
      branchMode: "optional",
      mobileMode: "agenda"
    });
  });
});
