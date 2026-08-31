import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher } from "@fitos/auth";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

describe("Memberships and Booking Credits Integration", () => {
  it("activates membership, grants initial credits, debits on booking, and restores on cancel", async () => {
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

    // 1. Create a membership plan in Gym
    const plan = await repository.createMembershipPlan(gymScope, {
      branchId: gym.branchIds[0],
      name: "10-Class Strength Pack",
      includedCredits: 10,
      durationDays: 30,
      publicVisible: true,
      price: { amountMinor: "750000", currency: "KES" }
    });

    expect(plan.id).toBeDefined();
    expect(plan.includedCredits).toBe(10);

    // 2. Create a member
    const member = await repository.createMember(
      gymScope,
      {
        contact: { firstName: "Wanjiku", lastName: "Mwangi", phone: "0722123456" },
        homeBranchId: gym.branchIds[0]!
      },
      "+254722123456"
    );

    // 3. Activate membership for member
    const activation = await repository.activateMembership(gymScope, {
      memberId: member.id,
      planId: plan.id
    });

    expect(activation.membership.status).toBe("active");
    expect(activation.ledgerEntry.delta).toBe(10);
    expect(activation.ledgerEntry.reason).toBe("purchase");
    expect(activation.membership.endsAt).toBe(
      new Date(new Date(activation.membership.startsAt).getTime() + 30 * 86400000).toISOString()
    );

    const held = await repository.holdMembership(gymScope, activation.membership.id);
    expect(held?.status).toBe("paused");
    expect(await repository.holdMembership(gymScope, activation.membership.id)).toBeNull();
    const resumed = await repository.resumeMembership(gymScope, activation.membership.id);
    expect(resumed?.status).toBe("active");
    expect(await repository.resumeMembership(gymScope, activation.membership.id)).toBeNull();

    await repository.updateMembershipPlan(gymScope, plan.id, {
      name: "Updated 20-Class Strength Pack",
      includedCredits: 20,
      price: { amountMinor: "1000000", currency: "KES" }
    });
    const [storedMembership] = await repository.listMemberMemberships(gymScope, member.id);
    expect(storedMembership?.planSnapshot.name).toBe("10-Class Strength Pack");
    expect(storedMembership?.planSnapshot.includedCredits).toBe(10);
    expect(storedMembership?.planSnapshot.price?.amountMinor).toBe("750000");

    // 4. Verify credit balance is 10
    const balanceBefore = await repository.getCreditBalance(gymScope, member.id);
    expect(balanceBefore).toBe(10);

    // 5. Create service and occurrence
    const service = await repository.createService(gymScope, {
      name: "HIIT Strength",
      serviceType: "class",
      durationMinutes: 60,
      defaultCapacity: 10,
      creditsRequired: 1,
      bookingWindowHours: 48,
      branchId: gym.branchIds[0]
    });

    const startsAt = new Date(Date.now() + 3 * 86400000).toISOString();
    const endsAt = new Date(Date.now() + 3 * 86400000 + 3600000).toISOString();
    const occurrence = await repository.createScheduleOccurrence(gymScope, {
      branchId: gym.branchIds[0]!,
      serviceId: service.id,
      startsAt,
      endsAt,
      capacity: 10
    });

    const portalBeforeWindow = await repository.getMemberPortalOverview(member.id);
    expect(
      portalBeforeWindow?.bookableOccurrences.find((item) => item.id === occurrence.id)
        ?.bookingEligibility?.reasonCode
    ).toBe("OUTSIDE_BOOKING_WINDOW");
    await expect(repository.memberSelfBook(member.id, occurrence.id)).rejects.toThrow(
      /not open for booking yet/i
    );
    await repository.updateService(gymScope, service.id, { bookingWindowHours: null });

    const includedPlan = await repository.createMembershipPlan(gymScope, {
      branchId: gym.branchIds[0],
      name: "Strength Only",
      includedCredits: 5,
      includedServiceIds: ["00000000-0000-4000-8000-000000000099"]
    });
    const excludedMember = await repository.createMember(
      gymScope,
      { contact: { firstName: "Excluded Service" }, homeBranchId: gym.branchIds[0]! },
      "+254711000001"
    );
    await repository.activateMembership(gymScope, {
      memberId: excludedMember.id,
      planId: includedPlan.id
    });
    const excludedPortal = await repository.getMemberPortalOverview(excludedMember.id);
    expect(
      excludedPortal?.bookableOccurrences.find((item) => item.id === occurrence.id)
        ?.bookingEligibility?.reasonCode
    ).toBe("SERVICE_NOT_INCLUDED");
    await expect(repository.memberSelfBook(excludedMember.id, occurrence.id)).rejects.toThrow(
      /does not include this service/i
    );

    // 6. Booking and entitlement debit are one repository transaction.
    const booking = await repository.createBooking(
      gymScope,
      {
        occurrenceId: occurrence.id,
        memberId: member.id,
        source: "staff"
      },
      gym.user.id,
      false
    );

    expect(booking.status).toBe("confirmed");
    expect(booking.creditsDebited).toBe(1);
    expect(booking.creditMembershipId).toBe(activation.membership.id);

    const balanceAfterBooking = await repository.getCreditBalance(gymScope, member.id);
    expect(balanceAfterBooking).toBe(9);

    const rescheduleTarget = await repository.createScheduleOccurrence(gymScope, {
      branchId: gym.branchIds[0]!,
      serviceId: service.id,
      startsAt: new Date(Date.now() + 4 * 86400000).toISOString(),
      endsAt: new Date(Date.now() + 4 * 86400000 + 3600000).toISOString(),
      capacity: 10
    });
    const rescheduled = await repository.rescheduleBooking(
      gymScope,
      booking.id,
      rescheduleTarget.id
    );
    expect(rescheduled).toMatchObject({
      id: booking.id,
      occurrenceId: rescheduleTarget.id,
      creditsDebited: 1
    });
    expect(await repository.getCreditBalance(gymScope, member.id)).toBe(9);

    // 7. Cancellation and eligible restoration are one repository transaction.
    const cancelledBooking = await repository.cancelBooking(
      gymScope,
      booking.id,
      "Member requested reschedule"
    );

    expect(cancelledBooking?.status).toBe("cancelled");

    const ledger = await repository.listCreditLedger(gymScope, member.id);
    expect(
      ledger.find((entry) => entry.bookingId === booking.id && entry.reason === "booking")?.delta
    ).toBe(-1);
    expect(
      ledger.find((entry) => entry.bookingId === booking.id && entry.reason === "cancellation")
        ?.delta
    ).toBe(1);

    const balanceRestored = await repository.getCreditBalance(gymScope, member.id);
    expect(balanceRestored).toBe(10);

    const waitlistMember = await repository.createMember(
      gymScope,
      {
        contact: { firstName: "Otieno", lastName: "Omondi", phone: "0711000000" },
        homeBranchId: gym.branchIds[0]!
      },
      "+254711000000"
    );
    await repository.activateMembership(gymScope, { memberId: waitlistMember.id, planId: plan.id });
    const fullService = await repository.createService(gymScope, {
      name: "Waitlist Class",
      serviceType: "class",
      durationMinutes: 60,
      defaultCapacity: 1,
      creditsRequired: 1,
      branchId: gym.branchIds[0]
    });
    const fullOccurrence = await repository.createScheduleOccurrence(gymScope, {
      branchId: gym.branchIds[0]!,
      serviceId: fullService.id,
      startsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString(),
      capacity: 1
    });
    const fullBooking = await repository.memberSelfBook(member.id, fullOccurrence.id);
    const waitlisted = await repository.memberSelfBook(waitlistMember.id, fullOccurrence.id);
    expect(waitlisted.status).toBe("waitlisted");
    expect(waitlisted.creditsDebited).toBe(0);
    await repository.memberSelfCancel(member.id, fullBooking.id, "Opening a waitlist place");
    const promoted = await repository.promoteWaitlistedBooking(gymScope, waitlisted.id);
    expect(promoted).toMatchObject({ status: "confirmed", creditsDebited: 1 });
    const portal = await repository.getMemberPortalOverview(waitlistMember.id);
    expect(portal?.upcomingBookings.some((booking) => booking.id === waitlisted.id)).toBe(true);
    const leftWaitlist = await repository.memberSelfCancel(
      waitlistMember.id,
      waitlisted.id,
      "No longer interested"
    );
    expect(leftWaitlist.status).toBe("cancelled");
    expect(leftWaitlist.lateCancelled).toBe(false);

    const strictService = await repository.createService(gymScope, {
      name: "Strict Cancellation Class",
      serviceType: "class",
      durationMinutes: 60,
      defaultCapacity: 10,
      creditsRequired: 1,
      cancellationCutoffMinutes: 999999,
      branchId: gym.branchIds[0]
    });
    const strictOccurrence = await repository.createScheduleOccurrence(gymScope, {
      branchId: gym.branchIds[0]!,
      serviceId: strictService.id,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 + 3600000).toISOString(),
      capacity: 10
    });
    const memberBooking = await repository.createBooking(
      gymScope,
      { occurrenceId: strictOccurrence.id, memberId: member.id, source: "member_portal" },
      member.id,
      false
    );
    const lateCancellation = await repository.memberSelfCancel(
      member.id,
      memberBooking.id,
      "Too late to attend"
    );
    expect(lateCancellation.lateCancelled).toBe(true);
    // The full occurrence booking was cancelled to open a waitlist slot, so its
    // entitlement was restored before this late cancellation debit.
    expect(await repository.getCreditBalance(gymScope, member.id)).toBe(9);

    const adjustment = await repository.adjustCredit(
      gymScope,
      member.id,
      {
        membershipId: activation.membership.id,
        delta: -2,
        reason: "Correcting two complimentary sessions"
      },
      gym.user.id
    );
    expect(adjustment.reason).toBe("manual_adjustment");
    expect(await repository.getCreditBalance(gymScope, member.id)).toBe(7);
    await expect(
      repository.adjustCredit(
        gymScope,
        member.id,
        {
          membershipId: activation.membership.id,
          delta: -9,
          reason: "Invalid negative correction"
        },
        gym.user.id
      )
    ).rejects.toThrow(/negative balance/i);

    // 8. Verify tenant isolation on plans and memberships
    const pilatesPlans = await repository.listMembershipPlans(pilatesScope);
    expect(pilatesPlans.find((p) => p.id === plan.id)).toBeUndefined();

    const pilatesMemberMemberships = await repository.listMemberMemberships(
      pilatesScope,
      member.id
    );
    expect(pilatesMemberMemberships).toEqual([]);

    const pilatesCredits = await repository.listCreditLedger(pilatesScope, member.id);
    expect(pilatesCredits).toEqual([]);

    const renewed = await repository.renewMembership(gymScope, activation.membership.id);
    expect(renewed?.membership.status).toBe("active");
    expect(renewed?.ledgerEntry.delta).toBe(20);

    const noBranchScope = { ...gymScope, branchIds: [] };
    expect(await repository.listMembershipPlans(noBranchScope)).toEqual([]);
    expect(await repository.findMembershipPlanById(noBranchScope, plan.id)).toBeNull();
  });

  it("allows staff to join and leave a full-session waitlist without debiting credits", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.("hash");
    const gym = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!gym) throw new Error("Seed identity missing.");
    const scope = {
      tenantId: gym.tenant.id,
      tenantUserId: gym.tenantUserId,
      userId: gym.user.id,
      branchIds: gym.branchIds
    };
    const plan = await repository.createMembershipPlan(scope, {
      branchId: gym.branchIds[0],
      name: "Staff waitlist plan",
      includedCredits: 2,
      durationDays: 30
    });
    const first = await repository.createMember(
      scope,
      { contact: { firstName: "First" }, homeBranchId: gym.branchIds[0]! },
      null
    );
    const second = await repository.createMember(
      scope,
      { contact: { firstName: "Second" }, homeBranchId: gym.branchIds[0]! },
      null
    );
    await repository.activateMembership(scope, { memberId: first.id, planId: plan.id });
    await repository.activateMembership(scope, { memberId: second.id, planId: plan.id });
    const service = await repository.createService(scope, {
      branchId: gym.branchIds[0],
      name: "Staff waitlist class",
      serviceType: "class",
      durationMinutes: 30,
      defaultCapacity: 1,
      creditsRequired: 1
    });
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const occurrence = await repository.createScheduleOccurrence(scope, {
      branchId: gym.branchIds[0]!,
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
      capacity: 1
    });
    await repository.createBooking(
      scope,
      { occurrenceId: occurrence.id, memberId: first.id, source: "staff" },
      gym.user.id,
      false
    );
    const before = await repository.getCreditBalance(scope, second.id);
    const waitlisted = await repository.createBooking(
      scope,
      { occurrenceId: occurrence.id, memberId: second.id, source: "staff", waitlist: true },
      gym.user.id,
      false
    );
    expect(waitlisted).toMatchObject({ status: "waitlisted", creditsDebited: 0 });
    expect(await repository.getCreditBalance(scope, second.id)).toBe(before);
    await expect(
      repository.createBooking(
        scope,
        { occurrenceId: occurrence.id, memberId: second.id, source: "staff", waitlist: true },
        gym.user.id,
        false
      )
    ).rejects.toThrow(/already has a booking/i);
    const left = await repository.cancelBooking(scope, waitlisted.id, "No longer interested");
    expect(left).toMatchObject({ status: "cancelled", creditsDebited: 0 });
  });
});
