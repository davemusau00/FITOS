import { Body, Controller, Get, Headers, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  InviteStaffRequest,
  RequestActor,
  SaaSPlan,
  UpdateUserProfileRequest
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { CoreService } from "../core/core.service.js";

const inviteSchema = z
  .object({
    email: z.string().trim().email().max(255),
    displayName: z.string().trim().min(1).max(160).optional(),
    roleId: z.string().uuid(),
    branchIds: z.array(z.string().uuid()).min(1).max(100)
  })
  .strict();
const accessSchema = z
  .object({
    roleId: z.string().uuid().optional(),
    roleIds: z.array(z.string().uuid()).min(1).max(20).optional(),
    branchIds: z.array(z.string().uuid()).min(1).max(100)
  })
  .strict()
  .refine((value) => Boolean(value.roleId || value.roleIds?.length), {
    message: "At least one role is required.",
    path: ["roleIds"]
  });
const uuid = z.string().uuid();
const profileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160),
    phone: z.string().trim().max(40).nullable().optional()
  })
  .strict();
const planChangeSchema = z
  .object({ requestedPlan: z.enum(["starter", "pro", "business"]) })
  .strict();

@ApiTags("staff access")
@Controller("users")
export class UsersController {
  constructor(
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService
  ) {}

  @Get()
  @RequirePermission("staff:read")
  list(@Actor() actor: RequestActor) {
    return this.core.listStaff(actor);
  }

  @Get("roles")
  @RequirePermission("staff:read")
  listRoles(@Actor() actor: RequestActor) {
    return this.core.listRoles(actor);
  }

  @Patch("me/profile")
  updateProfile(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Body() body: unknown
  ) {
    return this.core.updateUserProfile(
      actor,
      requestId,
      profileSchema.parse(body) as UpdateUserProfileRequest
    );
  }

  @Get("me/notifications")
  getNotificationPreferences(@Actor() actor: RequestActor) {
    return this.core.notificationPreferences(actor);
  }

  @Patch("me/notifications")
  updateNotificationPreferences(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Body() body: unknown
  ) {
    return this.core.updateNotificationPreferences(
      actor,
      requestId,
      z
        .object({
          email: z.boolean(),
          sms: z.boolean(),
          bookingReminders: z.boolean(),
          operationalAlerts: z.boolean(),
          leadFollowUps: z.boolean()
        })
        .strict()
        .parse(body)
    );
  }

  @Get("me/export-requests")
  @RequirePermission("tenant:read")
  listExportRequests(@Actor() actor: RequestActor) {
    return this.core.listAccountExportRequests(actor);
  }

  @Post("me/export-requests")
  @RequirePermission("tenant:settings")
  requestExport(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined
  ) {
    return this.idempotency.execute({
      actor,
      operation: "account:export-request",
      key: idempotencyKey,
      body: {},
      status: 201,
      action: () => this.core.createAccountExportRequest(actor, requestId)
    });
  }

  @Get("me/plan-change-requests")
  @RequirePermission("tenant:read")
  listPlanChangeRequests(@Actor() actor: RequestActor) {
    return this.core.listPlanChangeRequests(actor);
  }

  @Post("me/plan-change-requests")
  @RequirePermission("tenant:settings")
  requestPlanChange(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: unknown
  ) {
    const input = planChangeSchema.parse(body) as { requestedPlan: SaaSPlan };
    return this.idempotency.execute({
      actor,
      operation: "account:plan-change-request",
      key: idempotencyKey,
      body: input,
      status: 201,
      action: () => this.core.createPlanChangeRequest(actor, requestId, input.requestedPlan)
    });
  }

  @Get("me/cancellation-requests")
  @RequirePermission("tenant:read")
  listCancellationRequests(@Actor() actor: RequestActor) {
    return this.core.listAccountCancellationRequests(actor);
  }

  @Post("me/cancellation-requests")
  @RequirePermission("tenant:settings")
  requestCancellation(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: unknown
  ) {
    const input = z
      .object({ reason: z.string().trim().max(500).optional() })
      .strict()
      .parse(body);
    return this.idempotency.execute({
      actor,
      operation: "account:cancellation-request",
      key: idempotencyKey,
      body: input,
      status: 201,
      action: () => this.core.createAccountCancellationRequest(actor, requestId, input.reason)
    });
  }

  @Post("invitations")
  @RequirePermission("staff:manage")
  invite(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: unknown
  ) {
    const input = inviteSchema.parse(body) satisfies InviteStaffRequest;
    return this.idempotency.execute({
      actor,
      operation: "staff:invite",
      key: idempotencyKey,
      body: input,
      status: 201,
      action: () =>
        this.core.inviteStaff(actor, requestId, {
          ...input,
          displayName: input.displayName ?? input.email
        })
    });
  }

  @Patch(":userId/access")
  @RequirePermission("staff:manage")
  updateAccess(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("userId") userId: string,
    @Body() body: unknown
  ) {
    const access = accessSchema.parse(body);
    return this.core.updateStaffAccess(actor, requestId, uuid.parse(userId), {
      ...access,
      roleId: access.roleId ?? access.roleIds![0]!
    });
  }

  @Post(":userId/deactivate")
  @RequirePermission("staff:manage")
  deactivate(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("userId") userId: string
  ) {
    return this.core.deactivateStaff(actor, requestId, uuid.parse(userId));
  }
}
