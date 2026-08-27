import type { AttendanceRecordResponse } from "./attendance.js";
import type { MemberMembershipResponse } from "./memberships.js";
import type { SaaSCapabilityKey, TenantAccountStatus } from "./platform.js";

export const ACTIVE_MEMBERSHIP_STATUSES = [
  "scheduled",
  "active"
] as const satisfies readonly MemberMembershipResponse["status"][];

export const ATTENDANCE_TRANSITIONS: Readonly<
  Record<AttendanceRecordResponse["status"], readonly AttendanceRecordResponse["status"][]>
> = {
  booked: ["checked_in", "no_show", "late_cancel"],
  checked_in: ["attended"],
  attended: [],
  no_show: [],
  late_cancel: []
};

export const BOOKING_ACTIVE_STATUS = "confirmed" as const;
export const BOOKING_CANCELLED_STATUS = "cancelled" as const;

/** Platform lifecycle transitions are explicit and deny-by-default. */
export const TENANT_STATUS_TRANSITIONS: Readonly<
  Record<TenantAccountStatus, readonly TenantAccountStatus[]>
> = {
  trial: ["active", "cancelled"],
  active: ["grace", "suspended", "cancelled"],
  grace: ["active", "suspended", "cancelled"],
  suspended: ["active", "cancelled"],
  cancelled: ["archived"],
  archived: []
};

export function canTransitionTenantStatus(
  from: TenantAccountStatus,
  to: TenantAccountStatus
): boolean {
  return TENANT_STATUS_TRANSITIONS[from].includes(to);
}

/** Plan entitlement, rollout flag, and lifecycle status all participate in access. */
export function canUseCapability(input: {
  capability: SaaSCapabilityKey;
  entitlements: readonly SaaSCapabilityKey[];
  enabledFlags: readonly string[];
  status: TenantAccountStatus;
}): boolean {
  return (
    input.status !== "suspended" &&
    input.status !== "cancelled" &&
    input.status !== "archived" &&
    input.entitlements.includes(input.capability) &&
    input.enabledFlags.includes(input.capability)
  );
}
