import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PermissionKey } from "@fitos/contracts";
import { DomainError } from "../errors/domain-error.js";
import { REQUIRED_PERMISSIONS } from "./permissions.decorator.js";
import type { FitosRequest } from "../request-context/request-context.js";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required?.length) return true;
    const actor = context.switchToHttp().getRequest<FitosRequest>().actor;
    if (!actor || !required.every((permission) => actor.permissions.includes(permission))) {
      throw new DomainError("FORBIDDEN", "You do not have permission to perform this action.", 403);
    }
    return true;
  }
}
