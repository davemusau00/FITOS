import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher } from "@fitos/auth";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

describe("attendance integrity", () => {
  it("deduplicates check-in, enforces policy, and constrains status transitions", async () => {
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
    const member = await repository.createMember(
      gymScope,
      {
        contact: { firstName: "Attendance", lastName: "Member" },
        homeBranchId: gym.branchIds[0]!
      },
      null
    );
    const plan = await repository.createMembershipPlan(gymScope, {
      branchId: gym.branchIds[0],
      name: "Attendance Pack",
      includedCredits: 2,
      durationDays: 30
    });
    await repository.activateMembership(gymScope, { memberId: member.id, planId: plan.id });
    const service = await repository.createService(gymScope, {
      branchId: gym.branchIds[0],
      name: "Attendance Class",
      serviceType: "class",
      durationMinutes: 45,
      defaultCapacity: 10,
      creditsRequired: 1
    });
    const startsAt = new Date(Date.now() + 3600000);
    const occurrence = await repository.createScheduleOccurrence(gymScope, {
      branchId: gym.branchIds[0]!,
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 2700000).toISOString(),
      capacity: 10
    });
    await repository.createBooking(
      gymScope,
      { occurrenceId: occurrence.id, memberId: member.id, source: "staff" },
      gym.user.id,
      false
    );

    const checkIns = await Promise.all([
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
    expect(checkIns[0]).toEqual(checkIns[1]);
    expect(
      (await repository.listAttendanceRecords(gymScope, { occurrenceId: occurrence.id })).data
    ).toHaveLength(1);
    expect(await repository.findAttendanceRecord(pilatesScope, checkIns[0].id)).toBeNull();

    const attended = await repository.updateAttendanceStatus(
      gymScope,
      checkIns[0].id,
      { status: "attended" },
      false
    );
    expect(attended?.status).toBe("attended");
    await expect(
      repository.updateAttendanceStatus(gymScope, checkIns[0].id, { status: "no_show" }, false)
    ).rejects.toThrow(/illegal/i);
    const corrected = await repository.updateAttendanceStatus(
      gymScope,
      checkIns[0].id,
      { status: "no_show", overrideReason: "Correcting a mistaken member selection" },
      true
    );
    expect(corrected?.status).toBe("no_show");

    const walkIn = await repository.createMember(
      gymScope,
      {
        contact: { firstName: "Walk-in", lastName: "Override" },
        homeBranchId: gym.branchIds[0]!
      },
      null
    );
    await expect(
      repository.checkIn(gymScope, { memberId: walkIn.id }, gym.user.id, gym.branchIds[0]!, false)
    ).rejects.toThrow(/entitlement/i);
    const overridden = await repository.checkIn(
      gymScope,
      { memberId: walkIn.id, overrideReason: "Authorized guest day pass" },
      gym.user.id,
      gym.branchIds[0]!,
      true
    );
    expect(overridden.occurrenceId).toBeNull();
    expect(overridden.overrideReason).toBe("Authorized guest day pass");
  });
});
