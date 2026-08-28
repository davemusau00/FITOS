import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, PageHeader, StatusBadge, WorkspacePage } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function NotificationInboxPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["notifications", "inbox"], queryFn: api.notificationInbox });
  const read = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => void client.invalidateQueries({ queryKey: ["notifications", "inbox"] })
  });
  if (query.isLoading) return <PageLoading />;
  return (
    <WorkspacePage density="operational">
      <PageHeader
        eyebrow="Workspace"
        title="Notification inbox"
        description="Alerts and follow-ups assigned to you."
      />
      <ErrorNotice error={query.error} onRetry={() => void query.refetch()} />
      <ErrorNotice error={read.error} onRetry={() => read.reset()} />
      <Card>
        {query.data?.length ? (
          query.data.map((item) => (
            <article
              className={`fitos-mobile-data-card ${item.readAt ? "" : "is-unread"}`}
              key={item.id}
            >
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <span className="fitos-mobile-data-card__meta">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              <StatusBadge status={item.readAt ? "read" : "unread"} />
              <div className="fitos-inline-actions">
                {item.href ? (
                  <Link className="fitos-button fitos-button--secondary" to={item.href}>
                    Open
                  </Link>
                ) : null}
                {!item.readAt ? (
                  <button
                    className="fitos-button fitos-button--primary"
                    disabled={read.isPending}
                    onClick={() => read.mutate(item.id)}
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <p className="muted">You have no notifications yet.</p>
        )}
      </Card>
    </WorkspacePage>
  );
}
