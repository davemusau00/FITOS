import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher } from "@fitos/auth";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

describe("public reservation capacity", () => {
  it("confirms available spots and waitlists reservations after capacity", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const identity = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!identity) throw new Error("Seed identity missing.");
    const scope = {
      tenantId: identity.tenant.id,
      tenantUserId: identity.tenantUserId,
      userId: identity.user.id,
      branchIds: identity.branchIds
    };
    const occurrences = await repository.listScheduleOccurrences(scope, {
      branchId: identity.branchIds[0],
      limit: 1
    });
    const occurrence = occurrences.data[0];
    if (!occurrence) throw new Error("Seed occurrence missing.");
    const existingBookings = await repository.listBookings(scope, {
      occurrenceId: occurrence.id,
      limit: 100
    });
    const availableSpots = Math.max(
      occurrence.capacity -
        existingBookings.data.filter((booking) => booking.status === "confirmed").length,
      0
    );
    const reservations = await Promise.all(
      Array.from({ length: availableSpots + 1 }, (_, index) =>
        repository.createPublicReservation("fitos-demo-gym", {
          occurrenceId: occurrence.id,
          reservationType: "class",
          firstName: `Guest${index}`,
          phone: `+25470000${String(index).padStart(4, "0")}`
        })
      )
    );
    expect(
      reservations
        .slice(0, availableSpots)
        .every((reservation) => reservation.status === "confirmed")
    ).toBe(true);
    expect(reservations.at(-1)?.status).toBe("waitlisted");
  });
});
