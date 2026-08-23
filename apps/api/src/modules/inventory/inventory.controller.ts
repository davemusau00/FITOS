import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  CreateInventoryItemRequest,
  CreateInventoryMovementRequest,
  CreatePurchaseOrderRequest,
  RequestActor,
  UpdateInventoryItemRequest
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

const movementTypes = [
  "purchase_in",
  "sale_out",
  "session_usage",
  "adjustment",
  "transfer",
  "waste"
] as const;

const createItemSchema = z
  .object({
    branchId: z.string().uuid(),
    sku: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(150),
    category: z.string().trim().min(1).max(100),
    unit: z.string().trim().max(30).optional(),
    unitCostMinor: z.number().int().nonnegative(),
    retailPriceMinor: z.number().int().nonnegative().optional(),
    initialStock: z.number().int().nonnegative().optional(),
    reorderPoint: z.number().int().nonnegative().optional(),
    reorderQuantity: z.number().int().positive().optional(),
    isRetail: z.boolean().optional(),
    isConsumable: z.boolean().optional()
  })
  .strict();

const updateItemSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    unit: z.string().trim().max(30).optional(),
    unitCostMinor: z.number().int().nonnegative().optional(),
    retailPriceMinor: z.number().int().nonnegative().optional(),
    reorderPoint: z.number().int().nonnegative().optional(),
    reorderQuantity: z.number().int().positive().optional(),
    isRetail: z.boolean().optional(),
    isConsumable: z.boolean().optional()
  })
  .strict();

const createMovementSchema = z
  .object({
    branchId: z.string().uuid(),
    itemId: z.string().uuid(),
    movementType: z.enum(movementTypes),
    quantity: z.number().int().refine((q) => q !== 0, "Quantity cannot be zero"),
    referenceType: z.string().trim().max(50).optional(),
    referenceId: z.string().trim().max(100).optional(),
    costMinor: z.number().int().nonnegative().optional(),
    notes: z.string().trim().max(500).optional()
  })
  .strict();

const createPOSchema = z
  .object({
    branchId: z.string().uuid(),
    supplierName: z.string().trim().min(1).max(150),
    items: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          quantity: z.number().int().positive(),
          unitCostMinor: z.number().int().nonnegative()
        })
      )
      .min(1),
    notes: z.string().trim().max(1000).optional()
  })
  .strict();
const bomSchema = z.object({ requirements: z.array(z.object({ itemId: z.string().uuid(), quantityPerSession: z.number().int().positive() })).max(100) }).strict();
const consumeSchema = z.object({ branchId: z.string().uuid(), serviceId: z.string().uuid().optional(), referenceType: z.string().trim().min(1).max(40), referenceId: z.string().uuid(), items: z.array(z.object({ itemId: z.string().uuid(), quantityPerSession: z.number().int().positive() })).min(1).max(100) }).strict();

const createLotSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    itemId: z.string().uuid(),
    lotCode: z.string().trim().max(80).optional(),
    purchaseOrderId: z.string().uuid().optional(),
    quantityReceived: z.number().positive(),
    unitCostMinor: z.number().int().nonnegative().optional(),
    expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
    notes: z.string().trim().max(500).optional()
  })
  .strict();

const createStocktakeSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    notes: z.string().trim().max(500).optional()
  })
  .strict();

const recordCountSchema = z
  .object({
    itemId: z.string().uuid(),
    countedQuantity: z.number().min(0)
  })
  .strict();


const toScope = (actor: RequestActor) => ({
  tenantId: actor.tenantId,
  tenantUserId: actor.tenantUserId,
  userId: actor.userId,
  branchIds: actor.branchIds
});

@ApiTags("inventory")
@Controller("inventory")
export class InventoryController {
  constructor(
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository
  ) {}

  @Get("items")
  @RequirePermission("tenant:read")
  listItems(@Actor() actor: RequestActor, @Query("branchId") branchId?: string) {
    return this.repository.listInventoryItems(toScope(actor), branchId);
  }

  @Get("items/:itemId")
  @RequirePermission("tenant:read")
  async getItem(@Actor() actor: RequestActor, @Param("itemId") itemId: string) {
    const item = await this.repository.findInventoryItemById(toScope(actor), itemId);
    if (!item) throw new NotFoundException("Inventory item not found.");
    return item;
  }

  @Post("items")
  @RequirePermission("tenant:settings")
  createItem(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createItemSchema.parse(body) as CreateInventoryItemRequest;
    return this.repository.createInventoryItem(toScope(actor), input);
  }

  @Patch("items/:itemId")
  @RequirePermission("tenant:settings")
  async updateItem(
    @Actor() actor: RequestActor,
    @Param("itemId") itemId: string,
    @Body() body: unknown
  ) {
    const input = updateItemSchema.parse(body) as UpdateInventoryItemRequest;
    const result = await this.repository.updateInventoryItem(toScope(actor), itemId, input);
    if (!result) throw new NotFoundException("Inventory item not found.");
    return result;
  }

  @Get("movements")
  @RequirePermission("tenant:read")
  listMovements(@Actor() actor: RequestActor, @Query("itemId") itemId?: string) {
    return this.repository.listInventoryMovements(toScope(actor), itemId);
  }

  @Post("movements")
  @RequirePermission("tenant:settings")
  createMovement(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createMovementSchema.parse(body) as CreateInventoryMovementRequest;
    return this.repository.createInventoryMovement(toScope(actor), input, actor.userId);
  }

  @Get("purchase-orders")
  @RequirePermission("tenant:read")
  listPurchaseOrders(@Actor() actor: RequestActor, @Query("branchId") branchId?: string) {
    return this.repository.listPurchaseOrders(toScope(actor), branchId);
  }

  @Post("purchase-orders")
  @RequirePermission("tenant:settings")
  createPurchaseOrder(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createPOSchema.parse(body) as CreatePurchaseOrderRequest;
    return this.repository.createPurchaseOrder(toScope(actor), input);
  }

  @Get("bom/:serviceId")
  @RequirePermission("service:read")
  listBom(@Actor() actor: RequestActor, @Param("serviceId") serviceId: string) { return this.repository.listServiceInventoryRequirements(toScope(actor), z.string().uuid().parse(serviceId)); }

  @Post("bom/:serviceId")
  @RequirePermission("service:manage")
  replaceBom(@Actor() actor: RequestActor, @Param("serviceId") serviceId: string, @Body() body: unknown) { return this.repository.replaceServiceInventoryRequirements(toScope(actor), z.string().uuid().parse(serviceId), bomSchema.parse(body).requirements); }

  @Post("consume")
  @RequirePermission("tenant:settings")
  consume(@Actor() actor: RequestActor, @Body() body: unknown) { return this.repository.consumeInventory(toScope(actor), consumeSchema.parse(body)); }

  // ─── Inventory Lots ──────────────────────────────────────────────────────────
  @Get("lots")
  @RequirePermission("tenant:read")
  listLots(@Actor() actor: RequestActor, @Query("itemId") itemId?: string) {
    return this.repository.listInventoryLots(toScope(actor), itemId);
  }

  @Post("lots")
  @RequirePermission("tenant:settings")
  createLot(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createLotSchema.parse(body);
    return this.repository.createInventoryLot(toScope(actor), input);
  }

  @Get("lots/expiring")
  @RequirePermission("tenant:read")
  listExpiringLots(@Actor() actor: RequestActor, @Query("days") days?: string) {
    const daysAhead = days ? Math.max(1, Math.min(365, parseInt(days, 10))) : 30;
    return this.repository.listExpiringInventoryLots(toScope(actor), daysAhead);
  }

  // ─── Stocktakes ──────────────────────────────────────────────────────────────
  @Get("stocktakes")
  @RequirePermission("tenant:read")
  listStocktakes(@Actor() actor: RequestActor, @Query("branchId") branchId?: string) {
    return this.repository.listStocktakes(toScope(actor), branchId);
  }

  @Post("stocktakes")
  @RequirePermission("tenant:settings")
  createStocktake(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createStocktakeSchema.parse(body);
    return this.repository.createStocktake(toScope(actor), input, actor.userId);
  }

  @Get("stocktakes/:id")
  @RequirePermission("tenant:read")
  async getStocktake(@Actor() actor: RequestActor, @Param("id") id: string) {
    const stocktake = await this.repository.getStocktake(toScope(actor), id);
    if (!stocktake) throw new NotFoundException("Stocktake not found.");
    return stocktake;
  }

  @Post("stocktakes/:id/count")
  @RequirePermission("tenant:settings")
  async recordCount(
    @Actor() actor: RequestActor,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const input = recordCountSchema.parse(body);
    return this.repository.recordStocktakeCount(toScope(actor), id, input);
  }

  @Post("stocktakes/:id/complete")
  @RequirePermission("tenant:settings")
  async completeStocktake(
    @Actor() actor: RequestActor,
    @Param("id") id: string
  ) {
    return this.repository.completeStocktake(toScope(actor), id, actor.userId);
  }
}

