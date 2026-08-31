import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, PageHeader, StatusBadge, WorkspacePage } from "@fitos/ui";
import type { FeatureFlagScope } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function PlatformFeatureFlagsPage() {
  const client = useQueryClient();
  const features = useQuery({ queryKey: ["platform", "features"], queryFn: api.platformFeatures });
  const overrides = useQuery({
    queryKey: ["platform", "feature-flag-overrides"],
    queryFn: api.platformFeatureFlagOverrides
  });
  const [key, setKey] = useState("");
  const [scope, setScope] = useState<FeatureFlagScope>("global");
  const [scopeValue, setScopeValue] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api.createPlatformFeatureFlagOverride({
        key: key as import("@fitos/contracts").SaaSCapabilityKey,
        scope,
        scopeValue: scope === "global" ? null : scopeValue,
        enabled,
        reason,
        actorUserId: null,
        previousEnabled: null,
        effectiveFrom: null,
        effectiveUntil: null
      }),
    onSuccess: () => {
      setReason("");
      void client.invalidateQueries({ queryKey: ["platform", "feature-flag-overrides"] });
    }
  });
  if (features.isLoading || overrides.isLoading) return <PageLoading />;
  return (
    <WorkspacePage density="operational">
      <PageHeader
        eyebrow="Control plane"
        title="Feature flags"
        description="Apply scoped, reasoned capability overrides with effective history."
      />
      <ErrorNotice
        error={features.error ?? overrides.error}
        onRetry={() => {
          void features.refetch();
          void overrides.refetch();
        }}
      />
      <Card>
        <form
          className="fitos-form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            if (key && reason.trim().length >= 3 && (scope === "global" || scopeValue.trim()))
              mutation.mutate();
          }}
        >
          <label className="fitos-field">
            <span>Feature</span>
            <select
              className="fitos-control"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              required
            >
              <option value="">Select a feature</option>
              {(features.data ?? []).map((feature) => (
                <option key={feature.key} value={feature.key}>
                  {feature.name} ({feature.maturity})
                </option>
              ))}
            </select>
          </label>
          <label className="fitos-field">
            <span>Scope</span>
            <select
              className="fitos-control"
              value={scope}
              onChange={(event) => setScope(event.target.value as FeatureFlagScope)}
            >
              {(["global", "plan", "tenant", "pilot"] as const).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          {scope !== "global" ? (
            <label className="fitos-field">
              <span>Scope value</span>
              <input
                className="fitos-control"
                value={scopeValue}
                onChange={(event) => setScopeValue(event.target.value)}
                placeholder={scope === "plan" ? "starter" : "Identifier"}
                required
              />
            </label>
          ) : null}
          <label className="fitos-check-row">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />{" "}
            Enable feature
          </label>
          <label className="fitos-field">
            <span>Reason</span>
            <input
              className="fitos-control"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={3}
              required
            />
          </label>
          <button
            className="fitos-button fitos-button--primary"
            disabled={mutation.isPending}
            type="submit"
          >
            Save override
          </button>
        </form>
        <ErrorNotice error={mutation.error} onRetry={() => mutation.reset()} />
      </Card>
      <Card>
        <h2>Override history</h2>
        {overrides.data?.length ? (
          overrides.data.map((item) => (
            <div className="fitos-mobile-data-card" key={item.id}>
              <strong>
                {item.key} · {item.scope}
                {item.scopeValue ? `:${item.scopeValue}` : ""}
              </strong>
              <span>
                {item.reason} · {new Date(item.createdAt).toLocaleString()}
              </span>
              <StatusBadge status={item.enabled ? "enabled" : "disabled"} />
            </div>
          ))
        ) : (
          <p className="muted">No feature overrides recorded.</p>
        )}
      </Card>
    </WorkspacePage>
  );
}
