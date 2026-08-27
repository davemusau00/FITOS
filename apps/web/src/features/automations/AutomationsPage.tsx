import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Icon, Modal, PageHeader } from "@fitos/ui";
import type {
  AutomationActionType,
  AutomationRuleResponse,
  AutomationTriggerType,
  CreateAutomationRuleRequest
} from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

type AutomationTab = "active" | "templates" | "builder" | "logs";

const TRIGGER_OPTIONS: {
  id: AutomationTriggerType;
  label: string;
  icon: "calendar" | "spark" | "users" | "check" | "plus" | "warning";
}[] = [
  { id: "member_joined", label: "New Member Joined", icon: "plus" },
  { id: "trial_completed", label: "Trial Completed / New Inquiry", icon: "spark" },
  { id: "booking_created", label: "Class Booked", icon: "calendar" },
  { id: "booking_cancelled", label: "Booking Cancelled", icon: "check" },
  { id: "membership_expiring_soon", label: "Membership Expiring Soon", icon: "warning" },
  { id: "member_inactive", label: "Inactive Member (At-Risk)", icon: "users" },
  { id: "payment_failed", label: "Payment Failed", icon: "warning" }
];

const ACTION_OPTIONS: {
  id: AutomationActionType;
  label: string;
  icon: "edit" | "users" | "check" | "spark";
}[] = [
  { id: "send_email", label: "Send Automated Email", icon: "edit" },
  { id: "send_whatsapp", label: "Send WhatsApp Notification", icon: "users" },
  { id: "send_sms", label: "Send SMS Notification", icon: "spark" },
  { id: "create_staff_task", label: "Create Staff Follow-up Task", icon: "check" },
  { id: "update_crm_stage", label: "Update CRM Funnel Stage", icon: "spark" }
];

const TEMPLATE_AUTOMATIONS: Array<{
  name: string;
  description: string;
  triggerType: AutomationTriggerType;
  triggerLabel: string;
  actionType: AutomationActionType;
  actionLabel: string;
  icon: "calendar" | "spark" | "users" | "check" | "plus";
}> = [
  {
    name: "Welcome Onboarding Email",
    description:
      "Sends gym welcome pack, schedule link, and coach introduction immediately upon member registration.",
    triggerType: "member_joined",
    triggerLabel: "New Member Joined",
    actionType: "send_email",
    actionLabel: "Send Welcome Email",
    icon: "plus"
  },
  {
    name: "Lead 15-Minute WhatsApp Fast Response",
    description:
      "Triggers instant greeting via WhatsApp when a new inquiry submits the website contact or trial form.",
    triggerType: "trial_completed",
    triggerLabel: "New Lead / Trial",
    actionType: "send_whatsapp",
    actionLabel: "Send WhatsApp Greeting",
    icon: "spark"
  },
  {
    name: "Class Booking Confirmation & Calendar Invite",
    description:
      "Sends instant booking confirmation with class start time, instructor info, and arrival guidelines.",
    triggerType: "booking_created",
    triggerLabel: "Class Booked",
    actionType: "send_email",
    actionLabel: "Send Booking Confirmation",
    icon: "calendar"
  },
  {
    name: "3-Day Membership Renewal Nudge",
    description:
      "Notifies member 72 hours before their pass expires with a 1-click renewal link to prevent lapse.",
    triggerType: "membership_expiring_soon",
    triggerLabel: "Membership Expiring Soon",
    actionType: "send_whatsapp",
    actionLabel: "Send Renewal SMS / WhatsApp",
    icon: "spark"
  },
  {
    name: "21-Day Inactive Member Winback Task",
    description:
      "Creates an urgent high-priority task for front desk staff to call inactive members at risk of churning.",
    triggerType: "member_inactive",
    triggerLabel: "No Visit in 21 Days",
    actionType: "create_staff_task",
    actionLabel: "Create Staff Phone Call Task",
    icon: "users"
  }
];

export function AutomationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AutomationTab>("active");

  // Builder form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState<AutomationTriggerType>("member_joined");
  const [selectedAction, setSelectedAction] = useState<AutomationActionType>("send_email");
  const [formError, setFormError] = useState<unknown>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AutomationRuleResponse | null>(null);

  const automationsQuery = useQuery({
    queryKey: ["automations"],
    queryFn: api.automations
  });

  const logsQuery = useQuery({
    queryKey: ["automation-logs"],
    queryFn: api.automationLogs,
    enabled: activeTab === "logs"
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateAutomationRuleRequest) => api.createAutomation(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
      setActiveTab("active");
      setName("");
      setDescription("");
      setFormError(null);
    },
    onError: (err) => setFormError(err)
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateAutomation(id, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAutomation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
    }
  });

  const triggerMutation = useMutation({
    mutationFn: (id: string) => api.triggerAutomation(id),
    onSuccess: (res) => {
      setTestResult(`Test run succeeded: ${res.message}`);
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
      void queryClient.invalidateQueries({ queryKey: ["automation-logs"] });
    },
    onError: (err) => setFormError(err)
  });

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      triggerType: selectedTrigger,
      triggerConfig: {},
      conditions: [],
      actionType: selectedAction,
      actionConfig: { template: selectedAction, recipientType: "member" },
      isActive: true
    });
  };

  const handleApplyTemplate = (tmpl: (typeof TEMPLATE_AUTOMATIONS)[number]) => {
    createMutation.mutate({
      name: tmpl.name,
      description: tmpl.description,
      triggerType: tmpl.triggerType,
      triggerConfig: {},
      conditions: [],
      actionType: tmpl.actionType,
      actionConfig: { template: tmpl.actionType, recipientType: "member" },
      isActive: true
    });
  };

  const tabs: { id: AutomationTab; label: string; icon: string }[] = [
    {
      id: "active",
      label: `Active Workflows (${automationsQuery.data?.length ?? 0})`,
      icon: "spark"
    },
    { id: "templates", label: "Template Library", icon: "dashboard" },
    { id: "builder", label: "Workflow Builder", icon: "plus" },
    { id: "logs", label: "Execution History", icon: "check" }
  ];

  if (automationsQuery.isLoading) return <PageLoading />;

  const rules = automationsQuery.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Automations"
        description="Automate member lifecycle communications, WhatsApp / SMS notifications, retention nudges, and staff tasks."
        actions={
          <button
            className="fitos-button fitos-button--primary"
            onClick={() => setActiveTab("builder")}
            type="button"
          >
            <Icon name="plus" size={16} />
            Build New Workflow
          </button>
        }
      />

      <ErrorNotice error={automationsQuery.error || formError} />
      {testResult ? (
        <div className="fitos-alert fitos-alert--success" style={{ marginBottom: "1rem" }}>
          <Icon name="check" size={16} />
          <span>{testResult}</span>
        </div>
      ) : null}

      {/* Tab Bar */}
      <div className="member-tab-bar">
        {tabs.map((tab) => (
          <button
            className={`member-tab-bar__tab${activeTab === tab.id ? " member-tab-bar__tab--active" : ""}`}
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setTestResult(null);
            }}
            type="button"
          >
            <Icon name={tab.icon as Parameters<typeof Icon>[0]["name"]} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="member-tab-content">
        {/* ── ACTIVE WORKFLOWS ── */}
        {activeTab === "active" && (
          <div className="form-stack">
            <div className="automation-list">
              {rules.map((rule: AutomationRuleResponse) => {
                return (
                  <div
                    className={`automation-card${rule.isActive ? " automation-card--active" : " automation-card--paused"}`}
                    key={rule.id}
                  >
                    <div
                      className="automation-card__icon"
                      style={{
                        background: rule.isActive
                          ? "rgba(198,255,0,0.12)"
                          : "rgba(255,255,255,0.05)"
                      }}
                    >
                      <Icon name="spark" size={20} />
                    </div>

                    <div className="automation-card__info">
                      <div className="automation-card__name">{rule.name}</div>
                      {rule.description ? (
                        <p className="muted" style={{ fontSize: "0.8rem", margin: "0.2rem 0" }}>
                          {rule.description}
                        </p>
                      ) : null}
                      <div className="automation-card__flow">
                        <span className="automation-flow-node automation-flow-node--trigger">
                          ⚡ {rule.triggerType}
                        </span>
                        <span className="automation-flow-arrow">→</span>
                        <span className="automation-flow-node automation-flow-node--action">
                          ✉ {rule.actionType}
                        </span>
                      </div>
                    </div>

                    <div className="automation-card__stats">
                      <div className="automation-card__runs">
                        {rule.totalExecutions.toLocaleString()} runs
                      </div>
                      <div className="automation-card__last-run">
                        {rule.lastExecutedAt
                          ? `Last: ${formatDateTime(rule.lastExecutedAt)}`
                          : "Not triggered yet"}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Button
                        loading={triggerMutation.isPending}
                        onClick={() => triggerMutation.mutate(rule.id)}
                        size="small"
                        variant="secondary"
                      >
                        Test Run
                      </Button>

                      <button
                        aria-checked={rule.isActive}
                        aria-label={`Toggle ${rule.name}`}
                        className={`automation-toggle${rule.isActive ? " is-on" : ""}`}
                        onClick={() =>
                          toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })
                        }
                        role="switch"
                        type="button"
                      >
                        <span className="automation-toggle__thumb" />
                      </button>

                      <button
                        aria-label="Delete rule"
                        className="fitos-button fitos-button--ghost fitos-button--small"
                        onClick={() => setPendingDelete(rule)}
                        style={{ color: "var(--danger)" }}
                        type="button"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}

              {!rules.length ? (
                <Card>
                  <div style={{ textAlign: "center", padding: "2rem" }}>
                    <Icon name="spark" size={32} />
                    <h3 style={{ marginTop: "0.5rem" }}>No automations active yet</h3>
                    <p className="muted" style={{ marginBottom: "1rem" }}>
                      Choose a pre-configured template from our library or build a custom workflow.
                    </p>
                    <Button onClick={() => setActiveTab("templates")} variant="primary">
                      Browse Template Library
                    </Button>
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        )}

        {/* ── TEMPLATES LIBRARY ── */}
        {activeTab === "templates" && (
          <div className="form-stack">
            <p className="muted">
              Pre-built gym automation workflows designed for high conversion, attendance reminders,
              and winback retention.
            </p>
            <div className="templates-grid">
              {TEMPLATE_AUTOMATIONS.map((tmpl) => (
                <Card className="template-card" key={tmpl.name}>
                  <div className="template-card__header">
                    <div className="template-card__icon">
                      <Icon name={tmpl.icon} size={20} />
                    </div>
                    <h3>{tmpl.name}</h3>
                  </div>
                  <p className="template-card__desc">{tmpl.description}</p>
                  <div className="template-card__flow">
                    <span className="automation-flow-node automation-flow-node--trigger">
                      ⚡ {tmpl.triggerLabel}
                    </span>
                    <span className="automation-flow-arrow">→</span>
                    <span className="automation-flow-node automation-flow-node--action">
                      ✉ {tmpl.actionLabel}
                    </span>
                  </div>
                  <div className="template-card__footer">
                    <Button
                      fullWidth
                      loading={createMutation.isPending}
                      onClick={() => handleApplyTemplate(tmpl)}
                      variant="secondary"
                    >
                      Use Template
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── WORKFLOW BUILDER ── */}
        {activeTab === "builder" && (
          <form className="form-stack" onSubmit={handleCreateCustom}>
            <Card>
              <h2>1. Workflow Details</h2>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="fitos-label" htmlFor="rule-name">
                    Workflow Name *
                  </label>
                  <input
                    className="fitos-control"
                    id="rule-name"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. VIP Member 10th Class Celebration"
                    required
                    value={name}
                  />
                </div>
              </div>
              <div className="form-row" style={{ marginTop: "1rem" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="fitos-label" htmlFor="rule-desc">
                    Description (optional)
                  </label>
                  <input
                    className="fitos-control"
                    id="rule-desc"
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Explain what this automation does..."
                    value={description}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <h2>2. Select Trigger Event</h2>
              <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "1rem" }}>
                When this event happens in FITOS, trigger the workflow:
              </p>
              <div className="builder-trigger-grid">
                {TRIGGER_OPTIONS.map((opt) => (
                  <div
                    className={`builder-trigger-card${selectedTrigger === opt.id ? " is-selected" : ""}`}
                    key={opt.id}
                    onClick={() => setSelectedTrigger(opt.id)}
                  >
                    <Icon name={opt.icon} size={20} />
                    <strong>{opt.label}</strong>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2>3. Select Action</h2>
              <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "1rem" }}>
                What action should FITOS execute automatically?
              </p>
              <div className="builder-trigger-grid">
                {ACTION_OPTIONS.map((opt) => (
                  <div
                    className={`builder-trigger-card${selectedAction === opt.id ? " is-selected" : ""}`}
                    key={opt.id}
                    onClick={() => setSelectedAction(opt.id)}
                  >
                    <Icon name={opt.icon} size={20} />
                    <strong>{opt.label}</strong>
                  </div>
                ))}
              </div>
            </Card>

            <div className="form-actions">
              <Button onClick={() => setActiveTab("active")} variant="ghost">
                Cancel
              </Button>
              <Button disabled={!name.trim()} loading={createMutation.isPending} variant="primary">
                Save & Activate Workflow
              </Button>
            </div>
          </form>
        )}

        {/* ── EXECUTION LOGS ── */}
        {activeTab === "logs" && (
          <div className="form-stack">
            <Card>
              <h2>Recent Automation Execution History</h2>
              <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
                Live record of automated emails, SMS, CRM updates, and scheduled background jobs.
              </p>

              {logsQuery.isLoading ? (
                <p className="muted">Loading logs…</p>
              ) : logsQuery.data?.length ? (
                <div className="activity-list">
                  {logsQuery.data.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem 0",
                        borderBottom: "1px solid var(--border-subtle)"
                      }}
                    >
                      <div>
                        <strong>{log.ruleName}</strong>
                        <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
                          {log.message} · Target: {log.targetEntityName ?? "System"}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className="fitos-badge fitos-badge--success">{log.status}</span>
                        <span
                          className="muted"
                          style={{ display: "block", fontSize: "0.75rem", marginTop: "0.2rem" }}
                        >
                          {formatDateTime(log.executedAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  No execution logs recorded yet. Use &quot;Test Run&quot; on any active workflow.
                </p>
              )}
            </Card>
          </div>
        )}
      </div>
      {pendingDelete ? (
        <Modal
          description={`This will permanently remove “${pendingDelete.name}”. Existing execution history will remain.`}
          isOpen={true}
          onClose={() => setPendingDelete(null)}
          title="Delete automation rule?"
        >
          <div className="form-actions">
            <Button onClick={() => setPendingDelete(null)} variant="ghost">
              Keep Rule
            </Button>
            <Button
              loading={deleteMutation.isPending}
              onClick={() => {
                deleteMutation.mutate(pendingDelete.id, {
                  onSuccess: () => setPendingDelete(null)
                });
              }}
              variant="danger"
            >
              Delete Rule
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
