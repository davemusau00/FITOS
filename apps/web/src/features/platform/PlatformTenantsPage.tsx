import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatusBadge } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function PlatformTenantsPage() {
  const tenants = useQuery({ queryKey: ["platform-tenants"], queryFn: api.platformTenants });
  if (tenants.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader
        title="Tenants"
        description="Control-plane health and usage without customer records."
      />
      <ErrorNotice error={tenants.error} />
      <div className="card-grid">
        {(tenants.data ?? []).map(({ tenant, subscription, usage }) => (
          <Card key={tenant.id}>
            <h3>{tenant.name}</h3>
            <p className="muted">
              {tenant.slug} · {tenant.timezone}
            </p>
            <StatusBadge status={subscription.status} />
            <p>{subscription.planName}</p>
            <p className="muted">
              {usage.activeMembers} active members · {usage.branches} branches · {usage.activeStaff}{" "}
              staff
            </p>
          </Card>
        ))}
        {!tenants.data?.length && (
          <Card>
            <p>No tenants found.</p>
          </Card>
        )}
      </div>
    </>
  );
}
