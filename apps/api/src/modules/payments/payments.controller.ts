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
  CreatePaymentRequest,
  PaymentListFilters,
  ReconcilePaymentRequest,
  RefundPaymentRequest,
  RequestActor
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import { CoreService } from "../core/core.service.js";

const moneySchema = z
  .object({
    amountMinor: z.string().regex(/^\d+$/),
    currency: z.string().trim().length(3).toUpperCase()
  })
  .strict();

const createPaymentSchema = z
  .object({
    branchId: z.string().uuid(),
    memberId: z.string().uuid().nullable().optional(),
    amount: moneySchema,
    method: z.enum(["cash", "bank_transfer", "mpesa", "card", "other"]),
    reference: z.string().trim().max(255).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
    allocationType: z.enum(["membership", "booking", "walkIn", "other"]).nullable().optional(),
    allocationId: z.string().uuid().nullable().optional()
  })
  .strict();

const voidPaymentSchema = z
  .object({
    reason: z.string().trim().min(1).max(255)
  })
  .strict();

const reconcilePaymentSchema = z
  .object({
    memberId: z.string().uuid(),
    allocationType: z.enum(["membership", "booking", "walkIn", "other"]),
    allocationId: z.string().uuid().nullable().optional(),
    reason: z.string().trim().min(1).max(255)
  })
  .strict()
  .superRefine((value, context) => {
    const requiresTarget =
      value.allocationType === "membership" || value.allocationType === "booking";
    if (requiresTarget !== Boolean(value.allocationId)) {
      context.addIssue({
        code: "custom",
        path: ["allocationId"],
        message: requiresTarget
          ? "An allocation target is required."
          : "Walk-in and other allocations cannot have a target ID."
      });
    }
  });

const paymentListQuerySchema = z
  .object({
    branchId: z.string().uuid().optional(),
    memberId: z.string().uuid().optional(),
    method: z.enum(["cash", "bank_transfer", "mpesa", "card", "other"]).optional(),
    status: z.enum(["pending", "completed", "refunded", "voided"]).optional(),
    unmatched: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .passthrough();

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService
  ) {}

  @Get()
  @RequirePermission("payment:read")
  list(@Actor() actor: RequestActor, @Query() query: unknown) {
    return this.core.listPayments(
      actor,
      paymentListQuerySchema.parse(query) satisfies PaymentListFilters
    );
  }

  @Post()
  @RequirePermission("payment:record")
  create(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown
  ) {
    const input = createPaymentSchema.parse(body) satisfies CreatePaymentRequest;
    return this.idempotency.execute({
      actor,
      operation: "payment:create",
      key,
      body: input,
      status: 201,
      action: () => this.core.createPayment(actor, requestId, input)
    });
  }

  @Get(":paymentId")
  @RequirePermission("payment:read")
  get(@Actor() actor: RequestActor, @Param("paymentId") paymentId: string) {
    return this.core.getPayment(actor, z.string().uuid().parse(paymentId));
  }

  @Post(":paymentId/void")
  @HttpCode(200)
  @RequirePermission("payment:refund")
  void(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("paymentId") paymentId: string,
    @Body() body: unknown
  ) {
    const parsed = voidPaymentSchema.parse(body || {});
    return this.core.voidPayment(
      actor,
      requestId,
      z.string().uuid().parse(paymentId),
      parsed.reason
    );
  }

  @Post(":paymentId/reconcile")
  @HttpCode(200)
  @RequirePermission("payment:match")
  reconcile(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Param("paymentId") paymentId: string,
    @Body() body: unknown
  ) {
    const id = z.string().uuid().parse(paymentId);
    const input = reconcilePaymentSchema.parse(body) satisfies ReconcilePaymentRequest;
    return this.idempotency.execute({
      actor,
      operation: `payment:reconcile:${id}`,
      key,
      body: input,
      status: 200,
      action: () => this.core.reconcilePayment(actor, requestId, id, input)
    });
  }

  @Post(":paymentId/refund")
  @HttpCode(200)
  @RequirePermission("payment:refund")
  refund(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Param("paymentId") paymentId: string,
    @Body() body: unknown
  ) {
    const id = z.string().uuid().parse(paymentId);
    const input = voidPaymentSchema.parse(body) satisfies RefundPaymentRequest;
    return this.idempotency.execute({
      actor,
      operation: `payment:refund:${id}`,
      key,
      body: input,
      status: 200,
      action: () => this.core.refundPayment(actor, requestId, id, input.reason)
    });
  }
}
