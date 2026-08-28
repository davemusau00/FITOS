import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  AttendanceListFilters,
  CheckInRequest,
  RequestActor,
  UpdateRosterStatusRequest
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import { CoreService } from "../core/core.service.js";

const checkInSchema = z
  .object({
    branchId: z.string().uuid(),
    memberId: z.string().uuid(),
    occurrenceId: z.string().uuid().nullable().optional(),
    overrideReason: z.string().trim().min(1).max(500).nullable().optional()
  })
  .strict();

const updateRosterStatusSchema = z
  .object({
    status: z.enum(["booked", "checked_in", "attended", "no_show", "late_cancel"]),
    overrideReason: z.string().trim().min(1).max(500).nullable().optional()
  })
  .strict();

const attendanceListQuerySchema = z
  .object({
    branchId: z.string().uuid().optional(),
    occurrenceId: z.string().uuid().optional(),
    memberId: z.string().uuid().optional(),
    status: z.enum(["booked", "checked_in", "attended", "no_show", "late_cancel"]).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .passthrough();

@ApiTags("attendance")
@Controller("attendance")
export class AttendanceController {
  constructor(
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService
  ) {}

  @Get()
  @RequirePermission("attendance:read")
  list(@Actor() actor: RequestActor, @Query() query: unknown) {
    return this.core.listAttendanceRecords(
      actor,
      attendanceListQuerySchema.parse(query) satisfies AttendanceListFilters
    );
  }

  @Post("checkin")
  @RequirePermission("attendance:checkin")
  checkIn(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown
  ) {
    const parsed = checkInSchema.parse(body);
    const input: CheckInRequest = {
      memberId: parsed.memberId,
      occurrenceId: parsed.occurrenceId,
      overrideReason: parsed.overrideReason
    };
    return this.idempotency.execute({
      actor,
      operation: "attendance:checkin",
      key,
      body: parsed,
      status: 201,
      action: () => this.core.checkIn(actor, requestId, parsed.branchId, input)
    });
  }

  @Get(":recordId")
  @RequirePermission("attendance:read")
  get(@Actor() actor: RequestActor, @Param("recordId") recordId: string) {
    return this.core.getAttendanceRecord(actor, z.string().uuid().parse(recordId));
  }

  @Patch(":recordId")
  @RequirePermission("attendance:checkin")
  updateStatus(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("recordId") recordId: string,
    @Body() body: unknown
  ) {
    const input = updateRosterStatusSchema.parse(body) satisfies UpdateRosterStatusRequest;
    return this.core.updateAttendanceStatus(
      actor,
      requestId,
      z.string().uuid().parse(recordId),
      input
    );
  }
}
