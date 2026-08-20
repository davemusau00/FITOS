import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizePhone } from "@fitos/shared";
import { DrizzleFitosRepository } from "../src/repositories/drizzle-fitos.repository.js";
import type { LoginIdentity, TenantScope } from "../src/ports/fitos-repository.js";

const databaseTests = process.env.RUN_DATABASE_TESTS === "true";
const describeDatabase = databaseTests ? describe : describe.skip;

let repository: DrizzleFitosRepository;
let gym: LoginIdentity;
let pilates: LoginIdentity;

const scopeOf = (identity: LoginIdentity): TenantScope => ({
  tenantId: identity.tenant.id,
  tenantUserId: identity.tenantUserId,
  userId: identity.user.id,
  branchIds: identity.branchIds
});

describeDatabase("Drizzle tenant isolation", () => {
  beforeAll(async () => {
    repository = new DrizzleFitosRepository();
    gym = (await repository.findLoginIdentity("owner@gym.fitos.test"))!;
    pilates = (await repository.findLoginIdentity("owner@pilates.fitos.test"))!;
    if (!gym || !pilates) throw new Error("Expected seeded integration-test tenants.");
  });

  afterAll(async () => repository?.close());

  it("scopes member reads and database references by tenant", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const created = await repository.createMember(
      gymScope,
      {
        contact: { firstName: "Database Isolation", phone: "+254712345679" },
        homeBranchId: gym.branchIds[0]!
      },
      normalizePhone("+254712345679")
    );

    expect(await repository.findMemberById(pilatesScope, created.id)).toBeNull();

    await expect(
      repository.createMember(
        gymScope,
        { contact: { firstName: "Invalid Branch" }, homeBranchId: pilates.branchIds[0]! },
        null
      )
    ).rejects.toThrow();
  });

  it("scopes CRM records and reuses a lead contact on conversion", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const lead = await repository.createLead(
      gymScope,
      {
        contact: { firstName: "Lead Isolation", phone: "+254712345680" },
        branchId: gym.branchIds[0]!,
        source: "integration-test"
      },
      normalizePhone("+254712345680")
    );
    expect(await repository.findLeadById(pilatesScope, lead.id)).toBeNull();
    const converted = await repository.convertLead(gymScope, lead.id, gym.user.id);
    expect(converted?.member.contact.id).toBe(lead.contact.id);
    expect((await repository.convertLead(gymScope, lead.id, gym.user.id))?.alreadyConverted).toBe(
      true
    );
  });

  it("serializes the final member credit across concurrent bookings", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const suffix = crypto.randomUUID().slice(0, 8);
    const plan = await repository.createMembershipPlan(gymScope, {
      branchId: gym.branchIds[0],
      name: `One Credit ${suffix}`,
      includedCredits: 1,
      durationDays: 30
    });
    const member = await repository.createMember(
      gymScope,
      {
        contact: { firstName: `Credit Race ${suffix}` },
        homeBranchId: gym.branchIds[0]!
      },
      null
    );
    const activation = await repository.activateMembership(gymScope, {
      memberId: member.id,
      planId: plan.id
    });
    await repository.updateMembershipPlan(gymScope, plan.id, {
      name: `Changed One Credit ${suffix}`,
      includedCredits: 2
    });
    const storedMembership = await repository.findMemberMembershipById(
      gymScope,
      activation.membership.id
    );
    expect(storedMembership?.planSnapshot.name).toBe(`One Credit ${suffix}`);
    expect(storedMembership?.planSnapshot.includedCredits).toBe(1);
    const service = await repository.createService(gymScope, {
      branchId: gym.branchIds[0],
      name: `Credit Service ${suffix}`,
      serviceType: "class",
      durationMinutes: 45,
      defaultCapacity: 10,
      creditsRequired: 1
    });
    const firstStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const secondStart = new Date(firstStart.getTime() + 2 * 60 * 60 * 1000);
    const occurrences = await Promise.all(
      [firstStart, secondStart].map((startsAt) =>
        repository.createScheduleOccurrence(gymScope, {
          branchId: gym.branchIds[0]!,
          serviceId: service.id,
          startsAt: startsAt.toISOString(),
          endsAt: new Date(startsAt.getTime() + 45 * 60 * 1000).toISOString(),
          capacity: 10
        })
      )
    );

    const attempts = await Promise.allSettled(
      occurrences.map((occurrence) =>
        repository.createBooking(
          gymScope,
          { occurrenceId: occurrence.id, memberId: member.id, source: "staff" },
          gym.user.id,
          false
        )
      )
    );
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    expect(await repository.getCreditBalance(gymScope, member.id)).toBe(0);
    expect(
      (await repository.listCreditLedger(gymScope, member.id)).filter(
        (entry) => entry.reason === "booking"
      )
    ).toHaveLength(1);

    expect(await repository.findMembershipPlanById(pilatesScope, plan.id)).toBeNull();
    expect(await repository.listMemberMemberships(pilatesScope, member.id)).toEqual([]);
    expect(await repository.listCreditLedger(pilatesScope, member.id)).toEqual([]);
    expect(
      await repository.findMembershipPlanById({ ...gymScope, branchIds: [] }, plan.id)
    ).toBeNull();
  });
});
