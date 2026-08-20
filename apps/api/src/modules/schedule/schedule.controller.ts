import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  CreateScheduleOccurrenceRequest,
  RequestActor,
  ScheduleOccurrenceFilters
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import { CoreService } from "../core/core.service.js";

const occurrenceSchema = z
  .object({
    branchId: z.string().uuid(),
    serviceId: z.string().uuid(),
    trainerUserId: z.string().uuid().nullable().optional(),
    roomId: z.string().uuid().nullable().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    capacity: z.coerce.number().int().min(1).max(10_000)
  })
  .strict();
const cancellationSchema = z.object({ reason: z.string().trim().min(1).max(255) }).strict();
const listSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    trainerUserId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
    startsAfter: z.string().datetime().optional(),
    endsBefore: z.string().datetime().optional(),
    status: z.enum(["scheduled", "cancelled"]).optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .passthrough();

@ApiTags("schedule")
@Controller("schedule/occurrences")
export class ScheduleController {
  constructor(
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService
  ) {}

  @Get()
  @RequirePermission("schedule:read")
  list(@Actor() actor: RequestActor, @Query() query: unknown) {
    return this.core.listScheduleOccurrences(
      actor,
      listSchema.parse(query) satisfies ScheduleOccurrenceFilters
    );
  }

  @Post()
  @RequirePermission("schedule:manage")
  create(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown
  ) {
    const input = occurrenceSchema.parse(body) satisfies CreateScheduleOccurrenceRequest;
    return this.idempotency.execute({
      actor,
      operation: "schedule:occurrence:create",
      key,
      body: input,
      status: 201,
      action: () => this.core.createScheduleOccurrence(actor, requestId, input)
    });
  }

  @Get(":occurrenceId")
  @RequirePermission("schedule:read")
  get(@Actor() actor: RequestActor, @Param("occurrenceId") occurrenceId: string) {
    return this.core.getScheduleOccurrence(actor, z.string().uuid().parse(occurrenceId));
  }

  @Post(":occurrenceId/cancel")
  @RequirePermission("schedule:manage")
  cancel(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("occurrenceId") occurrenceId: string,
    @Body() body: unknown
  ) {
    return this.core.cancelScheduleOccurrence(
      actor,
      requestId,
      z.string().uuid().parse(occurrenceId),
      cancellationSchema.parse(body).reason
    );
  }
}
