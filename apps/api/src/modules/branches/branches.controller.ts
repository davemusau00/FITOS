import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { CreateBranchRequest, RequestActor, UpdateBranchRequest } from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import type { CoreService } from "../core/core.service.js";

const branchSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    slug: z.string().trim().min(2).max(100).optional(),
    timezone: z.string().trim().min(3).max(80).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
    addressLine1: z.string().trim().max(255).nullable().optional(),
    addressLine2: z.string().trim().max(255).nullable().optional(),
    city: z.string().trim().max(120).nullable().optional(),
    countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()).nullable().optional(),
    isActive: z.boolean().optional()
  })
  .strict();
const createBranchSchema = branchSchema.extend({ name: z.string().trim().min(2).max(160) });
const branchIdSchema = z.string().uuid();

@ApiTags("branches")
@Controller("branches")
export class BranchesController {
  constructor(private readonly core: CoreService) {}

  @Get()
  @RequirePermission("branch:read")
  list(@Actor() actor: RequestActor) {
    return this.core.listBranches(actor);
  }

  @Post()
  @RequirePermission("branch:create")
  create(@Actor() actor: RequestActor, @RequestId() requestId: string, @Body() body: unknown) {
    return this.core.createBranch(actor, requestId, createBranchSchema.parse(body) satisfies CreateBranchRequest);
  }

  @Get(":branchId")
  @RequirePermission("branch:read")
  get(@Actor() actor: RequestActor, @Param("branchId") branchId: string) {
    return this.core.getBranch(actor, branchIdSchema.parse(branchId));
  }

  @Patch(":branchId")
  @RequirePermission("branch:update")
  update(@Actor() actor: RequestActor, @RequestId() requestId: string, @Param("branchId") branchId: string, @Body() body: unknown) {
    return this.core.updateBranch(actor, requestId, branchIdSchema.parse(branchId), branchSchema.parse(body) satisfies UpdateBranchRequest);
  }

  @Post(":branchId/deactivate")
  @RequirePermission("branch:deactivate")
  deactivate(@Actor() actor: RequestActor, @RequestId() requestId: string, @Param("branchId") branchId: string) {
    return this.core.updateBranch(actor, requestId, branchIdSchema.parse(branchId), { isActive: false });
  }
}
