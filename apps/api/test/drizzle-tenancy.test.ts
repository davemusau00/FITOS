import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizePhone } from "@fitos/shared";
import { DrizzleFitosRepository } from "../src/repositories/drizzle-fitos.repository.js";
import { CoreService } from "../src/modules/core/core.service.js";
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

  it("persists member tags and prevents cross-tenant assignments", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const member = await repository.createMember(
      gymScope,
      { contact: { firstName: "Tagged Member" }, homeBranchId: gym.branchIds[0]! },
      null
    );
    const tag = await repository.createMemberTag(gymScope, {
      name: `Priority ${crypto.randomUUID().slice(0, 8)}`,
      color: "lime"
    });
    await expect(
      repository.assignMemberTag(gymScope, member.id, tag.id, gym.user.id)
    ).resolves.toEqual(tag);
    await expect(repository.listMemberTagsForMember(gymScope, member.id)).resolves.toEqual([tag]);
    await expect(
      repository.searchMembers(gymScope, { tagId: tag.id, limit: 10 })
    ).resolves.toMatchObject({ data: [expect.objectContaining({ id: member.id })] });
    await expect(repository.listMemberTagsForMember(pilatesScope, member.id)).resolves.toEqual([]);
    await expect(
      repository.assignMemberTag(pilatesScope, member.id, tag.id, pilates.user.id)
    ).resolves.toBeNull();
    await expect(repository.unassignMemberTag(gymScope, member.id, tag.id)).resolves.toBe(true);
    await expect(repository.deleteMemberTag(gymScope, tag.id)).resolves.toMatchObject({
      id: tag.id
    });
  });

  it("persists reusable member segments and isolates definitions by tenant", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const segment = await repository.createMemberSegment(
      gymScope,
      {
        name: `Active segment ${crypto.randomUUID().slice(0, 8)}`,
        description: "Database segment",
        filters: { status: "active" }
      },
      gym.user.id
    );
    expect(segment.filters).toEqual({ status: "active" });
    await expect(repository.listMemberSegments(gymScope)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: segment.id })])
    );
    await expect(repository.listMemberSegments(pilatesScope)).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: segment.id })])
    );
    await expect(
      repository.updateMemberSegment(gymScope, segment.id, {
        description: "Updated database segment"
      })
    ).resolves.toMatchObject({ description: "Updated database segment" });
    await expect(repository.deleteMemberSegment(gymScope, segment.id)).resolves.toMatchObject({
      id: segment.id
    });
  });

  it("persists saved member views per user and isolates tenants", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const view = await repository.createMemberSavedView(gymScope, gym.user.id, {
      name: `Active view ${crypto.randomUUID().slice(0, 8)}`,
      filters: { query: "Amina", status: "active", branchId: gym.branchIds[0]! }
    });
    await expect(repository.listMemberSavedViews(gymScope, gym.user.id)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: view.id, userId: gym.user.id })])
    );
    await expect(
      repository.listMemberSavedViews(pilatesScope, pilates.user.id)
    ).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ id: view.id })]));
    await expect(
      repository.updateMemberSavedView(gymScope, gym.user.id, view.id, {
        name: "Updated saved view"
      })
    ).resolves.toMatchObject({ name: "Updated saved view" });
    await expect(
      repository.deleteMemberSavedView(gymScope, gym.user.id, view.id)
    ).resolves.toMatchObject({ id: view.id });
  });

  it("persists cross-domain tasks with assignee, lifecycle, and tenant scope", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const member = await repository.createMember(
      gymScope,
      { contact: { firstName: "Task Member" }, homeBranchId: gym.branchIds[0]! },
      null
    );
    const task = await repository.createTask(
      gymScope,
      {
        title: "Review member progress",
        description: "Prepare the next coaching conversation.",
        branchId: gym.branchIds[0],
        assigneeUserId: gym.user.id,
        priority: "urgent",
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        resourceType: "member",
        resourceId: member.id
      },
      gym.user.id
    );
    expect(task.status).toBe("open");
    await expect(repository.listTasks(gymScope, { status: "open" })).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: task.id, resourceId: member.id })])
    );
    await expect(repository.findTaskById(pilatesScope, task.id)).resolves.toBeNull();
    const comment = await repository.createTaskComment(
      gymScope,
      task.id,
      { body: "Member needs a follow-up after the session." },
      gym.user.id
    );
    expect(comment).toMatchObject({ taskId: task.id, authorUserId: gym.user.id });
    await expect(repository.listTaskComments(gymScope, task.id)).resolves.toEqual([comment]);
    await expect(repository.listTaskComments(pilatesScope, task.id)).resolves.toEqual([]);
    await expect(
      repository.updateTask(gymScope, task.id, { status: "in_progress" })
    ).resolves.toMatchObject({
      status: "in_progress"
    });
    await expect(repository.completeTask(gymScope, task.id)).resolves.toMatchObject({
      status: "completed",
      completedAt: expect.any(String)
    });
    await expect(
      repository.createTask(gymScope, {
        title: "Invalid assignee",
        assigneeUserId: pilates.user.id
      })
    ).rejects.toThrow("Task assignee unavailable");
  });

  it("aggregates CRM assignee workload and overdue follow-ups by tenant and branch", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const lead = await repository.createLead(
      gymScope,
      {
        contact: { firstName: "Overdue Database Lead", email: "overdue-db@example.test" },
        branchId: gym.branchIds[0]!,
        ownerUserId: gym.user.id,
        nextFollowUpAt: new Date(Date.now() - 86_400_000).toISOString()
      },
      null
    );
    await repository.createLeadTask(gymScope, lead.id, {
      body: "Call overdue database lead",
      dueAt: new Date(Date.now() - 3_600_000).toISOString(),
      assigneeUserId: gym.user.id
    });
    const workload = await repository.getLeadWorkload(gymScope, gym.branchIds[0]);
    expect(workload.branchId).toBe(gym.branchIds[0]);
    expect(workload.overdueFollowUps).toBeGreaterThanOrEqual(1);
    expect(workload.overdueTasks).toBeGreaterThanOrEqual(1);
    const ownerItem = workload.items.find((item) => item.ownerUserId === gym.user.id);
    expect(ownerItem).toBeTruthy();
    expect(ownerItem!.overdueFollowUps).toBeGreaterThanOrEqual(1);
    expect(ownerItem!.overdueTasks).toBeGreaterThanOrEqual(1);
    await expect(
      repository.getLeadWorkload(pilatesScope, pilates.branchIds[0])
    ).resolves.toMatchObject({
      totalLeads: 0,
      overdueFollowUps: 0,
      overdueTasks: 0
    });
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

  it("receives an inventory lot atomically into stock and the movement ledger", async () => {
    const scope = scopeOf(gym);
    const branchId = gym.branchIds[0]!;
    const item = await repository.createInventoryItem(scope, {
      branchId,
      sku: `LOT-${crypto.randomUUID().slice(0, 8)}`,
      name: "Integration Lot Item",
      category: "consumable",
      costPriceMinor: 1250,
      retailPriceMinor: 0,
      isConsumable: true
    });
    const before = item.stockOnHand;
    const lot = await repository.createInventoryLot(scope, {
      branchId,
      itemId: item.id,
      lotCode: "BATCH-INTEGRATION",
      quantityReceived: 7,
      expiresOn: "2030-01-01"
    });
    expect(lot.quantityOnHand).toBe(7);
    expect((await repository.findInventoryItemById(scope, item.id))?.stockOnHand).toBe(before + 7);
    const movements = await repository.listInventoryMovements(scope, item.id);
    expect(
      movements.some(
        (movement) => movement.referenceId === lot.id && movement.movementType === "purchase_in"
      )
    ).toBe(true);
  });

  it("updates the selected persisted Sites page and retains the edit", async () => {
    const scope = scopeOf(gym);
    const initial = await repository.listSitePages(scope);
    const page =
      initial[0] ??
      (await repository.saveSitePage(scope, {
        slug: `integration-${crypto.randomUUID().slice(0, 8)}`,
        title: "Integration page",
        sections: [{ type: "hero", heading: "Initial" }]
      }));
    const nextTitle = `Integration edit ${page!.slug}`;
    const updated = await repository.saveSitePage(scope, {
      pageId: page!.id,
      slug: page!.slug,
      title: nextTitle,
      sections: [{ type: "hero", heading: "Persisted integration edit" }],
      seo: { title: "Persisted integration edit" }
    });
    expect(updated.id).toBe(page!.id);
    expect(updated.version).toBeGreaterThan(page!.version);
    const reloaded = (await repository.listSitePages(scope)).find(
      (candidate) => candidate.id === page!.id
    );
    expect(reloaded?.title).toBe(nextTitle);
    expect(reloaded?.sections[0]?.type).toBe("hero");
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

    const rescheduleTarget = await repository.createScheduleOccurrence(gymScope, {
      branchId: gym.branchIds[0]!,
      serviceId: service.id,
      startsAt: new Date(startsAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(startsAt.getTime() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      capacity: 4
    });
    await expect(
      repository.rescheduleBooking(gymScope, booking.id, rescheduleTarget.id)
    ).resolves.toMatchObject({ occurrenceId: rescheduleTarget.id });

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
    const today = new Date();
    const from = new Date(today);
    from.setHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    expect(
      (
        await repository.listAttendanceRecords(gymScope, {
          occurrenceId: occurrence.id,
          from: from.toISOString(),
          to: to.toISOString()
        })
      ).data
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

  it("persists notification preferences for the authenticated user", async () => {
    // Integration databases are intentionally reusable between runs; restore the
    // fixture before checking the default contract.
    await repository.updateNotificationPreferences(gym.user.id, {
      email: true,
      sms: false,
      bookingReminders: true,
      operationalAlerts: true,
      leadFollowUps: true
    });
    const defaults = await repository.getNotificationPreferences(gym.user.id);
    expect(defaults).toMatchObject({ email: true, sms: false, bookingReminders: true });
    const updated = await repository.updateNotificationPreferences(gym.user.id, {
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
    await expect(repository.getNotificationPreferences(gym.user.id)).resolves.toEqual(updated);
  });

  it("persists and returns inactive Platform plan definitions", async () => {
    const starter = (await repository.listPlatformPlanDefinitions()).find(
      (plan) => plan.key === "starter"
    );
    expect(starter).toBeTruthy();
    const updated = await repository.updatePlatformPlanDefinition("starter", {
      name: starter!.name,
      description: starter!.description,
      quotas: starter!.quotas,
      capabilities: starter!.capabilities,
      isActive: false
    });
    expect(updated?.isActive).toBe(false);
    await expect(repository.listPlatformPlanDefinitions()).resolves.toContainEqual(updated);
    await repository.updatePlatformPlanDefinition("starter", { ...starter!, isActive: true });
  });

  it("persists Platform support notes and isolates tenants", async () => {
    const note = await repository.createPlatformSupportNote({
      tenantId: gym.tenant.id,
      authorUserId: gym.user.id,
      category: "support",
      note: "PostgreSQL support note integration check."
    });
    expect(note.tenantId).toBe(gym.tenant.id);
    await expect(repository.listPlatformSupportNotes(gym.tenant.id)).resolves.toContainEqual(note);
    await expect(
      repository.listPlatformSupportNotes(pilates.tenant.id)
    ).resolves.not.toContainEqual(note);
  });

  it("persists account recovery evidence and isolates cases by tenant", async () => {
    const at = new Date().toISOString();
    const item = await repository.createPlatformAccountRecoveryCase({
      tenantId: gym.tenant.id,
      subject: { userId: gym.user.id, email: gym.user.email },
      verificationMetadata: { ticket: "DB-RECOVERY", verifiedBy: "phone" },
      actions: [{ type: "verification", detail: "Verified integration subject.", at }],
      sessionRevocation: { requested: false, revokedCount: 0, completedAt: null },
      outcome: "pending",
      actorUserId: gym.user.id
    });
    await expect(
      repository.listPlatformAccountRecoveryCases(gym.tenant.id)
    ).resolves.toContainEqual(item);
    await expect(
      repository.listPlatformAccountRecoveryCases(pilates.tenant.id)
    ).resolves.not.toContainEqual(item);
  });

  it("persists scheduled system notices and tenant acknowledgements", async () => {
    const notice = await repository.createPlatformSystemNotice({
      scope: "tenant",
      scopeValue: gym.tenant.id,
      title: "Integration maintenance notice",
      body: "Please acknowledge this scheduled update.",
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      requiresAcknowledgement: true,
      actorUserId: gym.user.id
    });
    const visibleToGym = await repository.listSystemNoticesForTenant(gym.tenant.id, gym.user.id);
    expect(visibleToGym.find((item) => item.id === notice.id)).toMatchObject({
      id: notice.id,
      acknowledgedAt: null
    });
    const visibleToPilates = await repository.listSystemNoticesForTenant(
      pilates.tenant.id,
      pilates.user.id
    );
    expect(visibleToPilates.some((item) => item.id === notice.id)).toBe(false);
    await expect(
      repository.acknowledgePlatformSystemNotice(gym.tenant.id, gym.user.id, notice.id)
    ).resolves.toMatchObject({ id: notice.id, acknowledgedAt: expect.any(String) });
  });

  it("persists approved implementation inquiry conversion and handoff events", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const inquiry = await repository.saveImplementationInquiry(
      {
        contactName: `DB Handoff ${suffix}`,
        businessName: `DB Handoff Gym ${suffix}`,
        email: `handoff-${suffix}@example.test`,
        payload: { locations: [{ name: "Main Branch" }], services: [{ name: "Training" }] }
      },
      true
    );
    await expect(
      repository.convertImplementationInquiry(inquiry.id, gym.tenant.id)
    ).resolves.toBeNull();
    await repository.updateImplementationInquiryStatus(inquiry.id, "approved");
    const handoff = await repository.recordImplementationInquiryEvent({
      inquiryId: inquiry.id,
      actorUserId: gym.user.id,
      eventType: "conversion_handoff",
      details: { mode: "existing", targetTenantId: gym.tenant.id }
    });
    const converted = await repository.convertImplementationInquiry(inquiry.id, gym.tenant.id);
    expect(converted).toMatchObject({ status: "converted", convertedTenantId: gym.tenant.id });
    expect(await repository.getImplementationInquiry(inquiry.id)).toMatchObject({
      status: "converted",
      convertedTenantId: gym.tenant.id
    });
    expect(await repository.listImplementationInquiryEvents(inquiry.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: handoff.id, eventType: "conversion_handoff" })
      ])
    );
  });

  it("persists account export requests and isolates them by tenant", async () => {
    const created = await repository.createAccountExportRequest(scopeOf(gym), gym.user.id);
    expect(created.status).toBe("requested");
    expect(created.format).toBe("json");
    await expect(repository.listAccountExportRequests(scopeOf(gym))).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id, tenantId: gym.tenant.id })])
    );
    await expect(repository.listAccountExportRequests(scopeOf(pilates))).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })])
    );
    await expect(
      repository.updateAccountExportRequestStatus(created.id, "completed")
    ).resolves.toMatchObject({
      status: "completed"
    });
    await expect(
      repository.updateAccountExportRequestStatus(created.id, "processing")
    ).resolves.toBeNull();
  });

  it("persists lifecycle requests and isolates cancellation/deletion records", async () => {
    const gymScope = scopeOf(gym);
    const cancellation = await repository.createAccountCancellationRequest(
      gymScope,
      gym.user.id,
      "Closing"
    );
    const deletion = await repository.createAccountDeletionRequest(
      gymScope,
      gym.user.id,
      "DELETE WORKSPACE",
      "Remove data"
    );
    expect(cancellation.status).toBe("requested");
    expect(deletion.confirmation).toBe("DELETE WORKSPACE");
    await expect(repository.listAccountCancellationRequests(scopeOf(pilates))).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: cancellation.id })])
    );
    await expect(repository.listAccountDeletionRequests(scopeOf(pilates))).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: deletion.id })])
    );
  });

  it("persists converted-lead trial bookings and lead stage", async () => {
    const gymScope = scopeOf(gym);
    const branchId = gym.branchIds[0]!;
    const suffix = crypto.randomUUID().slice(0, 8);
    const lead = await repository.createLead(
      gymScope,
      {
        branchId,
        contact: { firstName: "DB Trial", lastName: suffix },
        interest: "Assessment"
      },
      null
    );
    const converted = await repository.convertLead(gymScope, lead.id, gym.user.id);
    if (!converted) throw new Error("Lead conversion failed.");
    const plan = await repository.createMembershipPlan(gymScope, {
      branchId,
      name: `DB Trial Plan ${suffix}`,
      includedCredits: 1,
      durationDays: 30
    });
    await repository.activateMembership(gymScope, {
      memberId: converted.member.id,
      planId: plan.id
    });
    const service = await repository.createService(gymScope, {
      branchId,
      name: `DB Trial Service ${suffix}`,
      serviceType: "class",
      durationMinutes: 30,
      defaultCapacity: 4,
      creditsRequired: 1
    });
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const occurrence = await repository.createScheduleOccurrence(gymScope, {
      branchId,
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
      capacity: 4
    });
    const actor = {
      userId: gym.user.id,
      tenantId: gym.tenant.id,
      tenantUserId: gym.tenantUserId,
      branchIds: gym.branchIds,
      permissions: [...gym.role.permissions],
      roleKey: gym.role.key,
      sessionId: `db-trial-${suffix}`
    };

    const result = await new CoreService(repository).bookLeadTrial(actor, `db-${suffix}`, lead.id, {
      occurrenceId: occurrence.id
    });

    expect(result.lead.stage).toBe("trial_booked");
    expect(result.booking).toMatchObject({
      tenantId: gym.tenant.id,
      occurrenceId: occurrence.id,
      memberId: converted.member.id,
      status: "confirmed"
    });
    await expect(repository.findBookingById(gymScope, result.booking.id)).resolves.toMatchObject({
      id: result.booking.id,
      memberId: converted.member.id
    });
  });

  it("persists staff waitlist join and leave without consuming credits", async () => {
    const gymScope = scopeOf(gym);
    const branchId = gym.branchIds[0]!;
    const suffix = crypto.randomUUID().slice(0, 8);
    const plan = await repository.createMembershipPlan(gymScope, {
      branchId,
      name: `DB Staff Waitlist Plan ${suffix}`,
      includedCredits: 2,
      durationDays: 30
    });
    const first = await repository.createMember(
      gymScope,
      { contact: { firstName: "DB Waitlist First", lastName: suffix }, homeBranchId: branchId },
      null
    );
    const second = await repository.createMember(
      gymScope,
      { contact: { firstName: "DB Waitlist Second", lastName: suffix }, homeBranchId: branchId },
      null
    );
    await repository.activateMembership(gymScope, { memberId: first.id, planId: plan.id });
    await repository.activateMembership(gymScope, { memberId: second.id, planId: plan.id });
    const service = await repository.createService(gymScope, {
      branchId,
      name: `DB Staff Waitlist Service ${suffix}`,
      serviceType: "class",
      durationMinutes: 30,
      defaultCapacity: 1,
      creditsRequired: 1
    });
    const startsAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const occurrence = await repository.createScheduleOccurrence(gymScope, {
      branchId,
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
      capacity: 1
    });
    await repository.createBooking(
      gymScope,
      { occurrenceId: occurrence.id, memberId: first.id, source: "staff" },
      gym.user.id,
      false
    );
    const balanceBefore = await repository.getCreditBalance(gymScope, second.id);
    const waitlisted = await repository.createBooking(
      gymScope,
      { occurrenceId: occurrence.id, memberId: second.id, source: "staff", waitlist: true },
      gym.user.id,
      false
    );
    expect(waitlisted).toMatchObject({ status: "waitlisted", creditsDebited: 0 });
    expect(await repository.getCreditBalance(gymScope, second.id)).toBe(balanceBefore);
    await expect(
      repository.cancelBooking(gymScope, waitlisted.id, "No longer interested")
    ).resolves.toMatchObject({ id: waitlisted.id, status: "cancelled" });
  });
});
