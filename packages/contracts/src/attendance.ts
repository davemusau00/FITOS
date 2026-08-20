export const ATTENDANCE_STATUSES = [
  "booked",
  "checked_in",
  "attended",
  "no_show",
  "late_cancel"
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceRecordResponse {
  id: string;
  tenantId: string;
  branchId: string;
  occurrenceId: string | null;
  memberId: string;
  status: AttendanceStatus;
  checkedInAt: string | null;
  actorUserId: string;
  overrideReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInRequest {
  memberId: string;
  occurrenceId?: string | null;
  overrideReason?: string | null;
}

export interface UpdateRosterStatusRequest {
  status: AttendanceStatus;
  overrideReason?: string | null;
}

export interface AttendanceListFilters {
  branchId?: string;
  occurrenceId?: string;
  memberId?: string;
  status?: AttendanceStatus;
  cursor?: string;
  limit?: number;
}
