import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  CreateScheduleOccurrenceRequest,
  CreateScheduleTemplateRequest,
  MaterializeScheduleTemplateRequest,
  OverrideScheduleOccurrenceRequest,
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
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const templateSchema = z
  .object({
    branchId: z.string().uuid(),
    serviceId: z.string().uuid(),
    trainerUserId: z.string().uuid().nullable().optional(),
    roomId: z.string().uuid().nullable().optional(),
    timezone: z.string().trim().min(1).max(80),
    daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
    localStartTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    durationMinutes: z.coerce.number().int().min(1).max(1_440),
    capacity: z.coerce.number().int().min(1).max(10_000),
    effectiveStartDate: localDateSchema,
    effectiveEndDate: localDateSchema.nullable().optional(),
    materializeThroughDate: localDateSchema.optional()
  })
  .strict()
  .transform((value) => ({ ...value, daysOfWeek: [...new Set(value.daysOfWeek)].sort() }));
const materializeSchema = z.object({ throughDate: localDateSchema }).strict();
const overrideSchema = z
  .object({
    trainerUserId: z.string().uuid().nullable().optional(),
    roomId: z.string().uuid().nullable().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    capacity: z.coerce.number().int().min(1).max(10_000).optional(),
    reason: z.string().trim().min(1).max(255)
  })
  .strict()
  .refine((value) => (value.startsAt === undefined) === (value.endsAt === undefined), {
    message: "startsAt and endsAt must be supplied together."
  })
  .refine(
    (value) =>
      value.trainerUserId !== undefined ||
      value.roomId !== undefined ||
      value.startsAt !== undefined ||
      value.capacity !== undefined,
    { message: "At least one schedule field must change." }
  );
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

  @Post(":occurrenceId/override")
  @HttpCode(200)
  @RequirePermission("schedule:manage")
  override(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Param("occurrenceId") occurrenceId: string,
    @Body() body: unknown
  ) {
    const id = z.string().uuid().parse(occurrenceId);
    const input = overrideSchema.parse(body) satisfies OverrideScheduleOccurrenceRequest;
    return this.idempotency.execute({
      actor,
      operation: `schedule:occurrence:${id}:override`,
      key,
      body: input,
      status: 200,
      action: () => this.core.overrideScheduleOccurrence(actor, requestId, id, input)
    });
  }
}

@ApiTags("schedule")
@Controller("schedule/templates")
export class ScheduleTemplatesController {
  constructor(
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService
  ) {}

  @Get()
  @RequirePermission("schedule:read")
  list(@Actor() actor: RequestActor, @Query("branchId") branchId?: string) {
    return this.core.listScheduleTemplates(
      actor,
      branchId ? z.string().uuid().parse(branchId) : undefined
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
    const input = templateSchema.parse(body) satisfies CreateScheduleTemplateRequest;
    return this.idempotency.execute({
      actor,
      operation: "schedule:template:create",
      key,
      body: input,
      status: 201,
      action: () => this.core.createScheduleTemplate(actor, requestId, input)
    });
  }

  @Get(":templateId")
  @RequirePermission("schedule:read")
  get(@Actor() actor: RequestActor, @Param("templateId") templateId: string) {
    return this.core.getScheduleTemplate(actor, z.string().uuid().parse(templateId));
  }

  @Post(":templateId/materialize")
  @HttpCode(200)
  @RequirePermission("schedule:manage")
  materialize(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Param("templateId") templateId: string,
    @Body() body: unknown
  ) {
    const id = z.string().uuid().parse(templateId);
    const input = materializeSchema.parse(body) satisfies MaterializeScheduleTemplateRequest;
    return this.idempotency.execute({
      actor,
      operation: `schedule:template:${id}:materialize`,
      key,
      body: input,
      status: 200,
      action: () => this.core.materializeScheduleTemplate(actor, requestId, id, input)
    });
  }
}
