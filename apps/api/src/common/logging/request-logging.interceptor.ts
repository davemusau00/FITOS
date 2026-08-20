import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import type { Observable } from "rxjs";
import { finalize, tap } from "rxjs";
import type { FitosRequest } from "../request-context/request-context.js";
import { MetricsService } from "../metrics/metrics.service.js";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(@Inject(MetricsService) private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FitosRequest>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const startedAt = performance.now();
    let failure: unknown;
    return next.handle().pipe(
      tap({
        error: (error) => {
          failure = error;
        }
      }),
      finalize(() => {
        const durationMs = Math.round(performance.now() - startedAt);
        const statusCode = failure ? errorStatus(failure) : response.statusCode;
        const newlyRecorded = this.metrics.recordRequestOnce(request, {
          method: request.method,
          path: request.originalUrl,
          statusCode,
          durationMs
        });
        if (newlyRecorded && process.env.NODE_ENV !== "test") {
          process.stdout.write(
            JSON.stringify({
              event: "http.request",
              requestId: request.requestId,
              method: request.method,
              path: request.originalUrl,
              statusCode,
              durationMs,
              tenantId: request.actor?.tenantId,
              userId: request.actor?.userId,
              outcome: statusCode >= 500 ? "error" : statusCode >= 400 ? "rejected" : "success"
            }) + "\n"
          );
        }
      })
    );
  }
}

function errorStatus(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "getStatus" in error &&
    typeof error.getStatus === "function"
  ) {
    return Number(error.getStatus());
  }
  return 500;
}
