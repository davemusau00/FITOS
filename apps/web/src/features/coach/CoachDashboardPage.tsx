import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatCard } from "@fitos/ui";
import { useAuth } from "../../app/auth";
import { useBranch } from "../../app/branch-context";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

export function CoachDashboardPage() {
  const { auth } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const services = useQuery({
    queryKey: ["services", activeBranchId, "coach"],
    queryFn: () => api.servicesByBranch(activeBranchId),
    enabled: Boolean(activeBranchId)
  });
  const schedule = useQuery({
    queryKey: ["coach-aggregate", activeBranchId, auth?.user.id],
    queryFn: () => api.coachAggregate(activeBranchId),
    enabled: Boolean(activeBranchId && auth?.user.id)
  });
  if (schedule.isLoading) return <PageLoading />;
  const sessions = schedule.data?.sessions ?? [];
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
          label="Next action"
          value={sessions.length ? "Open roster" : "No session"}
          detail={sessions.length ? "Review arrival status and notes" : "Nothing assigned today"}
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
