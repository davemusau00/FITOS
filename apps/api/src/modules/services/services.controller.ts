import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  CreateRoomRequest,
  CreateServiceRequest,
  RequestActor,
  UpdateRoomRequest,
  UpdateServiceRequest
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import { CoreService } from "../core/core.service.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

const serviceTypes = ["class", "appointment", "facility", "access"] as const;
const moneySchema = z
  .object({
    amountMinor: z.string().regex(/^\d+$/),
    currency: z.string().trim().length(3).toUpperCase()
  })
  .strict();
const createServiceSchema = z
  .object({
    branchId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(160),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    serviceType: z.enum(serviceTypes),
    durationMinutes: z.coerce.number().int().min(1).max(1_440),
    defaultCapacity: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
    creditsRequired: z.coerce.number().int().min(0).max(1_000).optional(),
    cancellationCutoffMinutes: z.coerce.number().int().min(0).max(525_600).optional(),
    restoreCreditOnLateCancel: z.boolean().optional(),
    bookingWindowHours: z.coerce.number().int().min(0).max(8_760).nullable().optional(),
    price: moneySchema.nullable().optional(),
    publicVisible: z.boolean().optional()
  })
  .strict();
const updateServiceSchema = createServiceSchema
  .pick({
    name: true,
    slug: true,
    durationMinutes: true,
    defaultCapacity: true,
    creditsRequired: true,
    cancellationCutoffMinutes: true,
    restoreCreditOnLateCancel: true,
    bookingWindowHours: true,
    price: true,
    publicVisible: true
  })
  .extend({ isActive: z.boolean().optional() })
  .partial()
  .strict();
const createRoomSchema = z
  .object({
    branchId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    capacity: z.coerce.number().int().min(1).max(10_000).nullable().optional()
  })
  .strict();
const roomListSchema = z.object({ branchId: z.string().uuid().optional() }).passthrough();
const updateRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    capacity: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
    isActive: z.boolean().optional()
  })
  .strict();
const equipmentRequirementsSchema = z
  .object({
    requirements: z
      .array(
        z.object({ poolId: z.string().uuid(), quantityRequired: z.number().int().min(1).max(1000) })
      )
      .max(30)
  })
  .strict();

@ApiTags("services")
@Controller()
export class ServicesController {
  constructor(
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository
  ) {}

  @Get("services")
  @RequirePermission("service:read")
  listServices(@Actor() actor: RequestActor) {
    return this.core.listServices(actor);
  }

  @Post("services")
  @RequirePermission("service:manage")
  createService(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown
  ) {
    const input = createServiceSchema.parse(body) satisfies CreateServiceRequest;
    return this.idempotency.execute({
      actor,
      operation: "service:create",
      key,
      body: input,
      status: 201,
      action: () => this.core.createService(actor, requestId, input)
    });
  }

  @Get("services/:serviceId")
  @RequirePermission("service:read")
  getService(@Actor() actor: RequestActor, @Param("serviceId") serviceId: string) {
    return this.core.getService(actor, z.string().uuid().parse(serviceId));
  }

  @Get("services/:serviceId/equipment-requirements")
  @RequirePermission("service:read")
  listEquipmentRequirements(@Actor() actor: RequestActor, @Param("serviceId") serviceId: string) {
    return this.repository.listServiceEquipmentRequirements(
      {
        tenantId: actor.tenantId,
        tenantUserId: actor.tenantUserId,
        userId: actor.userId,
        branchIds: actor.branchIds
      },
      z.string().uuid().parse(serviceId)
    );
  }

  @Post("services/:serviceId/equipment-requirements")
  @RequirePermission("service:manage")
  replaceEquipmentRequirements(
    @Actor() actor: RequestActor,
    @Param("serviceId") serviceId: string,
    @Body() body: unknown
  ) {
    const input = equipmentRequirementsSchema.parse(body);
    return this.repository.replaceServiceEquipmentRequirements(
      {
        tenantId: actor.tenantId,
        tenantUserId: actor.tenantUserId,
        userId: actor.userId,
        branchIds: actor.branchIds
      },
      z.string().uuid().parse(serviceId),
      input.requirements
    );
  }

  @Patch("services/:serviceId")
  @RequirePermission("service:manage")
  updateService(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("serviceId") serviceId: string,
    @Body() body: unknown
  ) {
    return this.core.updateService(
      actor,
      requestId,
      z.string().uuid().parse(serviceId),
      updateServiceSchema.parse(body) satisfies UpdateServiceRequest
    );
  }

  @Get("rooms")
  @RequirePermission("service:read")
  listRooms(@Actor() actor: RequestActor, @Query() query: unknown) {
    return this.core.listRooms(actor, roomListSchema.parse(query).branchId);
  }

  @Post("rooms")
  @RequirePermission("service:manage")
  createRoom(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown
  ) {
    const input = createRoomSchema.parse(body) satisfies CreateRoomRequest;
    return this.idempotency.execute({
      actor,
      operation: "room:create",
      key,
      body: input,
      status: 201,
      action: () => this.core.createRoom(actor, requestId, input)
    });
  }

  @Get("rooms/:roomId")
  @RequirePermission("service:read")
  getRoom(@Actor() actor: RequestActor, @Param("roomId") roomId: string) {
    return this.core.getRoom(actor, z.string().uuid().parse(roomId));
  }

  @Patch("rooms/:roomId")
  @RequirePermission("service:manage")
  updateRoom(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("roomId") roomId: string,
    @Body() body: unknown
  ) {
    return this.core.updateRoom(
      actor,
      requestId,
      z.string().uuid().parse(roomId),
      updateRoomSchema.parse(body) satisfies UpdateRoomRequest
    );
  }
}
