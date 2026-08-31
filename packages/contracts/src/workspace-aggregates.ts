import type { ScheduleOccurrenceResponse } from "./services.js";
import type { TodayOverviewResponse } from "./today.js";

export interface OpsAggregateResponse {
  overview: TodayOverviewResponse;
  sessions: ScheduleOccurrenceResponse[];
  signals: {
    staffCoverage: {
      assignedSessions: number;
      unassignedSessions: number;
    };
    capacityPressure: {
      constrainedSessions: number;
      alertedSessions: number;
    };
    resourceConflicts: number;
    actionQueue: Array<{
      id: string;
      type:
        | "no_show"
        | "waitlist"
        | "follow_up"
        | "unassigned_staff"
        | "resource_conflict"
        | "capacity_alert";
      label: string;
      count: number;
      href: string;
    }>;
  };
}

export interface CoachAggregateResponse {
  overview: TodayOverviewResponse;
  sessions: ScheduleOccurrenceResponse[];
  signals: {
    confirmedBookings: number;
    waitlistedBookings: number;
    checkedIn: number;
    attended: number;
    pendingAttendance: number;
  };
}
