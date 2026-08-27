import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatusBadge } from "@fitos/ui";
import { PLATFORM_FEATURE_REGISTRY } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function PlatformTenantDetailPage() {
  const { tenantId = "" } = useParams();
  const tenant = useQuery({
    queryKey: ["platform-tenant", tenantId],
    queryFn: () => api.platformTenant(tenantId),
    enabled: Boolean(tenantId)
  });

  if (tenant.isLoading) return <PageLoading />;
  if (tenant.error || !tenant.data) {
    return <ErrorNotice error={tenant.error ?? new Error("Tenant control record not found.")} />;
  }
  const { tenant: record, subscription, usage } = tenant.data;
  return (
    <>
      <PageHeader
        title={record.name}
        description={`${record.slug} · ${record.timezone} · ${record.currency}`}
        actions={
          <Link className="fitos-button fitos-button--secondary" to="/platform/tenants">
            Back to tenants
          </Link>
        }
      />
      <div className="card-grid">
        <Card>
          <h3>Lifecycle</h3>
          <StatusBadge status={subscription.status} />
          <p className="muted">Trial ends: {subscription.trialEndsAt ?? "Not applicable"}</p>
          <p className="muted">
            Current period ends: {subscription.currentPeriodEndsAt ?? "Not set"}
          </p>
        </Card>
        <Card>
          <h3>Plan</h3>
          <p>{subscription.planName}</p>
          <p className="muted">{subscription.plan}</p>
        </Card>
        <Card>
          <h3>Usage</h3>
          <p>
            {usage.activeMembers} / {usage.maxMembers} active members
          </p>
          <p>
            {usage.activeStaff} / {usage.maxStaff} staff
          </p>
          <p>
            {usage.branches} / {usage.maxBranches} branches
          </p>
          <p>
            {usage.automationRunsThisMonth} / {usage.maxAutomationRuns} automation runs this month
          </p>
          <p className="muted">
            Storage:{" "}
            {usage.storageUsedMb == null
              ? "Not measured"
              : `${usage.storageUsedMb} / ${usage.maxStorageMb} MB`}
          </p>
        </Card>
        <Card>
          <h3>Feature access</h3>
          {subscription.capabilities.length ? (
            <ul>
              {subscription.capabilities.map((capability) => (
                <li key={capability}>
                  {PLATFORM_FEATURE_REGISTRY.find((feature) => feature.key === capability)?.name ??
                    capability}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No optional capabilities enabled.</p>
          )}
        </Card>
      </div>
    </>
  );
}
