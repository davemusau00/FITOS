import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher } from "@fitos/auth";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

describe("automation result durability", () => {
  it("records delivery outcomes only for the owning tenant", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    const other = await repository.findLoginIdentity("owner@pilates.fitos.test");
    if (!owner || !other) throw new Error("Seed identities missing.");
    const scope = {
      tenantId: owner.tenant.id,
      tenantUserId: owner.tenantUserId,
      userId: owner.user.id,
      branchIds: owner.branchIds
    };
    const rule = await repository.createAutomation(scope, {
      name: "Result test",
      triggerType: "member_joined",
      actionType: "send_email",
      actionConfig: {},
      isActive: true
    });
    const log = await repository.triggerAutomation(scope, rule.id);
    const recorded = await repository.recordAutomationActionResult(log.id, {
      actionId: log.id,
      actionType: "send_email",
      status: "delivered",
      provider: "test",
      message: "Delivered",
      completedAt: new Date().toISOString()
    });
    expect(recorded).toBe(true);
    const otherScope = {
      tenantId: other.tenant.id,
      tenantUserId: other.tenantUserId,
      userId: other.user.id,
      branchIds: other.branchIds
    };
    expect(await repository.listAutomationLogs(otherScope)).toEqual([]);
  });
});
