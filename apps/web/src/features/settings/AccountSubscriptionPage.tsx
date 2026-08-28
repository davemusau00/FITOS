import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Badge,
  Card,
  PageHeader,
  ProgressBar,
  StatCard,
  StatusBadge,
  WorkspacePage
} from "@fitos/ui";
import type {
  FeatureFlagResponse,
  TenantSubscriptionResponse,
  UsageQuotaMetricsResponse,
  PlanChangeRequestResponse,
  AccountCancellationRequestResponse,
  AccountDeletionRequestResponse
} from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatDate } from "../shared";

export default function AccountSubscriptionPage() {
  const [sub, setSub] = useState<TenantSubscriptionResponse | null>(null);
  const [usage, setUsage] = useState<UsageQuotaMetricsResponse | null>(null);
  const [flags, setFlags] = useState<FeatureFlagResponse[]>([]);
  const [planRequests, setPlanRequests] = useState<PlanChangeRequestResponse[]>([]);
  const [requestedPlan, setRequestedPlan] = useState<"starter" | "pro" | "business">("starter");
  const [requestingPlan, setRequestingPlan] = useState(false);
  const [requestError, setRequestError] = useState<unknown>(null);
  const [cancellationRequests, setCancellationRequests] = useState<
    AccountCancellationRequestResponse[]
  >([]);
  const [deletionRequests, setDeletionRequests] = useState<AccountDeletionRequestResponse[]>([]);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [lifecycleSubmitting, setLifecycleSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loadAccountPlan = useCallback(() => {
    setLoading(true);
    setError(null);
    void Promise.all([
      api.tenantSubscription(),
      api.tenantUsageQuotas(),
      api.featureFlags(),
      api.planChangeRequests(),
      api.cancellationRequests(),
      api.deletionRequests()
    ])
      .then(([subscription, quotas, featureFlags, requests, cancellations, deletions]) => {
        setSub(subscription);
        setRequestedPlan(subscription.plan);
        setUsage(quotas);
        setFlags(featureFlags);
        setPlanRequests(requests);
        setCancellationRequests(cancellations);
        setDeletionRequests(deletions);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    loadAccountPlan();
  }, [loadAccountPlan]);
  const byCategory = useMemo(
    () =>
      flags.reduce<Record<string, FeatureFlagResponse[]>>((groups, flag) => {
        (groups[flag.category] ??= []).push(flag);
        return groups;
      }, {}),
    [flags]
  );
  const submitPlanChange = useCallback(() => {
    setRequestingPlan(true);
    setRequestError(null);
    void api
      .requestPlanChange(requestedPlan)
      .then((request) => setPlanRequests((current) => [request, ...current]))
      .catch(setRequestError)
      .finally(() => setRequestingPlan(false));
  }, [requestedPlan]);
  if (loading) return <PageLoading />;
  const daysLeft = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;
  const lifecycleMessage: Record<
    string,
    { tone: "info" | "warning" | "danger"; title: string; body: string }
  > = {
    trial: {
      tone: "info",
      title: "Trial workspace",
      body: "Core setup remains available while you evaluate FITOS. Request a plan review before the trial ends."
    },
    active: {
      tone: "info",
      title: "Workspace active",
      body: "Your team can continue using the enabled capabilities shown below."
    },
    grace: {
      tone: "warning",
      title: "Grace period",
      body: "Some access may be limited soon. Contact FITOS to agree the next workspace state."
    },
    suspended: {
      tone: "danger",
      title: "Workspace suspended",
      body: "Operational access may be restricted. Contact FITOS to request recovery; tenant data is preserved."
    },
    cancelled: {
      tone: "warning",
      title: "Workspace cancelled",
      body: "Access is being wound down while tenant data is preserved. Contact FITOS if this was unexpected."
    },
    archived: {
      tone: "warning",
      title: "Workspace archived",
      body: "This workspace is no longer operational. Contact FITOS about an approved recovery path."
    }
  };
  const lifecycle = sub ? lifecycleMessage[sub.status] : undefined;
  return (
    <WorkspacePage density="record">
      <PageHeader
        eyebrow="Account"
        title="Plan & capabilities"
        description="Understand your current operating scope, measured usage, and the capabilities available to this workspace."
        actions={
          <Link className="fitos-button fitos-button--secondary" to="/contact">
            Talk to FITOS
          </Link>
        }
      />
      <ErrorNotice error={error} onRetry={loadAccountPlan} />
      <ErrorNotice error={requestError} onRetry={submitPlanChange} />
      {sub ? (
        <>
          <div className="account-plan-grid">
            <Card className="account-plan-card">
              <div className="account-plan-card__heading">
                <div>
                  <p className="fitos-page-header__eyebrow">Current plan</p>
                  <h2>{sub.planName}</h2>
                </div>
                <StatusBadge status={sub.status} />
              </div>
              {daysLeft !== null ? (
                <StatCard
                  icon="calendar"
                  label="Trial remaining"
                  value={`${daysLeft} days`}
                  detail={`Ends ${formatDate(sub.trialEndsAt)}`}
                  tone={daysLeft < 4 ? "warning" : "info"}
                />
              ) : (
                <p className="muted">This workspace is outside its trial period.</p>
              )}
              <Alert tone="info" title="Plan changes are handled by FITOS">
                There is no checkout or payment collection in this release. Submit an implementation
                or plan request and the Platform team will review it.
              </Alert>
              {lifecycle ? (
                <Alert tone={lifecycle.tone} title={lifecycle.title}>
                  {lifecycle.body}
                </Alert>
              ) : null}
              <div className="account-plan-card__actions">
                <select
                  className="fitos-select"
                  aria-label="Requested plan"
                  value={requestedPlan}
                  onChange={(event) => setRequestedPlan(event.target.value as typeof requestedPlan)}
                  disabled={requestingPlan}
                >
                  <option value="starter">FITOS Starter</option>
                  <option value="pro">FITOS Pro</option>
                  <option value="business">FITOS Business</option>
                </select>
                <button
                  className="fitos-button fitos-button--primary"
                  disabled={requestingPlan || requestedPlan === sub.plan}
                  onClick={submitPlanChange}
                >
                  {requestingPlan ? "Submitting…" : "Request a plan change"}
                </button>
                <Link className="fitos-button fitos-button--secondary" to="/pricing">
                  Compare plans
                </Link>
              </div>
              {planRequests.length ? (
                <div className="account-plan-requests">
                  <strong>Recent plan requests</strong>
                  {planRequests.slice(0, 3).map((request) => (
                    <div key={request.id} className="account-plan-request">
                      <span>FITOS {request.requestedPlan}</span>
                      <StatusBadge status={request.status} />
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
            <Card>
              <div className="section-header-row">
                <div>
                  <p className="fitos-page-header__eyebrow">Workspace lifecycle</p>
                  <h2>Need to change or close this workspace?</h2>
                </div>
              </div>
              <p className="muted">
                Cancellation and deletion requests are handled by the FITOS team in this release.
                Your data remains preserved while a request is reviewed.
              </p>
              <div className="account-plan-card__actions">
                <button
                  className="fitos-button fitos-button--secondary"
                  disabled={
                    lifecycleSubmitting ||
                    cancellationRequests.some(
                      (item) => item.status === "requested" || item.status === "reviewing"
                    )
                  }
                  onClick={() => {
                    setLifecycleSubmitting(true);
                    setRequestError(null);
                    void api
                      .requestCancellation()
                      .then((request) =>
                        setCancellationRequests((current) => [request, ...current])
                      )
                      .catch(setRequestError)
                      .finally(() => setLifecycleSubmitting(false));
                  }}
                >
                  Request cancellation
                </button>
                <input
                  className="fitos-input"
                  aria-label="Deletion confirmation"
                  placeholder="Type DELETE WORKSPACE"
                  value={deletionConfirmation}
                  onChange={(event) => setDeletionConfirmation(event.target.value)}
                  disabled={lifecycleSubmitting}
                />
                <button
                  className="fitos-button fitos-button--ghost"
                  disabled={
                    lifecycleSubmitting ||
                    deletionConfirmation !== "DELETE WORKSPACE" ||
                    deletionRequests.some(
                      (item) => item.status === "requested" || item.status === "reviewing"
                    )
                  }
                  onClick={() => {
                    setLifecycleSubmitting(true);
                    setRequestError(null);
                    void api
                      .requestDeletion()
                      .then((request) => {
                        setDeletionRequests((current) => [request, ...current]);
                        setDeletionConfirmation("");
                      })
                      .catch(setRequestError)
                      .finally(() => setLifecycleSubmitting(false));
                  }}
                >
                  Request deletion
                </button>
              </div>
              {cancellationRequests.length || deletionRequests.length ? (
                <p className="muted">
                  Latest lifecycle request:{" "}
                  {cancellationRequests[0]?.status ?? deletionRequests[0]?.status}.
                </p>
              ) : null}
            </Card>
            {usage ? (
              <Card>
                <div className="section-header-row">
                  <div>
                    <p className="fitos-page-header__eyebrow">Capacity</p>
                    <h2>Usage quotas</h2>
                  </div>
                </div>
                <div className="account-usage-grid">
                  <ProgressBar
                    label="Active members"
                    value={usage.activeMembers}
                    max={usage.maxMembers}
                  />
                  <ProgressBar
                    label="Staff accounts"
                    value={usage.activeStaff}
                    max={usage.maxStaff}
                  />
                  <ProgressBar label="Branches" value={usage.branches} max={usage.maxBranches} />
                  <ProgressBar
                    label="Automation runs this month"
                    value={usage.automationRunsThisMonth}
                    max={usage.maxAutomationRuns}
                  />
                </div>
                {usage.storageUsedMb === null ? (
                  <p className="muted">Storage is not measured by an authoritative provider yet.</p>
                ) : (
                  <ProgressBar
                    label="Storage (MB)"
                    value={usage.storageUsedMb}
                    max={usage.maxStorageMb}
                  />
                )}
              </Card>
            ) : null}
          </div>
          <Card>
            <div className="section-header-row">
              <div>
                <p className="fitos-page-header__eyebrow">Capability access</p>
                <h2>What this workspace can use</h2>
              </div>
              <span className="muted">{flags.filter((flag) => flag.enabled).length} enabled</span>
            </div>
            <div className="account-capability-grid">
              {Object.entries(byCategory).map(([category, items]) => (
                <section key={category}>
                  <h3>{category.replace(/^./, (letter) => letter.toUpperCase())}</h3>
                  {items.map((flag) => (
                    <div
                      className={`account-capability ${flag.enabled ? "is-enabled" : "is-locked"}`}
                      key={flag.key}
                    >
                      <div>
                        <strong>{flag.name}</strong>
                        <p>{flag.description}</p>
                      </div>
                      <Badge tone={flag.enabled ? "success" : "neutral"}>
                        {flag.enabled ? "Enabled" : "Request access"}
                      </Badge>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Alert tone="warning">
          Plan information is currently unavailable. Try again or contact FITOS support.
        </Alert>
      )}
    </WorkspacePage>
  );
}
