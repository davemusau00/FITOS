import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  CreateMemberRequest,
  CreateMemberTagRequest,
  MemberListFilters,
  RequestActor,
  UpdateMemberRequest,
  UpdateMemberTagRequest
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { CoreService } from "../core/core.service.js";

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
const createMemberTagSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    color: z.string().trim().max(30).nullable().optional()
  })
  .strict();
const updateMemberTagSchema = createMemberTagSchema.partial();
const listQuerySchema = z
  .object({
    query: z.string().trim().max(160).optional(),
    status: z.enum(memberStatuses).optional(),
    branchId: z.string().uuid().optional(),
    tagId: z.string().uuid().optional(),
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
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService
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

  @Get("tags")
  @RequirePermission("member:read")
  listTags(@Actor() actor: RequestActor) {
    return this.core.listMemberTags(actor);
  }

  @Post("tags")
  @RequirePermission("member:update")
  createTag(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: unknown
  ) {
    const input = createMemberTagSchema.parse(body) satisfies CreateMemberTagRequest;
    return this.idempotency.execute({
      actor,
      operation: "member-tag:create",
      key: idempotencyKey,
      body: input,
      status: 201,
      action: () => this.core.createMemberTag(actor, requestId, input)
    });
  }

  @Patch("tags/:tagId")
  @RequirePermission("member:update")
  updateTag(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("tagId") tagId: string,
    @Body() body: unknown
  ) {
    return this.core.updateMemberTag(
      actor,
      requestId,
      uuid.parse(tagId),
      updateMemberTagSchema.parse(body) satisfies UpdateMemberTagRequest
    );
  }

  @Delete("tags/:tagId")
  @RequirePermission("member:update")
  deleteTag(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("tagId") tagId: string
  ) {
    return this.core.deleteMemberTag(actor, requestId, uuid.parse(tagId));
  }

  @Get(":memberId/tags")
  @RequirePermission("member:read")
  listMemberTags(@Actor() actor: RequestActor, @Param("memberId") memberId: string) {
    return this.core.listMemberTagsForMember(actor, uuid.parse(memberId));
  }

  @Post(":memberId/tags/:tagId")
  @RequirePermission("member:update")
  assignTag(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("memberId") memberId: string,
    @Param("tagId") tagId: string
  ) {
    return this.core.assignMemberTag(actor, requestId, uuid.parse(memberId), uuid.parse(tagId));
  }

  @Delete(":memberId/tags/:tagId")
  @RequirePermission("member:update")
  unassignTag(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("memberId") memberId: string,
    @Param("tagId") tagId: string
  ) {
    return this.core.unassignMemberTag(actor, requestId, uuid.parse(memberId), uuid.parse(tagId));
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
