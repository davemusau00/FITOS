import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, PageHeader, StatusBadge, WorkspacePage } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function NotificationInboxPage() {
  const [category, setCategory] = useState<"all" | import("@fitos/contracts").NotificationCategory>(
    "all"
  );
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["notifications", "inbox"], queryFn: api.notificationInbox });
  const read = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => void client.invalidateQueries({ queryKey: ["notifications", "inbox"] })
  });
  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const filtered = useMemo(
    () =>
      category === "all"
        ? notifications
        : notifications.filter((item) => item.category === category),
    [category, notifications]
  );
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
      <div className="fitos-filter-row" role="group" aria-label="Notification categories">
        {(["all", "booking", "operations", "crm", "system"] as const).map((value) => (
          <button
            className={`fitos-button ${category === value ? "fitos-button--primary" : "fitos-button--secondary"}`}
            key={value}
            onClick={() => setCategory(value)}
            type="button"
          >
            {value === "all" ? `All (${unreadCount} unread)` : value}
          </button>
        ))}
      </div>
      <Card>
        {filtered.length ? (
          filtered.map((item) => (
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
          <p className="muted">
            {notifications.length
              ? "No notifications match this category."
              : "You have no notifications yet."}
          </p>
        )}
      </Card>
    </WorkspacePage>
  );
}
