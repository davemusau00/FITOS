import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { CoachAggregateResponse, OpsAggregateResponse, RequestActor } from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

const querySchema = z.object({ branchId: z.string().uuid().optional() }).passthrough();

@ApiTags("insights")
@Controller("insights")
export class InsightsController {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  @Get("overview")
  @RequirePermission("attendance:read")
  overview(@Actor() actor: RequestActor, @Query() query: unknown) {
    const { branchId } = querySchema.parse(query);
    const scope = {
      tenantId: actor.tenantId,
      tenantUserId: actor.tenantUserId,
      userId: actor.userId,
      branchIds: actor.branchIds
    };
    return this.repository.getInsightsOverview(scope, branchId);
  }

  @Get("/today")
  @RequirePermission("tenant:read")
  today(@Actor() actor: RequestActor, @Query() query: unknown) {
    const { branchId } = querySchema.extend({ branchId: z.string().uuid() }).parse(query);
    return this.repository.getTodayOverview(
      {
        tenantId: actor.tenantId,
        tenantUserId: actor.tenantUserId,
        userId: actor.userId,
        branchIds: actor.branchIds
      },
      branchId
    );
  }

  @Get("/ops/aggregate")
  @RequirePermission("tenant:read")
  async opsAggregate(
    @Actor() actor: RequestActor,
    @Query() query: unknown
  ): Promise<OpsAggregateResponse> {
    const { branchId } = querySchema.extend({ branchId: z.string().uuid() }).parse(query);
    const scope = {
      tenantId: actor.tenantId,
      tenantUserId: actor.tenantUserId,
      userId: actor.userId,
      branchIds: actor.branchIds
    };
    const [overview, sessions] = await Promise.all([
      this.repository.getTodayOverview(scope, branchId),
      this.repository.listScheduleOccurrences(scope, {
        branchId,
        startsAfter: new Date().toISOString(),
        endsBefore: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
        limit: 100
      })
    ]);
    return { overview, sessions: sessions.data };
  }

  @Get("/coach/aggregate")
  @RequirePermission("schedule:read")
  async coachAggregate(
    @Actor() actor: RequestActor,
    @Query() query: unknown
  ): Promise<CoachAggregateResponse> {
    const { branchId } = querySchema.extend({ branchId: z.string().uuid() }).parse(query);
    const scope = {
      tenantId: actor.tenantId,
      tenantUserId: actor.tenantUserId,
      userId: actor.userId,
      branchIds: actor.branchIds
    };
    const [overview, sessions] = await Promise.all([
      this.repository.getTodayOverview(scope, branchId),
      this.repository.listScheduleOccurrences(scope, {
        branchId,
        trainerUserId: actor.userId,
        startsAfter: new Date().toISOString(),
        endsBefore: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
        limit: 100
      })
    ]);
    return { overview, sessions: sessions.data };
  }
}
