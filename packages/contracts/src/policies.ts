import type { AttendanceRecordResponse } from "./attendance.js";
import type { MemberMembershipResponse } from "./memberships.js";

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
