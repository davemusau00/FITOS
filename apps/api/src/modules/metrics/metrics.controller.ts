import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../../common/auth/public.decorator.js";
import { MetricsService } from "../../common/metrics/metrics.service.js";

@Public()
@Controller("metrics")
export class MetricsController {
  constructor(@Inject(MetricsService) private readonly metrics: MetricsService) {}

  @Get()
  render(@Res() response: Response): void {
    response.type("text/plain; version=0.0.4; charset=utf-8").send(this.metrics.render());
  }
}
