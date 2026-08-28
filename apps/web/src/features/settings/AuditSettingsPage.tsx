import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function AuditSettingsPage() {
  const events = useQuery({ queryKey: ["audit-events"], queryFn: api.auditEvents });
  if (events.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader
        title="Activity & audit"
        description="Important changes recorded for this organization."
      />
      <ErrorNotice error={events.error} onRetry={() => void events.refetch()} />
      {(events.data ?? []).length ? (
        <div className="form-stack">
          {events.data?.map((event) => (
            <Card key={event.id}>
              <strong>{event.action}</strong>
              <p className="muted">
                {event.resourceType}
                {event.resourceId ? ` · ${event.resourceId}` : ""}
              </p>
              <p className="muted">{new Date(event.createdAt).toLocaleString()}</p>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <p>No audited activity yet.</p>
        </Card>
      )}
    </>
  );
}
