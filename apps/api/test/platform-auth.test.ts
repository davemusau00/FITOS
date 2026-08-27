import type { Reflector } from "@nestjs/core";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher } from "@fitos/auth";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";
import { PlatformAdminGuard } from "../src/common/auth/platform-admin.guard.js";
import { PlatformController } from "../src/modules/platform/signup.controller.js";
import { canTransitionTenantStatus, canUseCapability } from "@fitos/contracts";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

describe("platform authentication token lifecycle", () => {
  it("accepts only active, unrevoked, unexpired tokens belonging to platform admins", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    const other = await repository.findLoginIdentity("owner@pilates.fitos.test");
    if (!owner || !other) throw new Error("Seed identities missing.");

    const users = (repository as unknown as { users: Map<string, Record<string, unknown>> }).users;
    const ownerUser = users.get(owner.user.id);
    const otherUser = users.get(other.user.id);
    if (!ownerUser || !otherUser) throw new Error("Seed users missing.");
    ownerUser.isPlatformAdmin = true;

    await repository.createPlatformAdminToken({
      userId: owner.user.id,
      tokenHash: hash("valid"),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    await repository.createPlatformAdminToken({
      userId: owner.user.id,
      tokenHash: hash("expired"),
      expiresAt: new Date(Date.now() - 1_000).toISOString()
    });
    await repository.createPlatformAdminToken({
      userId: owner.user.id,
      tokenHash: hash("revoked"),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    await repository.revokePlatformAdminToken(hash("revoked"), new Date().toISOString());
    await repository.createPlatformAdminToken({
      userId: other.user.id,
      tokenHash: hash("cross-user"),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });

    expect(await repository.resolvePlatformAdminByTokenHash(hash("valid"))).toMatchObject({
      userId: owner.user.id
    });
    expect(await repository.resolvePlatformAdminByTokenHash(hash("expired"))).toBeNull();
    expect(await repository.resolvePlatformAdminByTokenHash(hash("revoked"))).toBeNull();
    expect(await repository.resolvePlatformAdminByTokenHash(hash("cross-user"))).toBeNull();

    ownerUser.status = "inactive";
    expect(await repository.resolvePlatformAdminByTokenHash(hash("valid"))).toBeNull();
  });
});

describe("platform admin guard", () => {
  const context = (token?: string) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          header: (name: string) => (name.toLowerCase() === "x-platform-token" ? token : undefined)
        })
      })
    }) as never;

  it.each([
    ["missing-session", undefined],
    ["invalid-token", "not-a-real-token"]
  ])("rejects %s platform sessions", async (_name, token) => {
    const repository = {
      resolvePlatformAdminByTokenHash: async () => null
    } as never;
    const guard = new PlatformAdminGuard(
      { getAllAndOverride: () => true } as unknown as Reflector,
      repository
    );
    await expect(guard.canActivate(context(token))).rejects.toMatchObject({
      status: token ? 403 : 401
    });
  });
});

describe("platform overview", () => {
  it("returns aggregate lifecycle and explicit unknown provider health", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const overview = await new PlatformController(repository).overview();

    expect(overview.tenants.total).toBeGreaterThan(0);
    expect(overview.activity.activeMembers).toBeGreaterThanOrEqual(0);
    expect(overview.health.redis).toBe("unknown");
    expect(overview.activity.bookingsToday).toBeNull();
    expect(Object.keys(overview.implementation)).toEqual(
      expect.arrayContaining(["submitted", "approved", "converted"])
    );
  });
});

describe("platform lifecycle and capability policy", () => {
  it("allows only declared lifecycle transitions", () => {
    expect(canTransitionTenantStatus("trial", "active")).toBe(true);
    expect(canTransitionTenantStatus("trial", "archived")).toBe(false);
    expect(canTransitionTenantStatus("archived", "active")).toBe(false);
  });

  it("requires entitlement, rollout, and an operational tenant status", () => {
    const input = {
      capability: "feature.insights" as const,
      entitlements: ["feature.insights" as const],
      enabledFlags: ["feature.insights"],
      status: "active" as const
    };
    expect(canUseCapability(input)).toBe(true);
    expect(canUseCapability({ ...input, enabledFlags: [] })).toBe(false);
    expect(canUseCapability({ ...input, status: "suspended" })).toBe(false);
  });
});

describe("platform tenant lifecycle mutation", () => {
  it("requires a valid transition, reason, and records the mutation", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const [tenant] = await repository.listPlatformTenantControls();
    if (!tenant) throw new Error("Seed tenant missing.");
    const controller = new PlatformController(repository);
    const request = { platformActor: { userId: "platform-admin" } } as never;

    const updated = await controller.transitionTenantStatus(
      tenant.tenant.id,
      { status: "active", reason: "Pilot approved" },
      "request-1",
      request
    );
    expect(updated.status).toBe("active");
    await expect(
      controller.transitionTenantStatus(
        tenant.tenant.id,
        { status: "trial", reason: "Invalid rollback" },
        "request-2",
        request
      )
    ).rejects.toThrow(/cannot transition/i);
  });

  it("exposes one canonical platform feature registry", async () => {
    const controller = new PlatformController(new InMemoryFitosRepository());
    const features = controller.listPlatformFeatures();
    expect(features.map((feature) => feature.key)).toContain("feature.insights");
    expect(features.find((feature) => feature.key === "feature.automations")).toMatchObject({
      maturity: "beta",
      defaultEnabled: false
    });
  });
});
