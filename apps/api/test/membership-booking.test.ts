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

    // 4. Verify credit balance is 10
    const balanceBefore = await repository.getCreditBalance(gymScope, member.id);
    expect(balanceBefore).toBe(10);

    // 5. Create service and occurrence
    const service = await repository.createService(gymScope, {
      name: "HIIT Strength",
      serviceType: "class",
      durationMinutes: 60,
      defaultCapacity: 10,
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

    // 6. Create booking and apply credit deduction
    const booking = await repository.createBooking(
      gymScope,
      {
        occurrenceId: occurrence.id,
        memberId: member.id,
        source: "staff"
      },
      gym.user.id
    );

    expect(booking.status).toBe("confirmed");

    const debit = await repository.applyBookingCredit(
      gymScope,
      booking.id,
      member.id,
      -1,
      "booking",
      "Class booking credit deduction"
    );

    expect(debit?.delta).toBe(-1);
    expect(debit?.reason).toBe("booking");

    const balanceAfterBooking = await repository.getCreditBalance(gymScope, member.id);
    expect(balanceAfterBooking).toBe(9);

    // 7. Cancel booking and restore credit
    const cancelledBooking = await repository.cancelBooking(
      gymScope,
      booking.id,
      "Member requested reschedule"
    );

    expect(cancelledBooking?.status).toBe("cancelled");

    const creditRestore = await repository.applyBookingCredit(
      gymScope,
      booking.id,
      member.id,
      1,
      "cancellation",
      "Booking cancellation credit restoration"
    );

    expect(creditRestore?.delta).toBe(1);
    expect(creditRestore?.reason).toBe("cancellation");

    const balanceRestored = await repository.getCreditBalance(gymScope, member.id);
    expect(balanceRestored).toBe(10);

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
  });
});
