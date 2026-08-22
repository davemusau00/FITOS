import type { BookingResponse } from "./bookings.js";
import type { AttendanceRecordResponse } from "./attendance.js";

export interface MemberLoginRequest {
  identifier: string; // phone or email
  memberNumber?: string; // optional member # (e.g. GYM-0001) or PIN
}

export interface MemberAuthResponse {
  memberToken: string;
  member: MemberProfileResponse;
}

export interface MemberProfileResponse {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  homeBranchId: string | null;
  homeBranchName: string | null;
  memberNumber: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  status: "active" | "inactive";
  joinedAt: string | null;
  creditBalance: number;
  activePlan: {
    name: string;
    expiresAt: string | null;
    status: string;
  } | null;
}

export interface MemberPortalOverviewResponse {
  profile: MemberProfileResponse;
  upcomingBookings: Array<
    BookingResponse & {
      serviceName: string;
      trainerName: string | null;
      roomName: string | null;
      startsAt: string;
      endsAt: string;
    }
  >;
  recentAttendance: Array<
    AttendanceRecordResponse & {
      serviceName: string | null;
      startsAt: string | null;
    }
  >;
}
