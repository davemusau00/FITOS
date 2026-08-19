import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "@fitos/contracts";

export const REQUIRED_PERMISSIONS = "fitos:required-permissions";
export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
