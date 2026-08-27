import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, PageHeader, StatusBadge } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function PlatformTenantsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const tenants = useQuery({ queryKey: ["platform-tenants"], queryFn: api.platformTenants });
  const features = useQuery({ queryKey: ["platform-features"], queryFn: api.platformFeatures });
  const transition = useMutation({
    mutationFn: (input: {
      tenantId: string;
      status: "active" | "grace" | "suspended" | "cancelled" | "archived";
      reason: string;
    }) => api.transitionPlatformTenantStatus(input.tenantId, input.status, input.reason),
    onSuccess: () => {
      setEditing(null);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      void queryClient.invalidateQueries({ queryKey: ["platform-overview"] });
    }
  });
  const capabilities = useMutation({
    mutationFn: ({ tenantId, values }: { tenantId: string; values: string[] }) =>
      api.updatePlatformTenantCapabilities(tenantId, values),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["platform-tenants"] })
  });
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
            <button
              className="fitos-button fitos-button--secondary"
              onClick={() => setEditing(editing === tenant.id ? null : tenant.id)}
            >
              Change lifecycle status
            </button>
            {editing === tenant.id && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  transition.mutate({
                    tenantId: tenant.id,
                    status: form.get("status") as
                      "active" | "grace" | "suspended" | "cancelled" | "archived",
                    reason
                  });
                }}
              >
                <select className="fitos-control" name="status" defaultValue={subscription.status}>
                  {(["active", "grace", "suspended", "cancelled", "archived"] as const).map(
                    (status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    )
                  )}
                </select>
                <input
                  className="fitos-control"
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder="Reason for this change"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <button
                  className="fitos-button"
                  disabled={transition.isPending || reason.trim().length < 3}
                >
                  {transition.isPending ? "Saving…" : "Save status"}
                </button>
              </form>
            )}
            <ErrorNotice error={transition.error} />
            <StatusBadge status={subscription.status} />
            <p>{subscription.planName}</p>
            {features.data?.length ? (
              <details>
                <summary>Entitlements</summary>
                <div className="form-stack" style={{ marginTop: "0.75rem" }}>
                  {features.data.map((feature) => {
                    const enabled = subscription.capabilities.includes(feature.key);
                    return (
                      <label key={feature.key} className="form-field__checkbox">
                        <input
                          checked={enabled}
                          disabled={capabilities.isPending}
                          onChange={() => {
                            const next = enabled
                              ? subscription.capabilities.filter((key) => key !== feature.key)
                              : [...subscription.capabilities, feature.key];
                            capabilities.mutate({ tenantId: tenant.id, values: next });
                          }}
                          type="checkbox"
                        />
                        <span>{feature.name}</span>
                      </label>
                    );
                  })}
                </div>
              </details>
            ) : null}
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
