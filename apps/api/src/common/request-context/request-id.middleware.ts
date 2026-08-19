import { randomUUID } from "node:crypto";
import type { NextFunction, Response } from "express";
import type { FitosRequest } from "./request-context.js";

export function requestIdMiddleware(
  request: FitosRequest,
  response: Response,
  next: NextFunction
): void {
  const inbound = request.header("x-request-id");
  request.requestId = inbound && /^[a-zA-Z0-9._-]{8,120}$/.test(inbound) ? inbound : randomUUID();
  response.setHeader("X-Request-Id", request.requestId);
  next();
}
