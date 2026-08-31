import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatCard } from "@fitos/ui";
import { useAuth } from "../../app/auth";
import { useBranch } from "../../app/branch-context";
import { api } from "../../lib/api/client";
import { branchQueryKeys } from "../../lib/query-keys";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

export function CoachDashboardPage() {
  const { auth } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const services = useQuery({
    queryKey: branchQueryKeys.list("services", activeBranchId, "coach"),
    queryFn: () => api.servicesByBranch(activeBranchId),
    enabled: Boolean(activeBranchId)
  });
  const schedule = useQuery({
    queryKey: [...branchQueryKeys.list("coach-aggregate", activeBranchId), auth?.user.id ?? ""],
    queryFn: () => api.coachAggregate(activeBranchId),
    enabled: Boolean(activeBranchId && auth?.user.id)
  });
  if (schedule.isLoading) return <PageLoading />;
  const sessions = schedule.data?.sessions ?? [];
  const signals = schedule.data?.signals ?? {
    confirmedBookings: 0,
    waitlistedBookings: 0,
    checkedIn: 0,
    attended: 0,
    pendingAttendance: 0
  };
  return (
    <div className="workspace-dashboard workspace-dashboard--coach">
      <PageHeader
        eyebrow="FITOS Coach"
        title="My Day"
        description={`Your assigned sessions at ${activeBranch?.name ?? "your branch"}.`}
      />
      <ErrorNotice error={schedule.error} />
      <div className="platform-stat-grid workspace-dashboard__coach-stats">
        <StatCard
          icon="calendar"
          label="Assigned today"
          value={sessions.length}
          detail="Your sessions at this branch"
          tone={sessions.length ? "info" : "neutral"}
        />
        <StatCard
          icon="users"
          label="Confirmed roster"
          value={signals.confirmedBookings}
          detail={`${signals.checkedIn} checked in • ${signals.pendingAttendance} need attendance update`}
          tone={signals.pendingAttendance ? "warning" : "success"}
        />
        <StatCard
          icon="warning"
          label="Waitlist"
          value={signals.waitlistedBookings}
          detail={
            signals.waitlistedBookings ? "Coordinate openings with Ops" : "No waitlisted members"
          }
          tone={signals.waitlistedBookings ? "warning" : "neutral"}
        />
      </div>
      <Card>
        <h2>Today’s sessions</h2>
        {sessions.length ? (
          <div className="workspace-session-list">
            {sessions.map((session) => (
              <div className="workspace-session" key={session.id}>
                <div>
                  <strong>
                    {services.data?.find((service) => service.id === session.serviceId)?.name ??
                      "Assigned session"}
                  </strong>
                  <span>
                    {formatDateTime(session.startsAt)} – {formatDateTime(session.endsAt)}
                  </span>
                </div>
                <a
                  className="fitos-button fitos-button--secondary fitos-button--small"
                  href={`/coach/roster/${session.id}`}
                >
                  Open roster
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No sessions assigned to you for this branch.</p>
        )}
      </Card>
    </div>
  );
}
