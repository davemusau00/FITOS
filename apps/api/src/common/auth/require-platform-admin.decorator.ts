import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PLATFORM_ADMIN = "fitos:require-platform-admin";

/**
 * Marks an endpoint as requiring FITOS platform-admin identity.
 * The PlatformAdminGuard validates the X-Platform-Token header against
 * the users.is_platform_admin flag — completely separate from tenant sessions.
 */
export const RequirePlatformAdmin = () => SetMetadata(REQUIRE_PLATFORM_ADMIN, true);
