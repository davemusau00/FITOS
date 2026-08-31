import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher, hashSessionToken } from "@fitos/auth";
import type { CreateMemberRequest } from "@fitos/contracts";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

const memberInput = (branchId: string): CreateMemberRequest => ({
  contact: { firstName: "Amina", lastName: "Otieno", phone: "0712345678" },
  homeBranchId: branchId
});

describe("tenant isolation", () => {
  it("persists member tags, assignments, updates, and removal", async () => {
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
    const member = (await repository.searchMembers(scope, { limit: 1 })).data[0];
    if (!member) throw new Error("Seed member missing.");
    const tag = await repository.createMemberTag(scope, { name: "VIP", color: "lime" });
    expect(await repository.listMemberTags(scope)).toContainEqual(tag);
    await expect(
      repository.assignMemberTag(scope, member.id, tag.id, owner.user.id)
    ).resolves.toEqual(tag);
    await expect(repository.listMemberTagsForMember(scope, member.id)).resolves.toEqual([tag]);
    await expect(
      repository.searchMembers(scope, { tagId: tag.id, limit: 10 })
    ).resolves.toMatchObject({
      data: [expect.objectContaining({ id: member.id })]
    });
    const updated = await repository.updateMemberTag(scope, tag.id, {
      name: "Priority",
      color: null
    });
    expect(updated).toMatchObject({ name: "Priority", color: null });
    await expect(repository.unassignMemberTag(scope, member.id, tag.id)).resolves.toBe(true);
    await expect(repository.deleteMemberTag(scope, tag.id)).resolves.toMatchObject({ id: tag.id });
    await expect(repository.listMemberTagsForMember(scope, member.id)).resolves.toEqual([]);
  });

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
    await repository.createPlatformFeatureFlagOverride({
      key: "feature.sites",
      scope: "pilot",
      scopeValue: `other-tenant, ${identity!.tenant.id}`,
      enabled: true,
      reason: "Sites pilot cohort",
      actorUserId: null,
      previousEnabled: false,
      effectiveFrom: null,
      effectiveUntil: null
    });
    expect(
      (await repository.listFeatureFlags(identity!.tenant.id)).find(
        (flag) => flag.key === "feature.sites"
      )?.enabled
    ).toBe(true);
  });

  it("keeps Platform support notes tenant-scoped", async () => {
    const repository = new InMemoryFitosRepository();
    const note = await repository.createPlatformSupportNote({
      tenantId: "tenant-1",
      authorUserId: "platform-user",
      category: "support",
      note: "Requested onboarding clarification."
    });
    await expect(repository.listPlatformSupportNotes("tenant-2")).resolves.toEqual([]);
    await expect(repository.listPlatformSupportNotes("tenant-1")).resolves.toContainEqual(note);
  });

  it("persists recovery case evidence and revokes the subject sessions", async () => {
    const repository = new InMemoryFitosRepository();
    const passwordHash = await new ScryptPasswordHasher().hash("ChangeMe123!");
    await repository.seedDevelopmentData?.(passwordHash);
    const identity = await repository.findLoginIdentity("owner@gym.fitos.test");
    expect(identity).toBeTruthy();
    if (!identity) throw new Error("Seed identity missing.");
    const session = await repository.createSession({
      userId: identity.user.id,
      tenantUserId: identity.tenantUserId,
      tokenHash: "recovery-test-session",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      userAgentSummary: "recovery test"
    });
    expect(session).toBeTruthy();
    await expect(
      repository.revokeAllUserSessions(identity.user.id, new Date().toISOString())
    ).resolves.toBe(1);
    const item = await repository.createPlatformAccountRecoveryCase({
      tenantId: identity.tenant.id,
      subject: { userId: identity.user.id, email: identity.user.email },
      verificationMetadata: { ticket: "SUP-123", verifiedBy: "phone" },
      actions: [
        {
          type: "verification",
          detail: "Verified callback metadata.",
          at: new Date().toISOString()
        }
      ],
      sessionRevocation: {
        requested: true,
        revokedCount: 1,
        completedAt: new Date().toISOString()
      },
      outcome: "resolved",
      actorUserId: "platform-user"
    });
    await expect(
      repository.listPlatformAccountRecoveryCases(identity.tenant.id)
    ).resolves.toContainEqual(item);
    await expect(repository.listPlatformAccountRecoveryCases("other-tenant")).resolves.toEqual([]);
  });

  it("targets system notices by plan and persists user acknowledgement", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.("hash");
    const gym = await repository.findLoginIdentity("owner@gym.fitos.test");
    const pilates = await repository.findLoginIdentity("owner@pilates.fitos.test");
    if (!gym || !pilates) throw new Error("Seed identities missing.");
    const notice = await repository.createPlatformSystemNotice({
      scope: "plan",
      scopeValue: (await repository.getTenantSubscription(gym.tenant.id)).plan,
      title: "Planned maintenance",
      body: "The workspace will receive a routine update.",
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      requiresAcknowledgement: true,
      actorUserId: "platform-user"
    });
    await expect(
      repository.listSystemNoticesForTenant(gym.tenant.id, gym.user.id)
    ).resolves.toMatchObject([{ id: notice.id, acknowledgedAt: null }]);
    await expect(
      repository.listSystemNoticesForTenant(pilates.tenant.id, pilates.user.id)
    ).resolves.toMatchObject([{ id: notice.id, acknowledgedAt: null }]);
    const acknowledged = await repository.acknowledgePlatformSystemNotice(
      gym.tenant.id,
      gym.user.id,
      notice.id
    );
    expect(acknowledged?.acknowledgedAt).toBeTruthy();
  });

  it("requires approved inquiry state and records conversion handoff", async () => {
    const repository = new InMemoryFitosRepository();
    const inquiry = await repository.saveImplementationInquiry(
      {
        contactName: "Implementation Owner",
        businessName: "Handoff Fitness",
        email: "handoff@example.test",
        payload: { locations: [{ name: "Main Branch" }], services: [{ name: "Training" }] }
      },
      true
    );
    await expect(
      repository.convertImplementationInquiry(inquiry.id, "tenant-1")
    ).resolves.toBeNull();
    await repository.updateImplementationInquiryStatus(inquiry.id, "approved");
    const event = await repository.recordImplementationInquiryEvent({
      inquiryId: inquiry.id,
      actorUserId: "platform-user",
      eventType: "conversion_handoff",
      details: { mode: "existing", targetTenantId: "tenant-1" }
    });
    const converted = await repository.convertImplementationInquiry(inquiry.id, "tenant-1");
    expect(converted).toMatchObject({ status: "converted", convertedTenantId: "tenant-1" });
    expect(await repository.listImplementationInquiryEvents(inquiry.id)).toContainEqual(event);
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
