import { Controller, Get, Inject, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { HealthResponse } from "@fitos/contracts";
import type { Response } from "express";
import { Public } from "../../common/auth/public.decorator.js";
import { RequestId } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  private readonly release = process.env.FITOS_RELEASE_TAG ?? "development";

  @Get("live")
  live(@RequestId() requestId: string): HealthResponse {
    return { status: "ok", requestId, release: this.release };
  }

  @Get("ready")
  async ready(
    @RequestId() requestId: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<HealthResponse> {
    const ready = await this.repository.ping();
    if (!ready) response.status(503);
    return { status: ready ? "ok" : "degraded", requestId, release: this.release };
  }
}
