import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatusBadge } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function PlatformOverviewPage() {
  const query = useQuery({ queryKey: ["platform-overview"], queryFn: api.platformOverview });
  if (query.isLoading) return <PageLoading />;
  const data = query.data;
  return (
    <>
      <PageHeader
        title="Platform overview"
        description="SaaS health and customer lifecycle signals."
      />
      <ErrorNotice error={query.error} />
      {data && (
        <>
          <div className="card-grid">
            <Card>
              <strong>{data.tenants.active}</strong>
              <p className="muted">Active tenants</p>
            </Card>
            <Card>
              <strong>{data.tenants.trial}</strong>
              <p className="muted">Trials</p>
            </Card>
            <Card>
              <strong>{data.activity.activeMembers}</strong>
              <p className="muted">Active members</p>
            </Card>
            <Card>
              <strong>{data.implementation.submitted}</strong>
              <p className="muted">Submitted inquiries</p>
            </Card>
          </div>
          <Card>
            <h3>Platform health</h3>
            {Object.entries(data.health).map(([key, value]) => (
              <p key={key}>
                {key} <StatusBadge status={value} />
              </p>
            ))}
          </Card>
          <Card>
            <h3>Attention</h3>
            {data.attention.length ? (
              data.attention.map((item) => <p key={item.key}>{item.label}</p>)
            ) : (
              <p className="muted">No platform attention items.</p>
            )}
          </Card>
        </>
      )}
    </>
  );
}
