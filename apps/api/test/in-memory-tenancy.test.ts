import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher, hashSessionToken } from "@fitos/auth";
import type { CreateMemberRequest } from "@fitos/contracts";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

const memberInput = (branchId: string): CreateMemberRequest => ({
  contact: { firstName: "Amina", lastName: "Otieno", phone: "0712345678" },
  homeBranchId: branchId
});

describe("tenant isolation", () => {
  it("scopes inbox items to their user and persists read state", async () => {
    const repository = new InMemoryFitosRepository();
    const item = await repository.createNotification({
      userId: "user-1",
      category: "operations",
      title: "Follow-up due",
      body: "Review the overdue task.",
      href: "/app/leads"
    });
    await expect(repository.listNotifications("user-2")).resolves.toEqual([]);
    await expect(repository.markNotificationRead("user-2", item.id)).resolves.toBeNull();
    const read = await repository.markNotificationRead("user-1", item.id);
    expect(read?.readAt).toBeTruthy();
    await expect(repository.listNotifications("user-1")).resolves.toMatchObject([
      { id: item.id, readAt: read?.readAt }
    ]);
  });

  it("persists editable canonical plan definitions", async () => {
    const repository = new InMemoryFitosRepository();
    const current = (await repository.listPlatformPlanDefinitions()).find(
      (plan) => plan.key === "starter"
    );
    expect(current).toBeTruthy();
    const updated = await repository.updatePlatformPlanDefinition("starter", {
      name: "FITOS Starter Plus",
      description: "Updated starter workspace plan",
      quotas: { ...current!.quotas, maxMembers: 600 },
      capabilities: current!.capabilities
    });
    expect(updated?.name).toBe("FITOS Starter Plus");
    await expect(repository.listPlatformPlanDefinitions()).resolves.toContainEqual(updated);
  });

  it("applies active tenant feature overrides when evaluating flags", async () => {
    const repository = new InMemoryFitosRepository();
    const passwordHash = await new ScryptPasswordHasher().hash("ChangeMe123!");
    await repository.seedDevelopmentData?.(passwordHash);
    const identity = await repository.findLoginIdentity("owner@gym.fitos.test");
    expect(identity).toBeTruthy();
    const before = await repository.listFeatureFlags(identity!.tenant.id);
    const target = before.find((flag) => flag.key === "feature.integrations");
    expect(target?.enabled).toBe(true);
    await repository.createPlatformFeatureFlagOverride({
      key: "feature.integrations",
      scope: "tenant",
      scopeValue: identity!.tenant.id,
      enabled: false,
      reason: "Pause integrations for pilot",
      actorUserId: null,
      previousEnabled: false,
      effectiveFrom: null,
      effectiveUntil: null
    });
    const after = await repository.listFeatureFlags(identity!.tenant.id);
    expect(after.find((flag) => flag.key === "feature.integrations")?.enabled).toBe(false);
  });

  it("persists staff notification preferences with safe defaults", async () => {
    const repository = new InMemoryFitosRepository();
    const defaults = await repository.getNotificationPreferences("user-1");
    expect(defaults).toMatchObject({ email: true, sms: false, bookingReminders: true });

    const updated = await repository.updateNotificationPreferences("user-1", {
      email: false,
      sms: true,
      bookingReminders: false,
      operationalAlerts: true,
      leadFollowUps: false
    });
    expect(updated).toEqual({
      email: false,
      sms: true,
      bookingReminders: false,
      operationalAlerts: true,
      leadFollowUps: false
    });
    await expect(repository.getNotificationPreferences("user-1")).resolves.toEqual(updated);
    await expect(repository.getNotificationPreferences("user-2")).resolves.toEqual(defaults);
  });

  it("rejects a known member ID belonging to another tenant", async () => {
    const repository = new InMemoryFitosRepository();
    const passwordHash = await new ScryptPasswordHasher().hash("ChangeMe123!");
    await repository.seedDevelopmentData?.(passwordHash);
    const gym = await repository.findLoginIdentity("owner@gym.fitos.test");
    const pilates = await repository.findLoginIdentity("owner@pilates.fitos.test");
    expect(gym).not.toBeNull();
    expect(pilates).not.toBeNull();
    if (!gym || !pilates) throw new Error("Seed identities missing.");
    const gymScope = {
      tenantId: gym.tenant.id,
      tenantUserId: gym.tenantUserId,
      userId: gym.user.id,
      branchIds: gym.branchIds
    };
    const pilatesScope = {
      tenantId: pilates.tenant.id,
      tenantUserId: pilates.tenantUserId,
      userId: pilates.user.id,
      branchIds: pilates.branchIds
    };
    const member = await repository.createMember(
      gymScope,
      memberInput(gym.branchIds[0]!),
      "+254712345678"
    );

    await expect(repository.findMemberById(pilatesScope, member.id)).resolves.toBeNull();
    await expect(repository.searchMembers(pilatesScope, { query: "Amina" })).resolves.toMatchObject(
      { data: [] }
    );

    const pilatesService = await repository.createService(pilatesScope, {
      name: "Pilates Isolation Test",
      serviceType: "class",
      durationMinutes: 60,
      defaultCapacity: 4,
      branchId: pilates.branchIds[0]
    });
    const pilatesOccurrence = await repository.createScheduleOccurrence(pilatesScope, {
      branchId: pilates.branchIds[0]!,
      serviceId: pilatesService.id,
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 90_000_000).toISOString(),
      capacity: 4
    });
    await expect(repository.memberSelfBook(member.id, pilatesOccurrence.id)).rejects.toThrow(
      /occurrence not found/i
    );
  });

  it("binds an opaque session to one tenant user and permits revocation", async () => {
    const repository = new InMemoryFitosRepository();
    const passwordHash = await new ScryptPasswordHasher().hash("ChangeMe123!");
    await repository.seedDevelopmentData?.(passwordHash);
    const identity = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!identity) throw new Error("Seed identity missing.");
    const tokenHash = hashSessionToken("opaque-test-token");
    await repository.createSession({
      userId: identity.user.id,
      tenantUserId: identity.tenantUserId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    const resolved = await repository.resolveSession(tokenHash, new Date().toISOString());
    expect(resolved?.tenant.id).toBe(identity.tenant.id);
    await repository.revokeSession(tokenHash, new Date().toISOString());
    await expect(
      repository.resolveSession(tokenHash, new Date().toISOString())
    ).resolves.toBeNull();
  });

  it("persists and resolves multiple staff role assignments", async () => {
    const repository = new InMemoryFitosRepository();
    const passwordHash = await new ScryptPasswordHasher().hash("ChangeMe123!");
    await repository.seedDevelopmentData?.(passwordHash);
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!owner) throw new Error("Owner identity missing.");
    const scope = {
      tenantId: owner.tenant.id,
      tenantUserId: owner.tenantUserId,
      userId: owner.user.id,
      branchIds: owner.branchIds
    };
    const roles = await repository.listRoles(scope);
    const trainer = roles.find((role) => role.key === "trainer");
    const manager = roles.find((role) => role.key === "manager");
    if (!trainer || !manager) throw new Error("Expected seeded roles missing.");
    const invited = await repository.inviteStaff(scope, {
      email: "multi-role@gym.fitos.test",
      displayName: "Multi Role",
      roleId: trainer.id,
      branchIds: [owner.branchIds[0]!]
    });
    const updated = await repository.updateStaffAccess(scope, invited.user.id, {
      roleId: trainer.id,
      roleIds: [trainer.id, manager.id],
      branchIds: [owner.branchIds[0]!]
    });
    expect(updated?.roles?.map((role) => role.key)).toEqual(["trainer", "manager"]);
  });

  it("completes lead tasks only within the owning lead and tenant", async () => {
    const repository = new InMemoryFitosRepository();
    const passwordHash = await new ScryptPasswordHasher().hash("ChangeMe123!");
    await repository.seedDevelopmentData?.(passwordHash);
    const gym = await repository.findLoginIdentity("owner@gym.fitos.test");
    const pilates = await repository.findLoginIdentity("owner@pilates.fitos.test");
    if (!gym || !pilates) throw new Error("Seed identities missing.");
    const gymScope = {
      tenantId: gym.tenant.id,
      tenantUserId: gym.tenantUserId,
      userId: gym.user.id,
      branchIds: gym.branchIds
    };
    const pilatesScope = {
      tenantId: pilates.tenant.id,
      tenantUserId: pilates.tenantUserId,
      userId: pilates.user.id,
      branchIds: pilates.branchIds
    };
    const lead = (await repository.createLead(
      gymScope,
      {
        contact: { firstName: "Task", lastName: "Lead", phone: "0712345678" },
        branchId: gym.branchIds[0]
      },
      "+254712345678"
    ))!;
    const task = await repository.createLeadTask(gymScope, lead.id, { body: "Call prospect" });
    expect(task?.completedAt).toBeNull();
    await expect(repository.completeLeadTask(pilatesScope, lead.id, task!.id)).resolves.toBeNull();
    const completed = await repository.completeLeadTask(gymScope, lead.id, task!.id);
    expect(completed?.completedAt).not.toBeNull();
    expect((await repository.completeLeadTask(gymScope, lead.id, task!.id))?.id).toBe(task!.id);
  });
});
