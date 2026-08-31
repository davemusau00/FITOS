import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { BookingListFilters, CreateBookingRequest, RequestActor } from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import { CoreService } from "../core/core.service.js";

const createSchema = z
  .object({
    occurrenceId: z.string().uuid(),
    memberId: z.string().uuid(),
    source: z.enum(["staff", "public", "member_portal"]).optional(),
    overrideReason: z.string().trim().min(1).max(255).optional()
  })
  .strict();
const cancellationSchema = z.object({ reason: z.string().trim().min(1).max(255) }).strict();
const listSchema = z
  .object({
    occurrenceId: z.string().uuid().optional(),
    memberId: z.string().uuid().optional(),
    status: z.enum(["confirmed", "waitlisted", "cancelled"]).optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .passthrough();

@ApiTags("bookings")
@Controller("bookings")
export class BookingsController {
  constructor(
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService
  ) {}

  @Get()
  @RequirePermission("booking:read")
  list(@Actor() actor: RequestActor, @Query() query: unknown) {
    return this.core.listBookings(actor, listSchema.parse(query) satisfies BookingListFilters);
  }

  @Post()
  @RequirePermission("booking:create")
  create(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown
  ) {
    const input = createSchema.parse(body) satisfies CreateBookingRequest;
    return this.idempotency.execute({
      actor,
      operation: "booking:create",
      key,
      body: input,
      status: 201,
      action: () => this.core.createBooking(actor, requestId, input)
    });
  }

  @Get(":bookingId")
  @RequirePermission("booking:read")
  get(@Actor() actor: RequestActor, @Param("bookingId") bookingId: string) {
    return this.core.getBooking(actor, z.string().uuid().parse(bookingId));
  }

  @Post(":bookingId/cancel")
  @RequirePermission("booking:cancel")
  cancel(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("bookingId") bookingId: string,
    @Body() body: unknown
  ) {
    return this.core.cancelBooking(
      actor,
      requestId,
      z.string().uuid().parse(bookingId),
      cancellationSchema.parse(body).reason
    );
  }
}
