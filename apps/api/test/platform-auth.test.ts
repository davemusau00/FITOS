import { Reflector } from "@nestjs/core";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher } from "@fitos/auth";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";
import { PlatformAdminGuard } from "../src/common/auth/platform-admin.guard.js";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

describe("platform authentication token lifecycle", () => {
  it("accepts only active, unrevoked, unexpired tokens belonging to platform admins", async () => {
    const repository = new InMemoryFitosRepository();
    await repository.seedDevelopmentData?.(await new ScryptPasswordHasher().hash("ChangeMe123!"));
    const owner = await repository.findLoginIdentity("owner@gym.fitos.test");
    const other = await repository.findLoginIdentity("owner@pilates.fitos.test");
    if (!owner || !other) throw new Error("Seed identities missing.");

    const users = (repository as unknown as { users: Map<string, Record<string, unknown>> }).users;
    const ownerUser = users.get(owner.user.id);
    const otherUser = users.get(other.user.id);
    if (!ownerUser || !otherUser) throw new Error("Seed users missing.");
    ownerUser.isPlatformAdmin = true;

    await repository.createPlatformAdminToken({
      userId: owner.user.id,
      tokenHash: hash("valid"),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    await repository.createPlatformAdminToken({
      userId: owner.user.id,
      tokenHash: hash("expired"),
      expiresAt: new Date(Date.now() - 1_000).toISOString()
    });
    await repository.createPlatformAdminToken({
      userId: owner.user.id,
      tokenHash: hash("revoked"),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    await repository.revokePlatformAdminToken(hash("revoked"), new Date().toISOString());
    await repository.createPlatformAdminToken({
      userId: other.user.id,
      tokenHash: hash("cross-user"),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });

    expect(await repository.resolvePlatformAdminByTokenHash(hash("valid"))).toMatchObject({
      userId: owner.user.id
    });
    expect(await repository.resolvePlatformAdminByTokenHash(hash("expired"))).toBeNull();
    expect(await repository.resolvePlatformAdminByTokenHash(hash("revoked"))).toBeNull();
    expect(await repository.resolvePlatformAdminByTokenHash(hash("cross-user"))).toBeNull();

    ownerUser.status = "inactive";
    expect(await repository.resolvePlatformAdminByTokenHash(hash("valid"))).toBeNull();
  });
});

describe("platform admin guard", () => {
  const context = (token?: string) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          header: (name: string) => (name.toLowerCase() === "x-platform-token" ? token : undefined)
        })
      })
    }) as never;

  it.each([
    ["missing-session", undefined],
    ["invalid-token", "not-a-real-token"]
  ])("rejects %s platform sessions", async (_name, token) => {
    const repository = {
      resolvePlatformAdminByTokenHash: async () => null
    } as never;
    const guard = new PlatformAdminGuard(
      { getAllAndOverride: () => true } as unknown as Reflector,
      repository
    );
    await expect(guard.canActivate(context(token))).rejects.toMatchObject({ status: token ? 403 : 401 });
  });
});
