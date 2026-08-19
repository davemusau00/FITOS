import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import type { FitosRequest } from "../request-context/request-context.js";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FitosRequest>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const startedAt = performance.now();
    return next.handle().pipe(
      tap({
        next: () => {
          process.stdout.write(
            JSON.stringify({
              event: "http.request",
              requestId: request.requestId,
              method: request.method,
              path: request.originalUrl,
              statusCode: response.statusCode,
              durationMs: Math.round(performance.now() - startedAt),
              tenantId: request.actor?.tenantId,
              userId: request.actor?.userId
            }) + "\n"
          );
        }
      })
    );
  }
}
