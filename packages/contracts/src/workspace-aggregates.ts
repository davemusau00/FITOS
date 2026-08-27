import type { ScheduleOccurrenceResponse } from "./services.js";
import type { TodayOverviewResponse } from "./today.js";

export interface OpsAggregateResponse {
  overview: TodayOverviewResponse;
  sessions: ScheduleOccurrenceResponse[];
}

export interface CoachAggregateResponse {
  overview: TodayOverviewResponse;
  sessions: ScheduleOccurrenceResponse[];
}
