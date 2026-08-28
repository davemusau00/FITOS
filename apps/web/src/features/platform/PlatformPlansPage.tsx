import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, PageHeader, WorkspacePage } from "@fitos/ui";
import type { SaaSPlanDefinition } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

export function PlatformPlansPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["platform", "plans"], queryFn: api.platformPlans });
  const features = useQuery({ queryKey: ["platform", "features"], queryFn: api.platformFeatures });
  const [drafts, setDrafts] = useState<Record<string, SaaSPlanDefinition>>({});
  useEffect(() => {
    if (query.data) setDrafts(Object.fromEntries(query.data.map((plan) => [plan.key, plan])));
  }, [query.data]);
  const mutation = useMutation({
    mutationFn: ({ plan, reason }: { plan: SaaSPlanDefinition; reason: string }) =>
      api.updatePlatformPlan(plan.key, { ...plan, reason }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["platform", "plans"] })
  });
  if (query.isLoading) return <PageLoading />;
  return (
    <WorkspacePage density="operational">
      <PageHeader
        eyebrow="Control plane"
        title="Plans"
        description="Manage non-financial plan definitions, quotas, and stable capabilities."
      />
      <ErrorNotice error={query.error} onRetry={() => void query.refetch()} />
      <ErrorNotice error={features.error} onRetry={() => void features.refetch()} />
      <ErrorNotice error={mutation.error} onRetry={() => mutation.reset()} />
      <div className="platform-overview-grid">
        {Object.values(drafts).map((plan) => (
          <Card key={plan.key}>
            <div className="section-header-row">
              <div>
                <p className="fitos-page-header__eyebrow">Canonical key: {plan.key}</p>
                <h2>{plan.name}</h2>
              </div>
            </div>
            <label className="fitos-field">
              <span>Name</span>
              <input
                className="fitos-control"
                value={plan.name}
                onChange={(e) =>
                  setDrafts((all) => ({ ...all, [plan.key]: { ...plan, name: e.target.value } }))
                }
              />
            </label>
            <label className="fitos-field">
              <span>Description</span>
              <textarea
                className="fitos-control"
                value={plan.description}
                onChange={(e) =>
                  setDrafts((all) => ({
                    ...all,
                    [plan.key]: { ...plan, description: e.target.value }
                  }))
                }
              />
            </label>
            <div className="platform-funnel">
              {Object.entries(plan.quotas).map(([key, value]) => (
                <label key={key}>
                  <span>{key.replace("max", "Max ")}</span>
                  <input
                    className="fitos-control"
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) =>
                      setDrafts((all) => ({
                        ...all,
                        [plan.key]: {
                          ...plan,
                          quotas: { ...plan.quotas, [key]: Number(e.target.value) }
                        }
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <fieldset className="fitos-fieldset">
              <legend>Capabilities</legend>
              {(features.data ?? []).map((feature) => (
                <label className="fitos-check-row" key={feature.key}>
                  <input
                    type="checkbox"
                    checked={plan.capabilities.includes(feature.key)}
                    onChange={(event) =>
                      setDrafts((all) => ({
                        ...all,
                        [plan.key]: {
                          ...plan,
                          capabilities: event.target.checked
                            ? [...new Set([...plan.capabilities, feature.key])]
                            : plan.capabilities.filter((key) => key !== feature.key)
                        }
                      }))
                    }
                  />
                  <span>
                    {feature.name} <small>({feature.maturity})</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <button
              className="fitos-button fitos-button--primary"
              disabled={mutation.isPending}
              onClick={() => {
                const reason =
                  window.prompt("Reason for this plan change", "Reviewed by Platform")?.trim() ??
                  "";
                if (reason.length >= 3) mutation.mutate({ plan, reason });
              }}
            >
              Save plan definition
            </button>
          </Card>
        ))}
      </div>
    </WorkspacePage>
  );
}
