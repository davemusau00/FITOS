import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  ActivateMembershipRequest,
  CreateMembershipPlanRequest,
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

const createPlanSchema = z
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
    price: moneySchema.nullable().optional(),
    durationDays: z.coerce.number().int().min(1).max(3_650).nullable().optional(),
    includedCredits: z.coerce.number().int().min(0).max(10_000),
    publicVisible: z.boolean().optional()
  })
  .strict();

const updatePlanSchema = createPlanSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();

const activateMembershipSchema = z
  .object({
    planId: z.string().uuid(),
    startsAt: z.string().datetime().optional()
  })
  .strict();

const cancelMembershipSchema = z
  .object({
    reason: z.string().trim().max(255).optional()
  })
  .strict();

const planListQuerySchema = z.object({ branchId: z.string().uuid().optional() }).passthrough();

@ApiTags("memberships")
@Controller()
export class MembershipsController {
  constructor(
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService
  ) {}

  @Get("membership-plans")
  @RequirePermission("membership:read")
  listPlans(@Actor() actor: RequestActor, @Query() query: unknown) {
    return this.core.listMembershipPlans(actor, planListQuerySchema.parse(query).branchId);
  }

  @Post("membership-plans")
  @RequirePermission("membership:manage")
  createPlan(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown
  ) {
    const input = createPlanSchema.parse(body) satisfies CreateMembershipPlanRequest;
    return this.idempotency.execute({
      actor,
      operation: "membership_plan:create",
      key,
      body: input,
      status: 201,
      action: () => this.core.createMembershipPlan(actor, requestId, input)
    });
  }

  @Get("membership-plans/:planId")
  @RequirePermission("membership:read")
  getPlan(@Actor() actor: RequestActor, @Param("planId") planId: string) {
    return this.core.getMembershipPlan(actor, z.string().uuid().parse(planId));
  }

  @Patch("membership-plans/:planId")
  @RequirePermission("membership:manage")
  updatePlan(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("planId") planId: string,
    @Body() body: unknown
  ) {
    return this.core.updateMembershipPlan(
      actor,
      requestId,
      z.string().uuid().parse(planId),
      updatePlanSchema.parse(body)
    );
  }

  @Get("members/:memberId/memberships")
  @RequirePermission("membership:read")
  listMemberMemberships(@Actor() actor: RequestActor, @Param("memberId") memberId: string) {
    return this.core.listMemberMemberships(actor, z.string().uuid().parse(memberId));
  }

  @Post("members/:memberId/memberships")
  @RequirePermission("membership:manage")
  activateMembership(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Param("memberId") memberId: string,
    @Body() body: unknown
  ) {
    const parsed = activateMembershipSchema.parse(body);
    const input: ActivateMembershipRequest = {
      memberId: z.string().uuid().parse(memberId),
      planId: parsed.planId,
      startsAt: parsed.startsAt
    };
    return this.idempotency.execute({
      actor,
      operation: "membership:activate",
      key,
      body: input,
      status: 201,
      action: () => this.core.activateMembership(actor, requestId, input)
    });
  }

  @Post("members/:memberId/memberships/:membershipId/cancel")
  @RequirePermission("membership:manage")
  cancelMembership(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("memberId") _memberId: string,
    @Param("membershipId") membershipId: string,
    @Body() body: unknown
  ) {
    const parsed = cancelMembershipSchema.parse(body || {});
    return this.core.cancelMembership(
      actor,
      requestId,
      z.string().uuid().parse(membershipId),
      parsed.reason
    );
  }

  @Get("members/:memberId/credits")
  @RequirePermission("membership:read")
  listCredits(@Actor() actor: RequestActor, @Param("memberId") memberId: string) {
    return this.core.listCreditLedger(actor, z.string().uuid().parse(memberId));
  }

  @Get("members/:memberId/credits/balance")
  @RequirePermission("membership:read")
  getCreditBalance(@Actor() actor: RequestActor, @Param("memberId") memberId: string) {
    return this.core.getCreditBalance(actor, z.string().uuid().parse(memberId));
  }
}
