import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher } from "@fitos/auth";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";
import {
  assertBoundedWindow,
  generateWeeklyOccurrences
} from "../src/modules/schedule/recurrence.js";

const template = {
  branchId: "10000000-0000-4000-8000-000000000001",
  serviceId: "20000000-0000-4000-8000-000000000001",
  trainerUserId: null,
  roomId: null,
  timezone: "Africa/Nairobi",
  daysOfWeek: [2, 4],
  localStartTime: "18:00",
  durationMinutes: 60,
  capacity: 12,
  effectiveStartDate: "2026-08-24",
  effectiveEndDate: "2026-09-02"
};

describe("weekly schedule materialization", () => {
  it("materializes selected weekdays at the correct tenant-local wall time", () => {
    const occurrences = generateWeeklyOccurrences(template, "2026-08-24", "2026-09-02");

    expect(occurrences.map((occurrence) => occurrence.startsAt)).toEqual([
      "2026-08-25T15:00:00.000Z",
      "2026-08-27T15:00:00.000Z",
      "2026-09-01T15:00:00.000Z"
    ]);
    expect(occurrences.every((occurrence) => occurrence.endsAt.endsWith("16:00:00.000Z"))).toBe(
      true
    );
  });

  it("rejects an unbounded materialization request", () => {
    expect(() => assertBoundedWindow("2026-01-01", "2027-01-03")).toThrow(
      /limited to 367 inclusive days/i
    );
  });

  it("rejects a local time that does not exist during a DST transition", () => {
    expect(() =>
      generateWeeklyOccurrences(
        {
          ...template,
          timezone: "America/New_York",
          daysOfWeek: [0],
          localStartTime: "02:30",
          effectiveStartDate: "2026-03-08",
          effectiveEndDate: "2026-03-08"
        },
        "2026-03-08",
        "2026-03-08"
      )
    ).toThrow(/does not exist/i);
  });
});

describe("recurring schedule repository", () => {
  it("atomically creates a tenant-scoped series and preserves its template on override", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const gym = await repository.findLoginIdentity("owner@gym.fitos.test");
    const pilates = await repository.findLoginIdentity("owner@pilates.fitos.test");
    if (!gym || !pilates) throw new Error("Expected seeded identities.");
    const scope = {
      tenantId: gym.tenant.id,
      tenantUserId: gym.tenantUserId,
      userId: gym.user.id,
      branchIds: gym.branchIds
    };
    const otherScope = {
      tenantId: pilates.tenant.id,
      tenantUserId: pilates.tenantUserId,
      userId: pilates.user.id,
      branchIds: pilates.branchIds
    };
    const suffix = crypto.randomUUID().slice(0, 8);
    const service = await repository.createService(scope, {
      branchId: scope.branchIds[0],
      name: `Recurring ${suffix}`,
      serviceType: "class",
      durationMinutes: 60,
      defaultCapacity: 12
    });
    const room = await repository.createRoom(scope, {
      branchId: scope.branchIds[0]!,
      name: `Recurring room ${suffix}`,
      capacity: 12
    });
    const input = {
      branchId: scope.branchIds[0]!,
      serviceId: service.id,
      roomId: room.id,
      timezone: "Africa/Nairobi",
      daysOfWeek: [2],
      localStartTime: "18:00",
      durationMinutes: 60,
      capacity: 12,
      effectiveStartDate: "2030-01-01",
      effectiveEndDate: "2030-01-31",
      materializeThroughDate: "2030-01-31"
    };
    const occurrences = generateWeeklyOccurrences(input, "2030-01-01", "2030-01-31");
    const created = await repository.createScheduleTemplate(
      scope,
      input,
      occurrences,
      "2030-01-31"
    );

    expect(created.occurrences).toHaveLength(5);
    expect(
      created.occurrences.every((occurrence) => occurrence.templateId === created.template.id)
    ).toBe(true);
    await expect(
      repository.findScheduleTemplateById(otherScope, created.template.id)
    ).resolves.toBeNull();
    await expect(
      repository.materializeScheduleTemplate(otherScope, created.template.id, [], "2030-02-01")
    ).resolves.toBeNull();

    await expect(
      repository.createScheduleTemplate(
        scope,
        { ...input, effectiveEndDate: "2030-01-07" },
        [occurrences[0]!],
        "2030-01-07"
      )
    ).rejects.toThrow(/conflict/i);
    expect(await repository.listScheduleTemplates(scope)).toHaveLength(1);

    const first = created.occurrences[0]!;
    const movedStartsAt = new Date(new Date(first.startsAt).getTime() + 2 * 60 * 60 * 1000);
    const movedEndsAt = new Date(movedStartsAt.getTime() + 60 * 60 * 1000);
    const overridden = await repository.overrideScheduleOccurrence(
      scope,
      first.id,
      {
        startsAt: movedStartsAt.toISOString(),
        endsAt: movedEndsAt.toISOString(),
        reason: "Trainer requested a later start"
      },
      scope.userId
    );
    expect(overridden?.startsAt).toBe(movedStartsAt.toISOString());
    expect(
      (await repository.findScheduleTemplateById(scope, created.template.id))?.localStartTime
    ).toBe("18:00");
    await expect(
      repository.overrideScheduleOccurrence(
        scope,
        first.id,
        { capacity: 10, reason: "Second override" },
        scope.userId
      )
    ).rejects.toThrow(/already overridden/i);
  });
});
