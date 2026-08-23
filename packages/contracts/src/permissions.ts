export const PERMISSION_KEYS = [
  "tenant:read",
  "tenant:settings",
  "branch:read",
  "branch:create",
  "branch:update",
  "branch:deactivate",
  "member:read",
  "member:create",
  "member:update",
  "member:deactivate",
  "member:export",
  "lead:read",
  "lead:create",
  "lead:update",
  "lead:assign",
  "lead:convert",
  "lead:export",
  "staff:read",
  "staff:manage",
  "role:manage",
  "service:read",
  "service:manage",
  "schedule:read",
  "schedule:manage",
  "booking:read",
  "booking:create",
  "booking:update",
  "booking:cancel",
  "booking:override",
  "membership:read",
  "membership:manage",
  "membership:override",
  "attendance:read",
  "attendance:checkin",
  "attendance:override",
  "payment:read",
  "payment:record",
  "payment:match",
  "payment:refund",
  "payment:export",
  "report:operations",
  "report:finance",
  "report:export",
  "audit:read",
  "assessment:read",
  "assessment:write",
  "assessment:export"
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/**
 * Platform-level permission keys live in a completely separate namespace from
 * tenant permissions. They are only meaningful when checking `isPlatformAdmin`
 * on the user record combined with the X-Platform-Token header.
 */
export const PLATFORM_PERMISSION_KEYS = [
  "platform:inquiries:read",
  "platform:inquiries:manage",
  "platform:tenant:read",
  "platform:tenant:create"
] as const;
export type PlatformPermissionKey = (typeof PLATFORM_PERMISSION_KEYS)[number];


export const ROLE_KEYS = ["owner", "manager", "reception", "trainer", "finance"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  owner: PERMISSION_KEYS,
  manager: PERMISSION_KEYS.filter(
    (permission) =>
      permission !== "role:manage" &&
      permission !== "payment:refund" &&
      permission !== "tenant:settings"
  ),
  reception: [
    "branch:read",
    "member:read",
    "member:create",
    "member:update",
    "booking:read",
    "booking:create",
    "booking:update",
    "booking:cancel",
    "membership:read",
    "attendance:read",
    "attendance:checkin",
    "payment:read",
    "payment:record",
    "schedule:read"
  ],
  trainer: ["branch:read", "member:read", "schedule:read", "attendance:read"],
  finance: [
    "branch:read",
    "payment:read",
    "payment:record",
    "payment:match",
    "payment:refund",
    "payment:export",
    "report:finance",
    "report:export"
  ]
};
