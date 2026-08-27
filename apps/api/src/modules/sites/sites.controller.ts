import { Body, Controller, Get, Inject, NotFoundException, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { RequestActor, SaveSitePageRequest } from "@fitos/contracts";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

const pageSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    title: z.string().trim().min(1).max(160),
    sections: z
      .array(
        z
          .object({ type: z.enum(["hero", "rich_text", "cta", "service_grid", "schedule"]) })
          .passthrough()
      )
      .max(100),
    seo: z.record(z.unknown()).optional()
  })
  .strict();
const scope = (actor: RequestActor) => ({
  tenantId: actor.tenantId,
  tenantUserId: actor.tenantUserId,
  userId: actor.userId,
  branchIds: actor.branchIds
});

@ApiTags("sites")
@Controller("sites")
export class SitesController {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}
  @Get("pages") @RequirePermission("tenant:read") list(@Actor() actor: RequestActor) {
    return this.repository.listSitePages(scope(actor));
  }
  @Post("pages") @RequirePermission("tenant:settings") save(
    @Actor() actor: RequestActor,
    @Body() body: unknown
  ) {
    return this.repository.saveSitePage(
      scope(actor),
      pageSchema.parse(body) as SaveSitePageRequest
    );
  }
  @Post("pages/:pageId/publish") @RequirePermission("tenant:settings") async publish(
    @Actor() actor: RequestActor,
    @Param("pageId") pageId: string
  ) {
    const page = await this.repository.publishSitePage(
      scope(actor),
      z.string().uuid().parse(pageId)
    );
    if (!page) throw new NotFoundException("Site page not found.");
    return page;
  }
}
