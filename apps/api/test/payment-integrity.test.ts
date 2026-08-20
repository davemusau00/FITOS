import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher } from "@fitos/auth";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

describe("payment ledger integrity", () => {
  it("reconciles once, rejects reassignment, and only voids completed payments", async () => {
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
        contact: { firstName: "Payment", lastName: "Member" },
        homeBranchId: gym.branchIds[0]!
      },
      null
    );
    const otherMember = await repository.createMember(
      gymScope,
      {
        contact: { firstName: "Other", lastName: "Member" },
        homeBranchId: gym.branchIds[0]!
      },
      null
    );

    await expect(
      repository.createPayment(
        gymScope,
        {
          branchId: gym.branchIds[0]!,
          amount: { amountMinor: "0", currency: "KES" },
          method: "cash"
        },
        gym.user.id
      )
    ).rejects.toThrow(/greater than zero/i);

    const payment = await repository.createPayment(
      gymScope,
      {
        branchId: gym.branchIds[0]!,
        amount: { amountMinor: "150000", currency: "KES" },
        method: "bank_transfer",
        reference: "BANK-TEST-1"
      },
      gym.user.id
    );
    expect(payment.memberId).toBeNull();
    expect((await repository.listPayments(gymScope, { unmatched: true })).data).toHaveLength(1);
    expect(await repository.findPaymentById(pilatesScope, payment.id)).toBeNull();

    const reconciliation = {
      memberId: member.id,
      allocationType: "other" as const,
      reason: "Bank reference confirmed"
    };
    const matched = await repository.reconcilePayment(gymScope, payment.id, reconciliation);
    const duplicate = await repository.reconcilePayment(gymScope, payment.id, reconciliation);
    expect(matched?.memberId).toBe(member.id);
    expect(duplicate).toEqual(matched);
    expect((await repository.listPayments(gymScope, { unmatched: true })).data).toEqual([]);

    await expect(
      repository.reconcilePayment(gymScope, payment.id, {
        ...reconciliation,
        memberId: otherMember.id
      })
    ).rejects.toThrow(/already reconciled/i);

    const voided = await repository.voidPayment(gymScope, payment.id, "Duplicate bank entry");
    expect(voided?.status).toBe("voided");
    expect(await repository.voidPayment(gymScope, payment.id, "Duplicate bank entry")).toEqual(
      voided
    );
    await expect(repository.reconcilePayment(gymScope, payment.id, reconciliation)).rejects.toThrow(
      /completed/i
    );

    const refundable = await repository.createPayment(
      gymScope,
      {
        branchId: gym.branchIds[0]!,
        memberId: member.id,
        amount: { amountMinor: "50000", currency: "KES" },
        method: "cash",
        allocationType: "other"
      },
      gym.user.id
    );
    const refunds = await Promise.all([
      repository.refundPayment(gymScope, refundable.id, "Class cancelled"),
      repository.refundPayment(gymScope, refundable.id, "Class cancelled")
    ]);
    expect(refunds[0]?.status).toBe("refunded");
    expect(refunds[1]).toEqual(refunds[0]);
  });
});
