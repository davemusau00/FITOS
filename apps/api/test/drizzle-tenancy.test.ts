import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizePhone } from "@fitos/shared";
import { DrizzleFitosRepository } from "../src/repositories/drizzle-fitos.repository.js";
import type { LoginIdentity, TenantScope } from "../src/ports/fitos-repository.js";

const databaseTests = process.env.RUN_DATABASE_TESTS === "true";
const describeDatabase = databaseTests ? describe : describe.skip;

let repository: DrizzleFitosRepository;
let gym: LoginIdentity;
let pilates: LoginIdentity;

const scopeOf = (identity: LoginIdentity): TenantScope => ({
  tenantId: identity.tenant.id,
  tenantUserId: identity.tenantUserId,
  userId: identity.user.id,
  branchIds: identity.branchIds
});

describeDatabase("Drizzle tenant isolation", () => {
  beforeAll(async () => {
    repository = new DrizzleFitosRepository();
    gym = (await repository.findLoginIdentity("owner@gym.fitos.test"))!;
    pilates = (await repository.findLoginIdentity("owner@pilates.fitos.test"))!;
    if (!gym || !pilates) throw new Error("Expected seeded integration-test tenants.");
  });

  afterAll(async () => repository?.close());

  it("scopes member reads and database references by tenant", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const created = await repository.createMember(
      gymScope,
      {
        contact: { firstName: "Database Isolation", phone: "+254712345679" },
        homeBranchId: gym.branchIds[0]!
      },
      normalizePhone("+254712345679")
    );

    expect(await repository.findMemberById(pilatesScope, created.id)).toBeNull();

    await expect(
      repository.createMember(
        gymScope,
        { contact: { firstName: "Invalid Branch" }, homeBranchId: pilates.branchIds[0]! },
        null
      )
    ).rejects.toThrow(/preferred branch must belong to the contact tenant/);
  });

  it("scopes CRM records and reuses a lead contact on conversion", async () => {
    const gymScope = scopeOf(gym);
    const pilatesScope = scopeOf(pilates);
    const lead = await repository.createLead(
      gymScope,
      {
        contact: { firstName: "Lead Isolation", phone: "+254712345680" },
        branchId: gym.branchIds[0]!,
        source: "integration-test"
      },
      normalizePhone("+254712345680")
    );
    expect(await repository.findLeadById(pilatesScope, lead.id)).toBeNull();
    const converted = await repository.convertLead(gymScope, lead.id, gym.user.id);
    expect(converted?.member.contact.id).toBe(lead.contact.id);
    expect((await repository.convertLead(gymScope, lead.id, gym.user.id))?.alreadyConverted).toBe(
      true
    );
  });
});
