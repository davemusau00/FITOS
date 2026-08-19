import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestActor } from "@fitos/contracts";
import type { FitosRequest } from "./request-context.js";

export const Actor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestActor => {
    const request = context.switchToHttp().getRequest<FitosRequest>();
    if (!request.actor)
      throw new Error("Request actor is unavailable outside an authenticated route.");
    return request.actor;
  }
);

export const RequestId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    return context.switchToHttp().getRequest<FitosRequest>().requestId ?? "unknown";
  }
);
