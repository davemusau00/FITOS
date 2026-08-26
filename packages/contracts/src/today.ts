export interface TodayOverviewResponse {
  branchId: string;
  date: string;
  members: { active: number; joinedToday: number };
  bookings: { today: number; confirmed: number; cancelled: number; waitlisted: number };
  attendance: { checkedInToday: number; expectedToday: number; noShows: number };
  schedule: {
    sessionsToday: number;
    nextSession: { id: string; name: string; startsAt: string } | null;
  };
  leads: { newToday: number; followUpsDue: number };
}
