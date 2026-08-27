import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizePhone } from "@fitos/shared";
import { DrizzleFitosRepository } from "../src/repositories/drizzle-fitos.repository.js";
import { generateWeeklyOccurrences } from "../src/modules/schedule/recurrence.js";
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

  it("denies exact operational UUIDs across services, rooms, occurrences, and bookings", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const suffix = crypto.randomUUID().slice(0, 8);
    const member = await repository.createMember(
      gymScope,
      {
        contact: { firstName: `Operational Matrix ${suffix}` },
        homeBranchId: gym.branchIds[0]!
      },
      null
    );
    const service = await repository.createService(gymScope, {
      branchId: gym.branchIds[0],
      name: `Operational Service ${suffix}`,
      serviceType: "class",
      durationMinutes: 30,
      defaultCapacity: 4,
      creditsRequired: 0
    });
    const room = await repository.createRoom(gymScope, {
      branchId: gym.branchIds[0]!,
      name: `Operational Room ${suffix}`,
      capacity: 4
    });
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const occurrence = await repository.createScheduleOccurrence(gymScope, {
      branchId: gym.branchIds[0]!,
      serviceId: service.id,
      roomId: room.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
      capacity: 4
    });
    const booking = await repository.createBooking(
      gymScope,
      { occurrenceId: occurrence.id, memberId: member.id, source: "staff" },
      gym.user.id,
      false
    );

    expect(await repository.findServiceById(pilatesScope, service.id)).toBeNull();
    expect(await repository.updateService(pilatesScope, service.id, { name: "Denied" })).toBeNull();
    expect(await repository.findRoomById(pilatesScope, room.id)).toBeNull();
    expect(await repository.updateRoom(pilatesScope, room.id, { name: "Denied" })).toBeNull();
    expect(await repository.findScheduleOccurrenceById(pilatesScope, occurrence.id)).toBeNull();
    expect(
      await repository.cancelScheduleOccurrence(pilatesScope, occurrence.id, "Denied")
    ).toBeNull();
    expect(await repository.findBookingById(pilatesScope, booking.id)).toBeNull();
    expect(await repository.cancelBooking(pilatesScope, booking.id, "Denied")).toBeNull();
  });

  it("atomically materializes tenant-scoped recurring schedules and preserves template intent", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const suffix = crypto.randomUUID().slice(0, 8);
    const service = await repository.createService(gymScope, {
      branchId: gym.branchIds[0],
      name: `Database Recurrence ${suffix}`,
      serviceType: "class",
      durationMinutes: 50,
      defaultCapacity: 8
    });
    const room = await repository.createRoom(gymScope, {
      branchId: gym.branchIds[0]!,
      name: `Database Recurrence Room ${suffix}`,
      capacity: 8
    });
    const input = {
      branchId: gym.branchIds[0]!,
      serviceId: service.id,
      roomId: room.id,
      timezone: "Africa/Nairobi",
      daysOfWeek: [1, 3],
      localStartTime: "18:30",
      durationMinutes: 50,
      capacity: 8,
      effectiveStartDate: "2040-01-01",
      effectiveEndDate: "2040-01-31",
      materializeThroughDate: "2040-01-15"
    };
    const occurrences = generateWeeklyOccurrences(input, "2040-01-01", "2040-01-15");
    const created = await repository.createScheduleTemplate(
      gymScope,
      input,
      occurrences,
      "2040-01-15"
    );

    expect(created.occurrences.length).toBeGreaterThan(0);
    expect(
      created.occurrences.every((occurrence) => occurrence.templateId === created.template.id)
    ).toBe(true);
    expect(await repository.findScheduleTemplateById(pilatesScope, created.template.id)).toBeNull();
    expect(
      await repository.materializeScheduleTemplate(
        pilatesScope,
        created.template.id,
        [],
        "2040-01-31"
      )
    ).toBeNull();
    await expect(
      repository.createScheduleTemplate(
        gymScope,
        { ...input, effectiveEndDate: "2040-01-15" },
        occurrences,
        "2040-01-15"
      )
    ).rejects.toThrow();
    expect(
      (await repository.listScheduleTemplates(gymScope)).filter(
        (template) => template.serviceId === service.id
      )
    ).toHaveLength(1);

    const first = created.occurrences[0]!;
    const movedStart = new Date(new Date(first.startsAt).getTime() + 60 * 60 * 1000);
    const moved = await repository.overrideScheduleOccurrence(
      gymScope,
      first.id,
      {
        startsAt: movedStart.toISOString(),
        endsAt: new Date(movedStart.getTime() + 50 * 60 * 1000).toISOString(),
        reason: "Database one-off override"
      },
      gym.user.id
    );
    expect(moved?.startsAt).toBe(movedStart.toISOString());
    expect(
      (await repository.findScheduleTemplateById(gymScope, created.template.id))?.localStartTime
    ).toBe("18:30");
    const cancelled = await repository.cancelScheduleOccurrence(
      gymScope,
      created.occurrences[1]!.id,
      "Database cancellation exception",
      gym.user.id
    );
    expect(cancelled?.status).toBe("cancelled");
  });

  it("serializes competing public reservations for the final place", async () => {
    const scope = scopeOf(gym);
    const suffix = crypto.randomUUID().slice(0, 8);
    const service = await repository.createService(scope, {
      branchId: gym.branchIds[0],
      name: `Public Race ${suffix}`,
      serviceType: "class",
      durationMinutes: 30,
      defaultCapacity: 1,
      creditsRequired: 0
    });
    const startsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const occurrence = await repository.createScheduleOccurrence(scope, {
      branchId: gym.branchIds[0]!,
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
      capacity: 1
    });
    const results = await Promise.all(
      ["A", "B"].map((suffix) =>
        repository.createPublicReservation("fitos-demo-gym", {
          occurrenceId: occurrence.id,
          reservationType: "class",
          firstName: `Race ${suffix}`,
          phone: `+25472200000${suffix}`
        })
      )
    );
    expect(results.filter((result) => result.status === "confirmed")).toHaveLength(1);
    expect(results.filter((result) => result.status === "waitlisted")).toHaveLength(1);
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

    await repository.adjustCredit(
      gymScope,
      member.id,
      { membershipId: activation.membership.id, delta: 1, reason: "Race test grant" },
      gym.user.id
    );
    const adjustmentAttempts = await Promise.allSettled([
      repository.adjustCredit(
        gymScope,
        member.id,
        { membershipId: activation.membership.id, delta: -1, reason: "Race correction A" },
        gym.user.id
      ),
      repository.adjustCredit(
        gymScope,
        member.id,
        { membershipId: activation.membership.id, delta: -1, reason: "Race correction B" },
        gym.user.id
      )
    ]);
    expect(adjustmentAttempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(adjustmentAttempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    expect(await repository.getCreditBalance(gymScope, member.id)).toBe(0);

    expect(await repository.findMembershipPlanById(pilatesScope, plan.id)).toBeNull();
    expect(await repository.listMemberMemberships(pilatesScope, member.id)).toEqual([]);
    expect(await repository.listCreditLedger(pilatesScope, member.id)).toEqual([]);
    expect(
      await repository.findMembershipPlanById({ ...gymScope, branchIds: [] }, plan.id)
    ).toBeNull();
  });

  it("reconciles a payment once and rejects cross-tenant payment references", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const suffix = crypto.randomUUID().slice(0, 8);
    const gymMember = await repository.createMember(
      gymScope,
      {
        contact: { firstName: `Payment Gym ${suffix}` },
        homeBranchId: gym.branchIds[0]!
      },
      null
    );
    const pilatesMember = await repository.createMember(
      pilatesScope,
      {
        contact: { firstName: `Payment Pilates ${suffix}` },
        homeBranchId: pilates.branchIds[0]!
      },
      null
    );
    const payment = await repository.createPayment(
      gymScope,
      {
        branchId: gym.branchIds[0]!,
        amount: { amountMinor: "250000", currency: "KES" },
        method: "bank_transfer",
        reference: `BANK-${suffix}`
      },
      gym.user.id
    );
    const reconciliation = {
      memberId: gymMember.id,
      allocationType: "other" as const,
      reason: "Reference confirmed"
    };
    const duplicateAttempts = await Promise.all([
      repository.reconcilePayment(gymScope, payment.id, reconciliation),
      repository.reconcilePayment(gymScope, payment.id, reconciliation)
    ]);
    expect(duplicateAttempts[0]).toEqual(duplicateAttempts[1]);
    expect(duplicateAttempts[0]?.note?.match(/Reconciliation:/g)).toHaveLength(1);
    expect(await repository.findPaymentById(pilatesScope, payment.id)).toBeNull();

    await expect(
      repository.reconcilePayment(gymScope, payment.id, {
        ...reconciliation,
        memberId: pilatesMember.id
      })
    ).rejects.toThrow();

    await expect(
      repository.pool.query(
        `INSERT INTO payment_transactions
          (tenant_id, branch_id, member_id, amount_minor, currency, method, status,
           allocation_type, recorded_by_user_id)
         VALUES ($1, $2, $3, '10000', 'KES', 'cash', 'completed', 'other', $4)`,
        [gym.tenant.id, gym.branchIds[0], pilatesMember.id, gym.user.id]
      )
    ).rejects.toThrow();

    const voidAttempts = await Promise.all([
      repository.voidPayment(gymScope, payment.id, "Duplicate bank entry"),
      repository.voidPayment(gymScope, payment.id, "Duplicate bank entry")
    ]);
    expect(voidAttempts[0]?.status).toBe("voided");
    expect(voidAttempts[1]?.status).toBe("voided");

    const refundable = await repository.createPayment(
      gymScope,
      {
        branchId: gym.branchIds[0]!,
        memberId: gymMember.id,
        amount: { amountMinor: "50000", currency: "KES" },
        method: "cash",
        allocationType: "other"
      },
      gym.user.id
    );
    const refunds = await Promise.all([
      repository.refundPayment(gymScope, refundable.id, "Class cancelled"),
      repository.refundPayment(gymScope, refundable.id, "Class cancelled")
    ]);
    expect(refunds[0]?.status).toBe("refunded");
    expect(refunds[1]?.status).toBe("refunded");
  });

  it("creates one attendance effect for concurrent class check-ins", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const suffix = crypto.randomUUID().slice(0, 8);
    const member = await repository.createMember(
      gymScope,
      {
        contact: { firstName: `Attendance ${suffix}` },
        homeBranchId: gym.branchIds[0]!
      },
      null
    );
    const pilatesMember = await repository.createMember(
      pilatesScope,
      {
        contact: { firstName: `Attendance Pilates ${suffix}` },
        homeBranchId: pilates.branchIds[0]!
      },
      null
    );
    const service = await repository.createService(gymScope, {
      branchId: gym.branchIds[0],
      name: `Attendance Service ${suffix}`,
      serviceType: "class",
      durationMinutes: 45,
      defaultCapacity: 10,
      creditsRequired: 0
    });
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const occurrence = await repository.createScheduleOccurrence(gymScope, {
      branchId: gym.branchIds[0]!,
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 45 * 60 * 1000).toISOString(),
      capacity: 10
    });
    await repository.createBooking(
      gymScope,
      { occurrenceId: occurrence.id, memberId: member.id, source: "staff" },
      gym.user.id,
      false
    );
    const attempts = await Promise.all([
      repository.checkIn(
        gymScope,
        { memberId: member.id, occurrenceId: occurrence.id },
        gym.user.id,
        gym.branchIds[0]!,
        false
      ),
      repository.checkIn(
        gymScope,
        { memberId: member.id, occurrenceId: occurrence.id },
        gym.user.id,
        gym.branchIds[0]!,
        false
      )
    ]);
    expect(attempts[0]).toEqual(attempts[1]);
    expect(
      (await repository.listAttendanceRecords(gymScope, { occurrenceId: occurrence.id })).data
    ).toHaveLength(1);
    expect(await repository.findAttendanceRecord(pilatesScope, attempts[0].id)).toBeNull();

    await repository.updateAttendanceStatus(
      gymScope,
      attempts[0].id,
      { status: "attended" },
      false
    );
    await expect(
      repository.pool.query(
        `UPDATE attendance_records SET status = 'no_show', updated_at = now() WHERE id = $1`,
        [attempts[0].id]
      )
    ).rejects.toThrow();
    await expect(
      repository.pool.query(
        `INSERT INTO attendance_records
          (tenant_id, branch_id, occurrence_id, member_id, status, checked_in_at, actor_user_id)
         VALUES ($1, $2, $3, $4, 'checked_in', now(), $5)`,
        [gym.tenant.id, gym.branchIds[0], occurrence.id, pilatesMember.id, gym.user.id]
      )
    ).rejects.toThrow();
  });
});
