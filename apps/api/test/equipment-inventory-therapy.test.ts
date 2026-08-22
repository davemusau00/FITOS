import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher } from "@fitos/auth";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";
import type { TenantScope } from "../src/ports/fitos-repository.js";

describe("Equipment, Inventory, Diagnostics & Therapy - Tenancy & Integrity", () => {
  it("enforces cross-tenant and branch isolation across Equipment, Inventory, Assessments, and Therapy", async () => {
    const repository = new InMemoryFitosRepository();
    const passwordHash = await new ScryptPasswordHasher().hash("ChangeMe123!");
    await repository.seedDevelopmentData?.(passwordHash);

    const gym = await repository.findLoginIdentity("owner@gym.fitos.test");
    const pilates = await repository.findLoginIdentity("owner@pilates.fitos.test");
    expect(gym).not.toBeNull();
    expect(pilates).not.toBeNull();
    if (!gym || !pilates) throw new Error("Seed identities missing.");

    const gymScope: TenantScope = {
      tenantId: gym.tenant.id,
      tenantUserId: gym.tenantUserId,
      userId: gym.user.id,
      branchIds: gym.branchIds
    };
    const pilatesScope: TenantScope = {
      tenantId: pilates.tenant.id,
      tenantUserId: pilates.tenantUserId,
      userId: pilates.user.id,
      branchIds: pilates.branchIds
    };

    // ── 1. Equipment Isolation ──
    const asset = await repository.createEquipmentAsset(gymScope, {
      branchId: gym.branchIds[0]!,
      name: "Commercial Reformer Pro #01",
      modelName: "Allegro 2",
      category: "reformer",
      serialNumber: "REF-001"
    });
    expect(asset.id).toBeDefined();

    // Gym can read its asset
    const gymAssets = await repository.listEquipmentAssets(gymScope);
    expect(gymAssets.some((a) => a.id === asset.id)).toBe(true);

    // Pilates cannot read or find Gym's asset
    const pilatesAssets = await repository.listEquipmentAssets(pilatesScope);
    expect(pilatesAssets.some((a) => a.id === asset.id)).toBe(false);
    expect(await repository.findEquipmentAssetById(pilatesScope, asset.id)).toBeNull();

    // ── 2. Inventory Isolation & Ledger Integrity ──
    const item = await repository.createInventoryItem(gymScope, {
      branchId: gym.branchIds[0]!,
      sku: "PROT-WHEY-500G",
      name: "Whey Protein Isolate 500g",
      category: "supplements",
      unitCostMinor: 250000,
      retailPriceMinor: 400000,
      initialStock: 25,
      reorderPoint: 5,
      reorderQuantity: 20
    });
    expect(item.stockOnHand).toBe(25);

    // Record stock movement (sale_out 5 units)
    const mov = await repository.createInventoryMovement(
      gymScope,
      {
        branchId: gym.branchIds[0]!,
        itemId: item.id,
        movementType: "sale_out",
        quantity: 5,
        notes: "POS Member Retail Sale"
      },
      gym.user.id
    );
    expect(mov.quantity).toBe(5);

    const updatedItem = await repository.findInventoryItemById(gymScope, item.id);
    expect(updatedItem?.stockOnHand).toBe(20);

    // Pilates cannot read Gym's inventory item or movements
    const pilatesItems = await repository.listInventoryItems(pilatesScope);
    expect(pilatesItems.some((i) => i.id === item.id)).toBe(false);
    expect(await repository.findInventoryItemById(pilatesScope, item.id)).toBeNull();

    // ── 3. Assessments & Diagnostic Sessions Isolation ──
    const def = await repository.createAssessmentDefinition(gymScope, {
      name: "VALD ForceDecks Jump Kinetics",
      category: "neuromuscular_force",
      deviceVendor: "vald_forcedecks",
      description: "Countermovement jump peak force & asymmetry test",
      metrics: [
        { key: "jumpHeightCm", name: "Jump Height", unit: "cm", optimalMin: 35 },
        { key: "rsiModified", name: "RSI-modified", unit: "index", optimalMin: 0.4 }
      ]
    });
    expect(def.id).toBeDefined();

    const gymDefs = await repository.listAssessmentDefinitions(gymScope);
    expect(gymDefs.some((d) => d.id === def.id)).toBe(true);

    const pilatesDefs = await repository.listAssessmentDefinitions(pilatesScope);
    expect(pilatesDefs.some((d) => d.id === def.id)).toBe(false);

    // ── 4. Therapy & Modalities Isolation ──
    const proto = await repository.createTherapyProtocol(gymScope, {
      modalityCode: "neubie_direct_current",
      modalityName: "NEUBIE DC Stim",
      name: "Rotator Cuff Tendinopathy Pulse Reset",
      indication: "Supraspinatus tendinopathy, shoulder impingement",
      targetArea: "Posterior Deltoid & Infraspinatus",
      parameters: { frequencyHz: 40, intensitymA: 3.2, durationMinutes: 30 },
      safetyChecklist: ["No pacemaker", "Skin intact"],
      clinicalNotes: "Target motor point of supraspinatus."
    });
    expect(proto.id).toBeDefined();

    const gymProtos = await repository.listTherapyProtocols(gymScope);
    expect(gymProtos.some((p) => p.id === proto.id)).toBe(true);

    const pilatesProtos = await repository.listTherapyProtocols(pilatesScope);
    expect(pilatesProtos.some((p) => p.id === proto.id)).toBe(false);
  });
});
