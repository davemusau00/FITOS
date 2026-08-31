import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  WorkspacePage
} from "@fitos/ui";
import type { PlatformNoticeScope } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, useToast } from "../shared";

const scopes: PlatformNoticeScope[] = ["global", "plan", "tenant"];

export function PlatformNoticesPage() {
  const cache = useQueryClient();
  const toast = useToast();
  const [scope, setScope] = useState<PlatformNoticeScope>("global");
  const [scopeValue, setScopeValue] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(true);
  const notices = useQuery({
    queryKey: ["platform", "notices"],
    queryFn: api.platformSystemNotices
  });
  const create = useMutation({
    mutationFn: () =>
      api.createPlatformSystemNotice({
        scope,
        scopeValue: scope === "global" ? null : scopeValue.trim(),
        title: title.trim(),
        body: body.trim(),
        startsAt: new Date(startsAt).toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        requiresAcknowledgement
      }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      setScopeValue("");
      setStartsAt("");
      setExpiresAt("");
      void cache.invalidateQueries({ queryKey: ["platform", "notices"] });
      void cache.invalidateQueries({ queryKey: ["platform", "audit"] });
      toast.success("System notice scheduled.");
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "Unable to schedule system notice.")
  });
  if (notices.isLoading) return <PageLoading />;
  return (
    <WorkspacePage density="operational">
      <PageHeader
        eyebrow="Platform control plane"
        title="System notices"
        description="Publish scoped, scheduled notices without exposing private tenant records."
      />
      <ErrorNotice error={notices.error} onRetry={() => void notices.refetch()} />
      <div className="platform-detail-grid">
        <Card>
          <h2>Schedule a notice</h2>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!startsAt || title.trim().length < 3 || body.trim().length < 3) return;
              create.mutate();
            }}
          >
            <FormField htmlFor="notice-scope" label="Audience">
              <Select
                id="notice-scope"
                value={scope}
                onChange={(event) => setScope(event.target.value as PlatformNoticeScope)}
              >
                {scopes.map((value) => (
                  <option key={value} value={value}>
                    {value === "global" ? "All workspaces" : value === "plan" ? "Plan" : "Tenant"}
                  </option>
                ))}
              </Select>
            </FormField>
            {scope !== "global" ? (
              <FormField
                htmlFor="notice-scope-value"
                label={scope === "plan" ? "Plan key" : "Tenant ID"}
                hint={
                  scope === "plan"
                    ? "starter, pro, or business"
                    : "Use the tenant control record ID."
                }
              >
                <Input
                  id="notice-scope-value"
                  required
                  value={scopeValue}
                  onChange={(event) => setScopeValue(event.target.value)}
                />
              </FormField>
            ) : null}
            <FormField htmlFor="notice-title" label="Title">
              <Input
                id="notice-title"
                required
                minLength={3}
                maxLength={180}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="notice-body" label="Message">
              <textarea
                id="notice-body"
                className="fitos-control"
                required
                rows={5}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </FormField>
            <div className="form-grid-2">
              <FormField htmlFor="notice-starts-at" label="Starts">
                <Input
                  id="notice-starts-at"
                  required
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </FormField>
              <FormField htmlFor="notice-expires-at" label="Expires (optional)">
                <Input
                  id="notice-expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </FormField>
            </div>
            <label className="fitos-checkbox-label">
              <input
                type="checkbox"
                checked={requiresAcknowledgement}
                onChange={(event) => setRequiresAcknowledgement(event.target.checked)}
              />
              Require staff acknowledgement
            </label>
            <Button type="submit" loading={create.isPending} disabled={!startsAt}>
              Schedule notice
            </Button>
          </form>
        </Card>
        <Card>
          <h2>Notice history</h2>
          {notices.data?.length ? (
            notices.data.map((notice) => (
              <div className="fitos-mobile-data-card" key={notice.id}>
                <strong>{notice.title}</strong>
                <span>{notice.body}</span>
                <small>
                  {notice.scope} · starts {new Date(notice.startsAt).toLocaleString()}
                  {notice.expiresAt
                    ? " · expires " + new Date(notice.expiresAt).toLocaleString()
                    : ""}
                </small>
                {notice.requiresAcknowledgement ? <StatusBadge status="ack required" /> : null}
              </div>
            ))
          ) : (
            <EmptyState
              icon="warning"
              title="No notices scheduled"
              description="Publish a scoped notice when customers need a clear operational update."
            />
          )}
        </Card>
      </div>
    </WorkspacePage>
  );
}
