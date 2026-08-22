export interface WeeklyAttendancePoint {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  count: number;
}

export interface OccupancyHeatmapPoint {
  dayOfWeek: number; // 0..6
  hourOfDay: number; // 6..21
  occupancyPercent: number;
  sessionCount: number;
}

export interface RetentionCohortRow {
  cohortMonth: string; // e.g. "2026-03"
  initialSize: number;
  month1Retention: number; // percentage (0..100)
  month2Retention: number;
  month3Retention: number;
  month4Retention: number;
  month5Retention: number;
}

export interface AtRiskMemberItem {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  daysInactive: number;
  planName: string | null;
  creditsRemaining: number;
  lastVisitAt: string | null;
}

export interface LeadFunnelStageCount {
  stage: string;
  label: string;
  count: number;
  percentage: number;
}

export interface InsightsOverviewResponse {
  summary: {
    avgWeeklyVisits: number;
    avgWeeklyVisitsChangePct: number;
    classOccupancyRate: number;
    classOccupancyChangePct: number;
    memberRetention90d: number;
    memberRetentionChangePct: number;
    leadConversionRate: number;
    leadConversionChangePct: number;
    totalActiveMembers: number;
    totalLeadsInPipeline: number;
  };
  weeklyAttendance: WeeklyAttendancePoint[];
  occupancyHeatmap: OccupancyHeatmapPoint[];
  retentionCohorts: RetentionCohortRow[];
  atRiskMembers: AtRiskMemberItem[];
  leadFunnel: LeadFunnelStageCount[];
}
