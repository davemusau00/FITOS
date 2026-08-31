import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  DetailList,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  StatusBadge,
  Tabs,
  Timeline,
  WorkspacePage
} from "@fitos/ui";
import type { SaaSCapabilityKey, TenantAccountStatus } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatDateTime, useToast } from "../shared";

const lifecycleOptions: TenantAccountStatus[] = [
  "active",
  "grace",
  "suspended",
  "cancelled",
  "archived"
];

export function PlatformTenantDetailPage() {
  const { tenantId = "" } = useParams();
  const cache = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState("summary");
  const [nextStatus, setNextStatus] = useState<TenantAccountStatus>("active");
  const [reason, setReason] = useState("");
  const [capabilityReason, setCapabilityReason] = useState("");
  const [pendingCapabilities, setPendingCapabilities] = useState<SaaSCapabilityKey[] | null>(null);
  const [supportCategory, setSupportCategory] = useState<
    "implementation" | "support" | "account" | "risk"
  >("support");
  const [supportNote, setSupportNote] = useState("");
  const [recoveryUserId, setRecoveryUserId] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [recoveryVerification, setRecoveryVerification] = useState("{}");
  const [recoveryAction, setRecoveryAction] = useState("");
  const [recoveryActionType, setRecoveryActionType] = useState<
    "verification" | "recovery_step" | "note"
  >("verification");
  const [recoveryRevokeSessions, setRecoveryRevokeSessions] = useState(false);
  const [recoveryOutcome, setRecoveryOutcome] = useState<"pending" | "resolved" | "denied">(
    "pending"
  );
  const tenant = useQuery({
    queryKey: ["platform", "tenant", tenantId],
    queryFn: () => api.platformTenant(tenantId),
    enabled: Boolean(tenantId)
  });
  const features = useQuery({ queryKey: ["platform", "features"], queryFn: api.platformFeatures });
  const audit = useQuery({ queryKey: ["platform", "audit"], queryFn: api.platformAudit });
  const notes = useQuery({
    queryKey: ["platform", "support-notes", tenantId],
    queryFn: () => api.platformSupportNotes(tenantId),
    enabled: Boolean(tenantId)
  });
  const recoveryCases = useQuery({
    queryKey: ["platform", "recovery-cases", tenantId],
    queryFn: () => api.platformAccountRecoveryCases(tenantId),
    enabled: Boolean(tenantId)
  });
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ["platform", "tenant", tenantId] });
    void cache.invalidateQueries({ queryKey: ["platform", "tenants"] });
    void cache.invalidateQueries({ queryKey: ["platform", "overview"] });
    void cache.invalidateQueries({ queryKey: ["platform", "audit"] });
  };
  const transition = useMutation({
    mutationFn: () =>
      api.transitionPlatformTenantStatus(
        tenantId,
        nextStatus as Exclude<TenantAccountStatus, "trial">,
        reason.trim()
      ),
    onSuccess: () => {
      setReason("");
      refresh();
      toast.success("Tenant lifecycle updated with an audit reason.");
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "Unable to update lifecycle.")
  });
  const capabilities = useMutation({
    mutationFn: ({ values, reason }: { values: SaaSCapabilityKey[]; reason: string }) =>
      api.updatePlatformTenantCapabilities(tenantId, values, reason),
    onSuccess: () => {
      refresh();
      toast.success("Tenant capability override updated.");
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "Unable to update capabilities.")
  });
  const addNote = useMutation({
    mutationFn: () =>
      api.createPlatformSupportNote(tenantId, {
        category: supportCategory,
        note: supportNote.trim()
      }),
    onSuccess: () => {
      setSupportNote("");
      void notes.refetch();
      toast.success("Support note saved.");
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : "Unable to save note.")
  });
  const addRecoveryCase = useMutation({
    mutationFn: () => {
      let verificationMetadata: Record<string, unknown>;
      try {
        verificationMetadata = JSON.parse(recoveryVerification) as Record<string, unknown>;
      } catch {
        throw new Error("Verification metadata must be valid JSON.");
      }
      return api.createPlatformAccountRecoveryCase(tenantId, {
        subject: {
          userId: recoveryUserId.trim() || null,
          email: recoveryEmail.trim() || null,
          phone: recoveryPhone.trim() || null
        },
        verificationMetadata,
        actionType: recoveryActionType,
        actionDetail: recoveryAction.trim(),
        revokeSessions: recoveryRevokeSessions,
        outcome: recoveryOutcome
      });
    },
    onSuccess: () => {
      setRecoveryAction("");
      setRecoveryVerification("{}");
      setRecoveryRevokeSessions(false);
      void recoveryCases.refetch();
      void cache.invalidateQueries({ queryKey: ["platform", "audit"] });
      toast.success("Account recovery case recorded.");
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "Unable to record recovery case.")
  });
  if (tenant.isLoading) return <PageLoading />;
  if (tenant.error || !tenant.data)
    return <ErrorNotice error={tenant.error ?? new Error("Tenant control record not found.")} />;
  const { tenant: record, subscription, usage } = tenant.data;
  const events = (audit.data ?? []).filter((event) => event.resourceId === tenantId);
  const summarizeEvent = (event: (typeof events)[number]) => {
    const before = event.beforeSummary ?? {};
    const after = event.afterSummary ?? {};
    if (event.action.includes("capabilities_changed")) {
      const beforeCount = Array.isArray(before.capabilities) ? before.capabilities.length : 0;
      const afterCount = Array.isArray(after.capabilities) ? after.capabilities.length : 0;
      return `${beforeCount} enabled → ${afterCount} enabled${typeof after.reason === "string" ? ` · Reason: ${after.reason}` : ""}`;
    }
    if (typeof after.status === "string") {
      return `${String(before.status ?? "unknown")} → ${after.status}${typeof after.reason === "string" ? ` · Reason: ${after.reason}` : ""}`;
    }
    return "Control-plane change recorded";
  };
  return (
    <WorkspacePage density="record">
      <PageHeader
        eyebrow="Tenant control record"
        title={record.name}
        description={`${record.slug} · ${record.timezone} · ${record.currency}`}
        actions={
          <>
            <StatusBadge status={subscription.status} />
            <Link className="fitos-button fitos-button--secondary" to="/platform/tenants">
              Back to tenants
            </Link>
          </>
        }
      />
      <Tabs
        activeId={tab}
        onChange={setTab}
        items={[
          { id: "summary", label: "Summary" },
          { id: "lifecycle", label: "Lifecycle" },
          { id: "access", label: "Plan & access" },
          { id: "activity", label: "Activity", count: events.length },
          { id: "support", label: "Support notes", count: notes.data?.length ?? 0 },
          { id: "recovery", label: "Account recovery", count: recoveryCases.data?.length ?? 0 }
        ]}
      />
      {tab === "summary" ? (
        <>
          <div className="platform-detail-grid">
            <Card>
              <h2>Customer</h2>
              <DetailList
                items={[
                  { label: "Tenant ID", value: record.id },
                  { label: "Slug", value: record.slug },
                  { label: "Timezone", value: record.timezone },
                  { label: "Currency", value: record.currency }
                ]}
              />
            </Card>
            <Card>
              <h2>Subscription state</h2>
              <DetailList
                items={[
                  { label: "Plan", value: subscription.planName },
                  { label: "Lifecycle", value: <StatusBadge status={subscription.status} /> },
                  {
                    label: "Trial ends",
                    value: subscription.trialEndsAt
                      ? formatDateTime(subscription.trialEndsAt)
                      : "Not applicable"
                  },
                  {
                    label: "Period ends",
                    value: subscription.currentPeriodEndsAt
                      ? formatDateTime(subscription.currentPeriodEndsAt)
                      : "Not set"
                  }
                ]}
              />
            </Card>
          </div>
          <Card>
            <h2>Measured usage</h2>
            <div className="platform-usage-grid">
              <ProgressBar
                label="Active members"
                value={usage.activeMembers}
                max={usage.maxMembers}
              />
              <ProgressBar label="Staff accounts" value={usage.activeStaff} max={usage.maxStaff} />
              <ProgressBar label="Branches" value={usage.branches} max={usage.maxBranches} />
              <ProgressBar
                label="Automation runs this month"
                value={usage.automationRunsThisMonth}
                max={usage.maxAutomationRuns}
              />
            </div>
            {usage.storageUsedMb == null ? (
              <p className="muted">
                Storage is not shown because it is not measured by an authoritative provider.
              </p>
            ) : (
              <ProgressBar
                label="Storage (MB)"
                value={usage.storageUsedMb}
                max={usage.maxStorageMb}
              />
            )}
          </Card>
        </>
      ) : null}
      {tab === "lifecycle" ? (
        <div className="platform-detail-grid">
          <Card>
            <h2>Current lifecycle</h2>
            <StatusBadge status={subscription.status} />
            <p className="muted">
              Lifecycle changes preserve tenant data. The reason is required and recorded in
              Platform audit.
            </p>
            <Alert tone="warning" title="Operational impact">
              Suspended, cancelled, and archived states can prevent normal tenant use. Confirm the
              customer context before saving.
            </Alert>
          </Card>
          <Card>
            <h2>Change lifecycle</h2>
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                transition.mutate();
              }}
            >
              <FormField htmlFor="tenant-lifecycle" label="New state">
                <Select
                  id="tenant-lifecycle"
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value as TenantAccountStatus)}
                >
                  {lifecycleOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                htmlFor="tenant-lifecycle-reason"
                label="Audit reason"
                hint="Record the customer or operational reason for this change."
              >
                <Input
                  id="tenant-lifecycle-reason"
                  minLength={3}
                  maxLength={500}
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </FormField>
              <Button
                disabled={reason.trim().length < 3 || nextStatus === subscription.status}
                loading={transition.isPending}
                type="submit"
              >
                Save lifecycle
              </Button>
            </form>
          </Card>
        </div>
      ) : null}
      {tab === "support" ? (
        <div className="platform-detail-grid">
          <Card>
            <h2>Add support note</h2>
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                if (supportNote.trim().length) addNote.mutate();
              }}
            >
              <FormField htmlFor="support-category" label="Category">
                <Select
                  id="support-category"
                  value={supportCategory}
                  onChange={(event) =>
                    setSupportCategory(event.target.value as typeof supportCategory)
                  }
                >
                  {["implementation", "support", "account", "risk"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </Select>
              </FormField>
              <FormField htmlFor="support-note" label="Note">
                <textarea
                  id="support-note"
                  className="fitos-control"
                  value={supportNote}
                  onChange={(event) => setSupportNote(event.target.value)}
                />
              </FormField>
              <Button type="submit" disabled={addNote.isPending}>
                Save note
              </Button>
            </form>
          </Card>
          <Card>
            <h2>Recent notes</h2>
            <ErrorNotice error={notes.error} onRetry={() => void notes.refetch()} />
            {notes.data?.length ? (
              notes.data.map((note) => (
                <div className="fitos-mobile-data-card" key={note.id}>
                  <strong>{note.category}</strong>
                  <span>{note.note}</span>
                  <small>{formatDateTime(note.createdAt)}</small>
                </div>
              ))
            ) : (
              <p className="muted">No support notes recorded.</p>
            )}
          </Card>
        </div>
      ) : null}
      {tab === "recovery" ? (
        <div className="platform-detail-grid">
          <Card>
            <h2>Record recovery action</h2>
            <p className="muted">
              Verify the subject through approved metadata before issuing a recovery step. Every
              case is retained in the Platform audit trail; private operational records remain
              inaccessible.
            </p>
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                if (recoveryAction.trim().length >= 3) addRecoveryCase.mutate();
              }}
            >
              <FormField htmlFor="recovery-user-id" label="Subject user ID">
                <Input
                  id="recovery-user-id"
                  placeholder="Required when revoking sessions"
                  value={recoveryUserId}
                  onChange={(event) => setRecoveryUserId(event.target.value)}
                />
              </FormField>
              <div className="form-grid-2">
                <FormField htmlFor="recovery-email" label="Subject email">
                  <Input
                    id="recovery-email"
                    type="email"
                    value={recoveryEmail}
                    onChange={(event) => setRecoveryEmail(event.target.value)}
                  />
                </FormField>
                <FormField htmlFor="recovery-phone" label="Subject phone">
                  <Input
                    id="recovery-phone"
                    value={recoveryPhone}
                    onChange={(event) => setRecoveryPhone(event.target.value)}
                  />
                </FormField>
              </div>
              <FormField
                htmlFor="recovery-verification"
                label="Verification metadata (JSON)"
                hint='Example: {"ticket":"SUP-123","verifiedBy":"phone"}'
              >
                <textarea
                  id="recovery-verification"
                  className="fitos-control"
                  rows={3}
                  value={recoveryVerification}
                  onChange={(event) => setRecoveryVerification(event.target.value)}
                />
              </FormField>
              <FormField htmlFor="recovery-action-type" label="Action type">
                <Select
                  id="recovery-action-type"
                  value={recoveryActionType}
                  onChange={(event) =>
                    setRecoveryActionType(event.target.value as typeof recoveryActionType)
                  }
                >
                  <option value="verification">Verification</option>
                  <option value="recovery_step">Recovery step</option>
                  <option value="note">Internal note</option>
                </Select>
              </FormField>
              <FormField htmlFor="recovery-action" label="Action detail">
                <textarea
                  id="recovery-action"
                  className="fitos-control"
                  rows={3}
                  required
                  minLength={3}
                  value={recoveryAction}
                  onChange={(event) => setRecoveryAction(event.target.value)}
                />
              </FormField>
              <label className="fitos-checkbox-label">
                <input
                  type="checkbox"
                  checked={recoveryRevokeSessions}
                  onChange={(event) => setRecoveryRevokeSessions(event.target.checked)}
                />
                Revoke all active staff sessions for this user
              </label>
              <FormField htmlFor="recovery-outcome" label="Outcome">
                <Select
                  id="recovery-outcome"
                  value={recoveryOutcome}
                  onChange={(event) =>
                    setRecoveryOutcome(event.target.value as typeof recoveryOutcome)
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="denied">Denied</option>
                </Select>
              </FormField>
              <Button
                type="submit"
                loading={addRecoveryCase.isPending}
                disabled={recoveryAction.trim().length < 3}
              >
                Record recovery case
              </Button>
            </form>
          </Card>
          <Card>
            <h2>Recovery history</h2>
            <ErrorNotice error={recoveryCases.error} onRetry={() => void recoveryCases.refetch()} />
            {recoveryCases.data?.length ? (
              recoveryCases.data.map((item) => (
                <div className="fitos-mobile-data-card" key={item.id}>
                  <strong>
                    {item.outcome} ·{" "}
                    {item.subject.email ?? item.subject.phone ?? item.subject.userId}
                  </strong>
                  <span>{item.actions[item.actions.length - 1]?.detail ?? "No action detail"}</span>
                  <small>
                    {item.sessionRevocation.requested
                      ? `Sessions revoked: ${item.sessionRevocation.revokedCount}`
                      : "Sessions unchanged"}
                    {" · "}
                    {formatDateTime(item.createdAt)}
                  </small>
                </div>
              ))
            ) : (
              <p className="muted">No account recovery cases recorded.</p>
            )}
          </Card>
        </div>
      ) : null}
      {tab === "access" ? (
        <div className="platform-detail-grid">
          <Card>
            <h2>{subscription.planName}</h2>
            <p className="muted">
              Plan reassignment and billing are not exposed in this non-payment release. Capability
              overrides below are persisted and audited.
            </p>
            <DetailList
              items={[
                { label: "Canonical key", value: subscription.plan },
                { label: "Enabled capabilities", value: subscription.capabilities.length },
                { label: "Member limit", value: usage.maxMembers.toLocaleString() },
                { label: "Branch limit", value: usage.maxBranches.toLocaleString() }
              ]}
            />
          </Card>
          <Card>
            <h2>Capability overrides</h2>
            <div className="platform-capability-list">
              {(features.data ?? []).map((feature) => {
                const enabled = subscription.capabilities.includes(feature.key);
                return (
                  <label key={feature.key}>
                    <input
                      checked={enabled}
                      disabled={capabilities.isPending}
                      onChange={() => {
                        const next = (
                          enabled
                            ? subscription.capabilities.filter((key) => key !== feature.key)
                            : [...subscription.capabilities, feature.key]
                        ) as SaaSCapabilityKey[];
                        setPendingCapabilities(next);
                        setCapabilityReason("");
                      }}
                      type="checkbox"
                    />
                    <span>
                      <strong>{feature.name}</strong>
                      <small>{feature.maturity}</small>
                    </span>
                  </label>
                );
              })}
            </div>
            <ErrorNotice error={features.error} />
          </Card>
        </div>
      ) : null}
      {tab === "activity" ? (
        <Card>
          <h2>Control-plane activity</h2>
          <Timeline
            items={events.map((event) => ({
              id: event.id,
              title: event.action.replaceAll("_", " "),
              meta: formatDateTime(event.createdAt),
              body: `${event.resourceType} · ${summarizeEvent(event)}`,
              tone:
                event.action.includes("suspend") || event.action.includes("cancel")
                  ? "warning"
                  : "info"
            }))}
            empty={
              <EmptyState
                icon="shield"
                title="No tenant control activity"
                description="Lifecycle and capability changes for this tenant will appear here."
              />
            }
          />
        </Card>
      ) : null}
      <Modal
        description="Record why this tenant capability set is being changed. The reason is retained in the Platform audit history."
        isOpen={Boolean(pendingCapabilities)}
        onClose={() => setPendingCapabilities(null)}
        title="Confirm capability override"
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pendingCapabilities || capabilityReason.trim().length < 3) return;
            capabilities.mutate(
              { values: pendingCapabilities, reason: capabilityReason.trim() },
              { onSuccess: () => setPendingCapabilities(null) }
            );
          }}
        >
          <FormField htmlFor="capability-override-reason" label="Audit reason">
            <Input
              id="capability-override-reason"
              minLength={3}
              maxLength={500}
              required
              value={capabilityReason}
              onChange={(event) => setCapabilityReason(event.target.value)}
            />
          </FormField>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setPendingCapabilities(null)}>
              Cancel
            </Button>
            <Button
              disabled={capabilityReason.trim().length < 3}
              loading={capabilities.isPending}
              type="submit"
            >
              Apply override
            </Button>
          </div>
        </form>
      </Modal>
    </WorkspacePage>
  );
}
