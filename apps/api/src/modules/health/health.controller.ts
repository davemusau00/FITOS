import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { HealthResponse } from "@fitos/contracts";
import { Public } from "../../common/auth/public.decorator.js";
import { RequestId } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  @Get("live")
  live(@RequestId() requestId: string): HealthResponse {
    return { status: "ok", requestId };
  }

  @Get("ready")
  async ready(@RequestId() requestId: string): Promise<HealthResponse> {
    return { status: (await this.repository.ping()) ? "ok" : "degraded", requestId };
  }
}
