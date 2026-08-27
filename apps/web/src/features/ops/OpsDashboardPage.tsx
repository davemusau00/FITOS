import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatusBadge } from "@fitos/ui";
import { useBranch } from "../../app/branch-context";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

export function OpsDashboardPage() {
  const { activeBranchId, activeBranch } = useBranch();
  const today = useQuery({
    queryKey: ["ops-aggregate", activeBranchId],
    queryFn: () => api.opsAggregate(activeBranchId),
    enabled: Boolean(activeBranchId)
  });
  const services = useQuery({
    queryKey: ["services", activeBranchId, "ops"],
    queryFn: () => api.servicesByBranch(activeBranchId),
    enabled: Boolean(activeBranchId)
  });

  if (today.isLoading) return <PageLoading />;
  const metrics = today.data?.overview;
  const sessions = today.data?.sessions ?? [];
  return (
    <div className="workspace-dashboard workspace-dashboard--ops">
      <PageHeader
        eyebrow="FITOS Ops"
        title={`Today at ${activeBranch?.name ?? "your branch"}`}
        description="Operational signals and exceptions for the next several hours."
      />
      <ErrorNotice error={today.error} />
      {metrics ? (
        <div className="kpi-grid">
          <Card className="kpi kpi--energy">
            <span>Sessions today</span>
            <strong>{metrics.schedule.sessionsToday}</strong>
          </Card>
          <Card className="kpi">
            <span>Expected arrivals</span>
            <strong>{metrics.attendance.expectedToday}</strong>
          </Card>
          <Card className="kpi">
            <span>Checked in</span>
            <strong>{metrics.attendance.checkedInToday}</strong>
          </Card>
          <Card className="kpi">
            <span>Follow-ups due</span>
            <strong>{metrics.leads.followUpsDue}</strong>
          </Card>
        </div>
      ) : (
        <Card>
          <p className="muted">Today’s operational metrics are unavailable.</p>
        </Card>
      )}
      <div className="workspace-dashboard__grid">
        <Card>
          <h2>Happening next</h2>
          {metrics?.schedule.nextSession ? (
            <div className="workspace-session">
              <strong>{metrics.schedule.nextSession.name}</strong>
              <span>{formatDateTime(metrics.schedule.nextSession.startsAt)}</span>
            </div>
          ) : (
            <p className="muted">No upcoming sessions.</p>
          )}
        </Card>
        <Card>
          <h2>Operational alerts</h2>
          <ul className="workspace-alerts">
            {metrics && metrics.attendance.noShows > 0 ? (
              <li>
                <StatusBadge status="warning" /> {metrics.attendance.noShows} no-shows need review
              </li>
            ) : null}
            {metrics && metrics.bookings.waitlisted > 0 ? (
              <li>
                <StatusBadge status="pending" /> {metrics.bookings.waitlisted} waitlisted booking
                {metrics.bookings.waitlisted === 1 ? "" : "s"}
              </li>
            ) : null}
            {!metrics?.attendance.noShows && !metrics?.bookings.waitlisted ? (
              <li className="muted">No active operational alerts.</li>
            ) : null}
          </ul>
        </Card>
      </div>
      <Card>
        <h2>Scheduled sessions</h2>
        {sessions.length ? (
          <div className="workspace-session-list">
            {sessions.slice(0, 8).map((session) => (
              <div className="workspace-session" key={session.id}>
                <strong>
                  {services.data?.find((service) => service.id === session.serviceId)?.name ??
                    "Scheduled session"}
                </strong>
                <span>{formatDateTime(session.startsAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No sessions returned for this branch.</p>
        )}
      </Card>
    </div>
  );
}
