import { useQuery } from "@tanstack/react-query";
import { AttentionCentre, Card, PageHeader } from "@fitos/ui";
import { Link } from "react-router-dom";
import { useBranch } from "../../app/branch-context";
import { api } from "../../lib/api/client";
import { branchQueryKeys } from "../../lib/query-keys";
import { todayDate } from "../../lib/date-context";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

export function OpsDashboardPage() {
  const { activeBranchId, activeBranch } = useBranch();
  const today = useQuery({
    queryKey: branchQueryKeys.list("ops-aggregate", activeBranchId, todayDate()),
    queryFn: () => api.opsAggregate(activeBranchId),
    enabled: Boolean(activeBranchId)
  });
  const services = useQuery({
    queryKey: branchQueryKeys.list("services", activeBranchId, "ops"),
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
        actions={
          <div className="workspace-dashboard__actions">
            <Link
              className="fitos-button fitos-button--primary fitos-button--small"
              to="/app/bookings/new"
            >
              Book member
            </Link>
            <Link
              className="fitos-button fitos-button--secondary fitos-button--small"
              to="/reception"
            >
              Open Front Desk
            </Link>
          </div>
        }
      />
      <ErrorNotice error={today.error} onRetry={() => void today.refetch()} />
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
      {today.data?.signals ? (
        <div className="workspace-dashboard__grid">
          <Card>
            <h2>Staff coverage</h2>
            <div className="workspace-session-list">
              <div className="workspace-session">
                <strong>{today.data.signals.staffCoverage.assignedSessions}</strong>
                <span>Assigned upcoming sessions</span>
              </div>
              <div className="workspace-session">
                <strong>{today.data.signals.staffCoverage.unassignedSessions}</strong>
                <span>Sessions needing coverage</span>
              </div>
            </div>
          </Card>
          <Card>
            <h2>Capacity and resources</h2>
            <div className="workspace-session-list">
              <div className="workspace-session">
                <strong>{today.data.signals.capacityPressure.constrainedSessions}</strong>
                <span>Sessions constrained by capacity</span>
              </div>
              <div className="workspace-session">
                <strong>{today.data.signals.resourceConflicts}</strong>
                <span>Resource conflicts</span>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
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
        <AttentionCentre
          items={[
            ...(metrics && metrics.attendance.noShows > 0
              ? [
                  {
                    id: "no-shows",
                    title: `${metrics.attendance.noShows} no-show${metrics.attendance.noShows === 1 ? "" : "s"} need review`,
                    tone: "warning" as const,
                    action: <Link to="/app/attendance">Review</Link>
                  }
                ]
              : []),
            ...(metrics && metrics.bookings.waitlisted > 0
              ? [
                  {
                    id: "waitlist",
                    title: `${metrics.bookings.waitlisted} waitlisted booking${metrics.bookings.waitlisted === 1 ? "" : "s"}`,
                    tone: "info" as const,
                    action: <Link to="/app/bookings">Open bookings</Link>
                  }
                ]
              : [])
          ]}
        />
      </div>
      {today.data?.signals ? (
        <Card>
          <h2>Action queue</h2>
          {today.data.signals.actionQueue.length ? (
            <div className="workspace-session-list">
              {today.data.signals.actionQueue.map((item) => (
                <div className="workspace-session" key={item.id}>
                  <strong>{item.label}</strong>
                  <span>{item.count}</span>
                  <Link to={item.href}>Review</Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No exceptions require action in the next six hours.</p>
          )}
        </Card>
      ) : null}
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
