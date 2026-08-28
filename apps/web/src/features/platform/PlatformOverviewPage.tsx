import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AttentionCentre, Card, PageHeader, StatCard, StatusBadge, WorkspacePage } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function PlatformOverviewPage() {
  const query = useQuery({ queryKey: ["platform", "overview"], queryFn: api.platformOverview });
  const exportRequests = useQuery({
    queryKey: ["platform", "account-export-requests"],
    queryFn: api.platformAccountExportRequests
  });
  const planRequests = useQuery({
    queryKey: ["platform", "plan-change-requests"],
    queryFn: api.platformPlanChangeRequests
  });
  if (query.isLoading) return <PageLoading />;
  const data = query.data;
  return (
    <WorkspacePage density="executive">
      <PageHeader
        eyebrow="Control plane"
        title="Platform overview"
        description="Customer lifecycle, implementation workload, and signals requiring a decision."
        actions={
          <Link className="fitos-button fitos-button--primary" to="/platform/inquiries">
            Review implementations
          </Link>
        }
      />
      <ErrorNotice error={query.error} onRetry={() => void query.refetch()} />
      {data ? (
        <>
          <div className="platform-stat-grid">
            <StatCard
              icon="building"
              label="Active tenants"
              value={data.tenants.active}
              detail={`${data.tenants.total} tenants across all lifecycle states`}
              tone="success"
            />
            <StatCard
              icon="spark"
              label="Trials"
              value={data.tenants.trial}
              detail={`${data.tenants.onboarding} still onboarding`}
              tone={data.tenants.trial ? "info" : "neutral"}
            />
            <StatCard
              icon="users"
              label="Active members"
              value={data.activity.activeMembers}
              detail="Control-plane aggregate only"
            />
            <StatCard
              icon="warning"
              label="Needs attention"
              value={data.attention.reduce((sum, item) => sum + item.count, 0)}
              detail="Lifecycle and quota signals"
              tone={data.attention.length ? "warning" : "success"}
            />
          </div>
          <div className="platform-overview-grid">
            <AttentionCentre
              empty="No tenant lifecycle or quota items currently need attention."
              items={data.attention.map((item) => ({
                id: item.key,
                title: `${item.count} ${item.label}`,
                tone: item.severity === "critical" ? "danger" : "warning",
                action: <Link to="/platform/tenants">Review tenants</Link>
              }))}
            />
            <Card>
              <div className="section-header-row">
                <div>
                  <p className="fitos-page-header__eyebrow">Implementation funnel</p>
                  <h2>Assisted setup</h2>
                </div>
                <Link to="/platform/inquiries">Open queue</Link>
              </div>
              <div className="platform-funnel">
                {Object.entries(data.implementation).map(([status, count]) => (
                  <div key={status}>
                    <span>{status.replaceAll("_", " ")}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card>
            <div className="section-header-row">
              <div>
                <p className="fitos-page-header__eyebrow">Existing signals</p>
                <h2>Platform services</h2>
              </div>
            </div>
            <div className="platform-health-grid">
              {Object.entries(data.health).map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <StatusBadge status={value} />
                </div>
              ))}
            </div>
            <p className="muted platform-health-note">
              This view reports existing service summaries only; infrastructure observability
              expansion is outside this product slice.
            </p>
          </Card>
          <Card>
            <div className="section-header-row">
              <div>
                <p className="fitos-page-header__eyebrow">Account operations</p>
                <h2>Data export requests</h2>
              </div>
            </div>
            <ErrorNotice
              error={exportRequests.error}
              onRetry={() => void exportRequests.refetch()}
            />
            {exportRequests.data?.length ? (
              exportRequests.data.slice(0, 5).map((request) => (
                <div className="fitos-mobile-data-card" key={request.id}>
                  <strong>{request.status}</strong>
                  <span className="fitos-mobile-data-card__meta">
                    Tenant {request.tenantId.slice(0, 8)} ·{" "}
                    {new Date(request.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No pending export requests.</p>
            )}
          </Card>
          <Card>
            <div className="section-header-row">
              <div>
                <p className="fitos-page-header__eyebrow">Account operations</p>
                <h2>Plan-change requests</h2>
              </div>
            </div>
            <ErrorNotice error={planRequests.error} onRetry={() => void planRequests.refetch()} />
            {planRequests.data?.length ? (
              planRequests.data.slice(0, 5).map((request) => (
                <div className="fitos-mobile-data-card" key={request.id}>
                  <strong>
                    {request.requestedPlan} · {request.status}
                  </strong>
                  <span className="fitos-mobile-data-card__meta">
                    Tenant {request.tenantId.slice(0, 8)} ·{" "}
                    {new Date(request.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No plan-change requests.</p>
            )}
          </Card>
        </>
      ) : null}
    </WorkspacePage>
  );
}
