import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, PageHeader } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function PlatformAuditPage() {
  const query = useQuery({ queryKey: ["platform-audit"], queryFn: api.platformAudit });
  if (query.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader
        title="Platform audit"
        description="Audited control-plane changes without customer records."
      />
      <ErrorNotice error={query.error} />
      {!query.data?.length ? (
        <EmptyState
          title="No platform activity yet"
          description="Tenant control-plane changes will appear here."
        />
      ) : (
        <div className="card-grid">
          {query.data.map((event) => (
            <Card key={event.id}>
              <strong>{event.action}</strong>
              <p className="muted">
                {event.resourceType} · {event.resourceId ?? "—"}
              </p>
              <p className="muted">{new Date(event.createdAt).toLocaleString("en-KE")}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
