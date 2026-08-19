import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { ApiErrorResponse } from "@fitos/contracts";
import type { Response } from "express";
import { ZodError } from "zod";
import { DomainError, validationError } from "./domain-error.js";
import type { FitosRequest } from "../request-context/request-context.js";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<FitosRequest>();
    const requestId = request.requestId ?? "unknown";
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = new DomainError("UNEXPECTED_ERROR", "An unexpected error occurred.", status);

    if (exception instanceof ZodError) {
      error = validationError(
        exception.issues.reduce<Record<string, string[]>>((fields, issue) => {
          const key = issue.path.join(".") || "request";
          fields[key] = [...(fields[key] ?? []), issue.message];
          return fields;
        }, {})
      );
      status = error.status;
    } else if (exception instanceof DomainError) {
      error = exception;
      status = exception.status;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      error = new DomainError(
        status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "UNEXPECTED_ERROR",
        typeof exception.getResponse() === "string" ? exception.getResponse() : "Request failed.",
        status
      );
    } else if (exception instanceof Error) {
      process.stderr.write(JSON.stringify({ event: "api.unhandled_error", requestId, message: exception.message }) + "\n");
    }

    const body: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.fields ? { fields: error.fields } : {}),
        ...(error.details ? { details: error.details } : {})
      }
    };
    response.status(status).setHeader("X-Request-Id", requestId).json(body);
  }
}
