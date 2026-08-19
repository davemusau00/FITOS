import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { RequestActor } from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import type { CoreService } from "../core/core.service.js";

@ApiTags("audit")
@Controller("audit-events")
export class AuditController {
  constructor(private readonly core: CoreService) {}

  @Get()
  @RequirePermission("audit:read")
  list(@Actor() actor: RequestActor) {
    return this.core.auditEvents(actor);
  }
}
