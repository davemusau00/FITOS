import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher, hashSessionToken } from "@fitos/auth";
import type { CreateMemberRequest } from "@fitos/contracts";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

const memberInput = (branchId: string): CreateMemberRequest => ({
  contact: { firstName: "Amina", lastName: "Otieno", phone: "0712345678" },
  homeBranchId: branchId
});

describe("tenant isolation", () => {
  it("rejects a known member ID belonging to another tenant", async () => {
    const repository = new InMemoryFitosRepository();
    const passwordHash = await new ScryptPasswordHasher().hash("ChangeMe123!");
    await repository.seedDevelopmentData?.(passwordHash);
    const gym = await repository.findLoginIdentity("owner@gym.fitos.test");
    const pilates = await repository.findLoginIdentity("owner@pilates.fitos.test");
    expect(gym).not.toBeNull();
    expect(pilates).not.toBeNull();
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
      memberInput(gym.branchIds[0]!),
      "+254712345678"
    );

    await expect(repository.findMemberById(pilatesScope, member.id)).resolves.toBeNull();
    await expect(repository.searchMembers(pilatesScope, { query: "Amina" })).resolves.toMatchObject(
      { data: [] }
    );
  });

  it("binds an opaque session to one tenant user and permits revocation", async () => {
    const repository = new InMemoryFitosRepository();
    const passwordHash = await new ScryptPasswordHasher().hash("ChangeMe123!");
    await repository.seedDevelopmentData?.(passwordHash);
    const identity = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!identity) throw new Error("Seed identity missing.");
    const tokenHash = hashSessionToken("opaque-test-token");
    await repository.createSession({
      userId: identity.user.id,
      tenantUserId: identity.tenantUserId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    const resolved = await repository.resolveSession(tokenHash, new Date().toISOString());
    expect(resolved?.tenant.id).toBe(identity.tenant.id);
    await repository.revokeSession(tokenHash, new Date().toISOString());
    await expect(
      repository.resolveSession(tokenHash, new Date().toISOString())
    ).resolves.toBeNull();
  });

  it("persists and resolves multiple staff role assignments", async () => {
    const repository = new InMemoryFitosRepository();
    const passwordHash = await new ScryptPasswordHasher().hash("ChangeMe123!");
    await repository.seedDevelopmentData?.(passwordHash);
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    if (!owner) throw new Error("Owner identity missing.");
    const scope = {
      tenantId: owner.tenant.id,
      tenantUserId: owner.tenantUserId,
      userId: owner.user.id,
      branchIds: owner.branchIds
    };
    const roles = await repository.listRoles(scope);
    const trainer = roles.find((role) => role.key === "trainer");
    const manager = roles.find((role) => role.key === "manager");
    if (!trainer || !manager) throw new Error("Expected seeded roles missing.");
    const invited = await repository.inviteStaff(scope, {
      email: "multi-role@gym.fitos.test",
      displayName: "Multi Role",
      roleId: trainer.id,
      branchIds: [owner.branchIds[0]!]
    });
    const updated = await repository.updateStaffAccess(scope, invited.user.id, {
      roleId: trainer.id,
      roleIds: [trainer.id, manager.id],
      branchIds: [owner.branchIds[0]!]
    });
    expect(updated?.roles?.map((role) => role.key)).toEqual(["trainer", "manager"]);
  });
});
