import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  CreateEquipmentAssetRequest,
  CreateEquipmentPoolRequest,
  CreateMaintenanceRecordRequest,
  EquipmentStatus,
  RequestActor,
  UpdateEquipmentAssetRequest
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

const equipmentStatuses = [
  "available",
  "in_use",
  "maintenance",
  "calibration_due",
  "out_of_service",
  "retired"
] as const;

const createAssetSchema = z
  .object({
    branchId: z.string().uuid(),
    roomId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(150),
    assetCode: z.string().trim().min(1).max(50),
    serialNumber: z.string().trim().max(100).nullable().optional(),
    modelName: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(100),
    status: z.enum(equipmentStatuses).optional(),
    purchaseDate: z.string().optional(),
    warrantyEndsAt: z.string().optional(),
    nextServiceDueAt: z.string().optional(),
    nextCalibrationDueAt: z.string().optional(),
    notes: z.string().trim().max(1000).nullable().optional()
  })
  .strict();

const updateAssetSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    roomId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(150).optional(),
    assetCode: z.string().trim().min(1).max(50).optional(),
    serialNumber: z.string().trim().max(100).nullable().optional(),
    modelName: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    status: z.enum(equipmentStatuses).optional(),
    purchaseDate: z.string().optional(),
    warrantyEndsAt: z.string().optional(),
    nextServiceDueAt: z.string().optional(),
    nextCalibrationDueAt: z.string().optional(),
    notes: z.string().trim().max(1000).nullable().optional()
  })
  .strict();

const createPoolSchema = z
  .object({
    branchId: z.string().uuid(),
    name: z.string().trim().min(1).max(150),
    category: z.string().trim().min(1).max(100),
    assetIds: z.array(z.string().uuid())
  })
  .strict();

const createMaintenanceSchema = z
  .object({
    assetId: z.string().uuid(),
    type: z.enum(["maintenance", "calibration", "inspection", "repair"]),
    performedBy: z.string().trim().min(1).max(100),
    costMinor: z.number().int().nonnegative().nullable().optional(),
    notes: z.string().trim().min(1).max(1000),
    nextDueAt: z.string().optional()
  })
  .strict();

const toScope = (actor: RequestActor) => ({
  tenantId: actor.tenantId,
  tenantUserId: actor.tenantUserId,
  userId: actor.userId,
  branchIds: actor.branchIds
});

@ApiTags("equipment")
@Controller("equipment")
export class EquipmentController {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  @Get("assets")
  @RequirePermission("schedule:read")
  listAssets(@Actor() actor: RequestActor, @Query("branchId") branchId?: string) {
    return this.repository.listEquipmentAssets(toScope(actor), branchId);
  }

  @Get("assets/:assetId")
  @RequirePermission("schedule:read")
  async getAsset(@Actor() actor: RequestActor, @Param("assetId") assetId: string) {
    const asset = await this.repository.findEquipmentAssetById(toScope(actor), assetId);
    if (!asset) throw new NotFoundException("Equipment asset not found.");
    return asset;
  }

  @Post("assets")
  @RequirePermission("schedule:manage")
  createAsset(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createAssetSchema.parse(body) as CreateEquipmentAssetRequest;
    return this.repository.createEquipmentAsset(toScope(actor), input);
  }

  @Patch("assets/:assetId")
  @RequirePermission("schedule:manage")
  async updateAsset(
    @Actor() actor: RequestActor,
    @Param("assetId") assetId: string,
    @Body() body: unknown
  ) {
    const input = updateAssetSchema.parse(body) as UpdateEquipmentAssetRequest;
    const result = await this.repository.updateEquipmentAsset(toScope(actor), assetId, input);
    if (!result) throw new NotFoundException("Equipment asset not found.");
    return result;
  }

  @Get("pools")
  @RequirePermission("schedule:read")
  listPools(@Actor() actor: RequestActor, @Query("branchId") branchId?: string) {
    return this.repository.listEquipmentPools(toScope(actor), branchId);
  }

  @Post("pools")
  @RequirePermission("schedule:manage")
  createPool(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createPoolSchema.parse(body) as CreateEquipmentPoolRequest;
    return this.repository.createEquipmentPool(toScope(actor), input);
  }

  @Get("maintenance")
  @RequirePermission("schedule:read")
  listMaintenance(@Actor() actor: RequestActor, @Query("assetId") assetId?: string) {
    return this.repository.listEquipmentMaintenance(toScope(actor), assetId);
  }

  @Post("maintenance")
  @RequirePermission("schedule:manage")
  createMaintenance(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createMaintenanceSchema.parse(body) as CreateMaintenanceRecordRequest;
    return this.repository.createEquipmentMaintenance(toScope(actor), input);
  }

  @Get("allocations/:occurrenceId")
  @RequirePermission("schedule:read")
  listAllocations(@Actor() actor: RequestActor, @Param("occurrenceId") occurrenceId: string) {
    return this.repository.listOccurrenceEquipmentAllocations(
      toScope(actor),
      z.string().uuid().parse(occurrenceId)
    );
  }

  @Post("allocations/:occurrenceId/:assetId")
  @RequirePermission("schedule:manage")
  reserveAllocation(
    @Actor() actor: RequestActor,
    @Param("occurrenceId") occurrenceId: string,
    @Param("assetId") assetId: string
  ) {
    return this.repository.reserveOccurrenceEquipment(
      toScope(actor),
      z.string().uuid().parse(occurrenceId),
      z.string().uuid().parse(assetId)
    );
  }

  @Post("allocations/:allocationId/release")
  @RequirePermission("schedule:manage")
  async releaseAllocation(
    @Actor() actor: RequestActor,
    @Param("allocationId") allocationId: string
  ) {
    const result = await this.repository.releaseOccurrenceEquipment(
      toScope(actor),
      z.string().uuid().parse(allocationId)
    );
    if (!result) throw new NotFoundException("Equipment allocation not found.");
    return result;
  }
}
