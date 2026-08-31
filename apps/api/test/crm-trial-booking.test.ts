import { describe, expect, it } from "vitest";
import type { RequestActor } from "@fitos/contracts";
import { CoreService } from "../src/modules/core/core.service.js";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

describe("CRM trial booking", () => {
  it("creates a real booking for a converted lead and advances the lead stage", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.("hash");
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!owner) throw new Error("Seed identity missing.");
    const branchId = owner.branchIds[0]!;
    const scope = {
      tenantId: owner.tenant.id,
      tenantUserId: owner.tenantUserId,
      userId: owner.user.id,
      branchIds: owner.branchIds
    };
    const actor: RequestActor = {
      ...scope,
      permissions: [...owner.role.permissions],
      roleKey: owner.role.key,
      sessionId: "crm-trial-test"
    };
    const lead = await repository.createLead(
      scope,
      {
        branchId,
        contact: { firstName: "Trial", lastName: "Prospect" },
        interest: "Strength training"
      },
      null
    );
    const converted = await repository.convertLead(scope, lead.id, owner.user.id);
    if (!converted) throw new Error("Lead conversion failed.");
    const plan = await repository.createMembershipPlan(scope, {
      branchId,
      name: "Trial credits",
      includedCredits: 1,
      durationDays: 30
    });
    await repository.activateMembership(scope, {
      memberId: converted.member.id,
      planId: plan.id
    });
    const service = await repository.createService(scope, {
      branchId,
      name: "CRM Trial Session",
      serviceType: "class",
      durationMinutes: 45,
      defaultCapacity: 4,
      creditsRequired: 1
    });
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const occurrence = await repository.createScheduleOccurrence(scope, {
      branchId,
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 45 * 60 * 1000).toISOString(),
      capacity: 4
    });

    const result = await new CoreService(repository).bookLeadTrial(
      actor,
      "trial-request",
      lead.id,
      {
        occurrenceId: occurrence.id
      }
    );

    expect(result.lead).toMatchObject({
      id: lead.id,
      stage: "trial_booked",
      convertedMemberId: converted.member.id
    });
    expect(result.booking).toMatchObject({
      occurrenceId: occurrence.id,
      memberId: converted.member.id,
      status: "confirmed",
      source: "staff"
    });
    await expect(
      repository.listBookings(scope, { memberId: converted.member.id, limit: 10 })
    ).resolves.toMatchObject({ data: [expect.objectContaining({ id: result.booking.id })] });
  });

  it("requires conversion before a trial can be booked", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.("hash");
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!owner) throw new Error("Seed identity missing.");
    const branchId = owner.branchIds[0]!;
    const scope = {
      tenantId: owner.tenant.id,
      tenantUserId: owner.tenantUserId,
      userId: owner.user.id,
      branchIds: owner.branchIds
    };
    const lead = await repository.createLead(
      scope,
      { branchId, contact: { firstName: "Unconverted" } },
      null
    );
    const actor: RequestActor = {
      ...scope,
      permissions: [...owner.role.permissions],
      roleKey: owner.role.key,
      sessionId: "crm-trial-prerequisite-test"
    };
    await expect(
      new CoreService(repository).bookLeadTrial(actor, "trial-request", lead.id, {
        occurrenceId: crypto.randomUUID()
      })
    ).rejects.toThrow(/convert this lead/i);
  });
});
