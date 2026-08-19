import { Body, Controller, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { InviteStaffRequest, RequestActor } from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import type { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import type { CoreService } from "../core/core.service.js";

const inviteSchema = z
  .object({
    email: z.string().trim().email().max(255),
    displayName: z.string().trim().min(1).max(160).optional(),
    roleId: z.string().uuid(),
    branchIds: z.array(z.string().uuid()).min(1).max(100)
  })
  .strict();
const accessSchema = z
  .object({ roleId: z.string().uuid(), branchIds: z.array(z.string().uuid()).min(1).max(100) })
  .strict();
const uuid = z.string().uuid();

@ApiTags("staff access")
@Controller("users")
export class UsersController {
  constructor(
    private readonly core: CoreService,
    private readonly idempotency: IdempotencyService
  ) {}

  @Get()
  @RequirePermission("staff:read")
  list(@Actor() actor: RequestActor) {
    return this.core.listStaff(actor);
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
    return this.core.updateStaffAccess(actor, requestId, uuid.parse(userId), access);
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
