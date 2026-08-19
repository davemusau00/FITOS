import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  CreateMemberRequest,
  MemberListFilters,
  RequestActor,
  UpdateMemberRequest
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import type { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import type { CoreService } from "../core/core.service.js";

const memberStatuses = ["active", "inactive", "suspended", "archived"] as const;
const contactSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().max(120).nullable().optional(),
    phone: z.string().trim().max(60).nullable().optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
    dateOfBirth: z.string().date().nullable().optional()
  })
  .strict();
const updateContactSchema = contactSchema.partial();
const createMemberSchema = z
  .object({ contact: contactSchema, homeBranchId: z.string().uuid() })
  .strict();
const updateMemberSchema = z
  .object({
    contact: updateContactSchema.optional(),
    homeBranchId: z.string().uuid().nullable().optional(),
    status: z.enum(memberStatuses).optional()
  })
  .strict();
const listQuerySchema = z
  .object({
    query: z.string().trim().max(160).optional(),
    status: z.enum(memberStatuses).optional(),
    branchId: z.string().uuid().optional(),
    membershipStatus: z.string().trim().max(30).optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .passthrough();
const uuid = z.string().uuid();

@ApiTags("members")
@Controller("members")
export class MembersController {
  constructor(
    private readonly core: CoreService,
    private readonly idempotency: IdempotencyService
  ) {}

  @Get()
  @RequirePermission("member:read")
  list(@Actor() actor: RequestActor, @Query() query: unknown) {
    return this.core.listMembers(actor, listQuerySchema.parse(query) satisfies MemberListFilters);
  }

  @Post()
  @RequirePermission("member:create")
  create(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: unknown
  ) {
    const input = createMemberSchema.parse(body) satisfies CreateMemberRequest;
    return this.idempotency.execute({
      actor,
      operation: "member:create",
      key: idempotencyKey,
      body: input,
      status: 201,
      action: () => this.core.createMember(actor, requestId, input)
    });
  }

  @Get(":memberId")
  @RequirePermission("member:read")
  get(@Actor() actor: RequestActor, @Param("memberId") memberId: string) {
    return this.core.getMember(actor, uuid.parse(memberId));
  }

  @Patch(":memberId")
  @RequirePermission("member:update")
  update(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown
  ) {
    return this.core.updateMember(
      actor,
      requestId,
      uuid.parse(memberId),
      updateMemberSchema.parse(body) satisfies UpdateMemberRequest
    );
  }

  @Get(":memberId/timeline")
  @RequirePermission("member:read")
  timeline(@Actor() actor: RequestActor, @Param("memberId") memberId: string) {
    return this.core.memberTimeline(actor, uuid.parse(memberId));
  }
}
