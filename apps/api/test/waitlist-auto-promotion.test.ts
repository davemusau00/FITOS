import { describe, expect, it } from "vitest";
import type { RequestActor } from "@fitos/contracts";
import { CoreService } from "../src/modules/core/core.service.js";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

describe("waitlist auto-promotion", () => {
  it("promotes the oldest eligible waitlisted member after staff cancellation", async () => {
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
      sessionId: "waitlist-auto-promotion-test"
    };
    const plan = await repository.createMembershipPlan(scope, {
      branchId,
      name: "Auto promotion plan",
      includedCredits: 2,
      durationDays: 30
    });
    const first = await repository.createMember(
      scope,
      { contact: { firstName: "Confirmed" }, homeBranchId: branchId },
      null
    );
    const second = await repository.createMember(
      scope,
      { contact: { firstName: "Waitlisted" }, homeBranchId: branchId },
      null
    );
    await repository.activateMembership(scope, { memberId: first.id, planId: plan.id });
    await repository.activateMembership(scope, { memberId: second.id, planId: plan.id });
    const service = await repository.createService(scope, {
      branchId,
      name: "Auto promotion class",
      serviceType: "class",
      durationMinutes: 30,
      defaultCapacity: 1,
      creditsRequired: 1
    });
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const occurrence = await repository.createScheduleOccurrence(scope, {
      branchId,
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
      capacity: 1
    });
    const confirmed = await repository.createBooking(
      scope,
      { occurrenceId: occurrence.id, memberId: first.id, source: "staff" },
      owner.user.id,
      false
    );
    const waitlisted = await repository.memberSelfBook(second.id, occurrence.id);
    expect(waitlisted.status).toBe("waitlisted");

    await new CoreService(repository).cancelBooking(
      actor,
      "auto-promotion-request",
      confirmed.id,
      "Opening a place"
    );

    await expect(repository.findBookingById(scope, waitlisted.id)).resolves.toMatchObject({
      status: "confirmed",
      creditsDebited: 1
    });
    await expect(repository.listAuditEvents(scope, waitlisted.id)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "booking.waitlist_auto_promoted" })
      ])
    );
  });
});
