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
      branchId: gym.branchIds[0]
    });

    const startsAt = new Date(Date.now() + 86400000).toISOString();
    const endsAt = new Date(Date.now() + 86400000 + 3600000).toISOString();
    const occurrence = await repository.createScheduleOccurrence(gymScope, {
      branchId: gym.branchIds[0]!,
      serviceId: service.id,
      startsAt,
      endsAt,
      capacity: 10
    });

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

    const noBranchScope = { ...gymScope, branchIds: [] };
    expect(await repository.listMembershipPlans(noBranchScope)).toEqual([]);
    expect(await repository.findMembershipPlanById(noBranchScope, plan.id)).toBeNull();
  });
});
