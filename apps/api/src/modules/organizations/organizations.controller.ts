import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import { CoreService } from "../core/core.service.js";
import type { RequestActor, UpdateOrganizationRequest } from "@fitos/contracts";

const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    timezone: z.string().trim().min(3).max(80).optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).optional()
  })
  .strict();

@ApiTags("organization")
@Controller("organization")
export class OrganizationsController {
  constructor(private readonly core: CoreService) {}

  @Get()
  @RequirePermission("tenant:read")
  get(@Actor() actor: RequestActor) {
    return this.core.getOrganization(actor);
  }

  @Patch()
  @RequirePermission("tenant:settings")
  update(@Actor() actor: RequestActor, @RequestId() requestId: string, @Body() body: unknown) {
    return this.core.updateOrganization(actor, requestId, updateOrganizationSchema.parse(body) satisfies UpdateOrganizationRequest);
  }
}
