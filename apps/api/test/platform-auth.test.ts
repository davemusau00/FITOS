import type { Reflector } from "@nestjs/core";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashSessionToken, ScryptPasswordHasher } from "@fitos/auth";
import { AuthService } from "../src/common/auth/auth.service.js";
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

describe("platform audit projection", () => {
  it("returns control-plane events without exposing unrelated tenant activity", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.recordAudit({
      tenantId: "tenant-1",
      actorUserId: "platform-user",
      action: "tenant.capabilities_changed",
      resourceType: "tenant_subscription",
      resourceId: "tenant-1",
      afterSummary: { capabilities: ["advanced_reporting"] },
      requestId: "request-1"
    });
    await repository.recordAudit({
      tenantId: "tenant-1",
      actorUserId: "tenant-user",
      action: "member.updated",
      resourceType: "member",
      resourceId: "member-1",
      requestId: "request-2"
    });

    const events = await repository.listPlatformAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "tenant.capabilities_changed",
      resourceType: "tenant_subscription"
    });
  });
});

describe("plan change decisions", () => {
  it("persists decisions and applies immediate approvals while retaining future dates", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.("hash");
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!owner) throw new Error("Seed identity missing.");
    const scope = {
      tenantId: owner.tenant.id,
      tenantUserId: owner.tenantUserId,
      userId: owner.user.id,
      branchIds: owner.branchIds
    };
    const request = await repository.createPlanChangeRequest(scope, owner.user.id, "business");
    const future = new Date(Date.now() + 86_400_000);
    const decided = await repository.decidePlanChangeRequest(
      request.id,
      "approved",
      "Scheduled upgrade",
      owner.user.id,
      future
    );
    expect(decided).toMatchObject({
      status: "approved",
      requestedPlan: "business",
      effectiveAt: future.toISOString()
    });
    expect((await repository.getTenantSubscription(owner.tenant.id)).plan).not.toBe("business");
  });
});

describe("account lifecycle requests", () => {
  it("persists cancellation review and requires explicit deletion confirmation", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.("hash");
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!owner) throw new Error("Seed identity missing.");
    const scope = {
      tenantId: owner.tenant.id,
      tenantUserId: owner.tenantUserId,
      userId: owner.user.id,
      branchIds: owner.branchIds
    };
    const cancellation = await repository.createAccountCancellationRequest(
      scope,
      owner.user.id,
      "Closing the gym"
    );
    expect(
      await repository.decideAccountCancellationRequest(
        cancellation.id,
        "reviewing",
        "Under review",
        owner.user.id
      )
    ).toMatchObject({ status: "reviewing" });
    const deletion = await repository.createAccountDeletionRequest(
      scope,
      owner.user.id,
      "DELETE WORKSPACE",
      "Remove workspace"
    );
    expect(deletion.confirmation).toBe("DELETE WORKSPACE");
    expect((await repository.listAccountDeletionRequests(scope)).map((item) => item.id)).toContain(
      deletion.id
    );
  });
});

describe("account export lifecycle", () => {
  it("moves an export request through Platform processing to completion", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.("hash");
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!owner) throw new Error("Seed identity missing.");
    const scope = {
      tenantId: owner.tenant.id,
      tenantUserId: owner.tenantUserId,
      userId: owner.user.id,
      branchIds: owner.branchIds
    };
    const created = await repository.createAccountExportRequest(scope, owner.user.id);
    expect(
      (await repository.updateAccountExportRequestStatus(created.id, "processing"))?.status
    ).toBe("processing");
    const completed = await repository.updateAccountExportRequestStatus(created.id, "completed");
    expect(completed?.completedAt).toBeTruthy();
    expect(await repository.updateAccountExportRequestStatus(created.id, "processing")).toBeNull();
  });
});

describe("saas plan catalog", () => {
  it("exposes canonical plans with shared quotas and only stable defaults", async () => {
    const repository = new InMemoryFitosRepository();
    const controller = new PlatformController(repository);
    const plans = await controller.listPlatformPlans();
    expect(plans.map((plan) => plan.key)).toEqual(["starter", "pro", "business"]);
    expect(plans[0]?.quotas.maxMembers).toBe(500);
    expect(plans.every((plan) => !plan.capabilities.includes("feature.therapy"))).toBe(true);
  });
});

describe("scoped feature flag overrides", () => {
  it("validates scope and records a reasoned override", async () => {
    const repository = new InMemoryFitosRepository();
    const controller = new PlatformController(repository);
    const request = { platformActor: { userId: "platform-user" } } as never;
    await expect(
      controller.createFeatureFlagOverride(
        { key: "feature.unknown", scope: "global", scopeValue: null, enabled: true, reason: "bad" },
        "request-id",
        request
      )
    ).rejects.toThrow("Unknown feature flag key");
    const created = await controller.createFeatureFlagOverride(
      {
        key: "feature.sites",
        scope: "tenant",
        scopeValue: "tenant-1",
        enabled: true,
        reason: "Pilot rollout"
      },
      "request-id",
      request
    );
    expect(created.scope).toBe("tenant");
    expect((await repository.listPlatformFeatureFlagOverrides())[0]?.reason).toBe("Pilot rollout");
  });
});

describe("platform account recovery cases", () => {
  it("records verification, revokes subject sessions, and audits the case", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!owner) throw new Error("Seed identity missing.");
    await repository.createSession({
      userId: owner.user.id,
      tenantUserId: owner.tenantUserId,
      tokenHash: "recovery-controller-session",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    const controller = new PlatformController(repository);
    const result = await controller.createAccountRecoveryCase(
      owner.tenant.id,
      {
        subject: { userId: owner.user.id, email: owner.user.email },
        verificationMetadata: { ticket: "SUP-RECOVERY", verifiedBy: "phone" },
        actionType: "recovery_step",
        actionDetail: "Issued a one-time recovery link after callback verification.",
        revokeSessions: true,
        outcome: "resolved"
      },
      "recovery-request",
      { platformActor: { userId: "platform-user" } } as never
    );
    expect(result.sessionRevocation).toMatchObject({ requested: true, revokedCount: 1 });
    expect(result.outcome).toBe("resolved");
    expect((await repository.listPlatformAuditEvents())[0]?.action).toBe(
      "platform.account_recovery_case_created"
    );
  });
});

describe("staff password and session lifecycle", () => {
  it("changes the password, preserves the current session, and revokes other sessions", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const auth = new AuthService(repository);
    const first = await auth.login(
      { email: "owner@gym.fitos.test", password: "ChangeMe123!" },
      { userAgentSummary: "test-current" }
    );
    const second = await auth.login(
      { email: "owner@gym.fitos.test", password: "ChangeMe123!" },
      { userAgentSummary: "test-other" }
    );
    const current = await repository.resolveSession(
      hashSessionToken(first.sessionToken),
      new Date().toISOString()
    );
    const other = await repository.resolveSession(
      hashSessionToken(second.sessionToken),
      new Date().toISOString()
    );
    if (!current || !other) throw new Error("Expected test sessions.");

    await auth.changePassword(current, "ChangeMe123!", "NewChangeMe123!");

    await expect(
      repository.resolveSession(hashSessionToken(first.sessionToken), new Date().toISOString())
    ).resolves.toMatchObject({ sessionId: current.sessionId });
    await expect(
      repository.resolveSession(hashSessionToken(second.sessionToken), new Date().toISOString())
    ).resolves.toBeNull();
    await expect(
      auth.login({ email: "owner@gym.fitos.test", password: "ChangeMe123!" }, {})
    ).rejects.toThrow(/incorrect/i);
    await expect(
      auth.login({ email: "owner@gym.fitos.test", password: "NewChangeMe123!" }, {})
    ).resolves.toBeTruthy();
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

describe("platform logout", () => {
  it("revokes the presented platform token before the client clears it", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!owner) throw new Error("Seed identity missing.");
    const rawToken = "logout-token";
    await repository.createPlatformAdminToken({
      userId: owner.user.id,
      tokenHash: hash(rawToken),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    const controller = new PlatformController(repository);
    await expect(
      controller.platformAdminLogout({
        header: (name: string) => (name === "x-platform-token" ? rawToken : undefined)
      } as never)
    ).resolves.toEqual({ ok: true });
    await expect(repository.resolvePlatformAdminByTokenHash(hash(rawToken))).resolves.toBeNull();
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

  it("replaces tenant capabilities without duplicate grants", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const [tenant] = await repository.listPlatformTenantControls();
    if (!tenant) throw new Error("Seed tenant missing.");
    const updated = await repository.updateTenantCapabilities(tenant.tenant.id, [
      "feature.insights",
      "feature.insights"
    ]);
    expect(updated?.capabilities).toEqual(["feature.insights"]);
    expect(
      (await repository.listFeatureFlags(tenant.tenant.id)).find(
        (flag) => flag.key === "feature.insights"
      )?.enabled
    ).toBe(true);
  });
});
