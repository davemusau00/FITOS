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
