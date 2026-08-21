import { useState } from "react";
import { Card, Icon, PageHeader } from "@fitos/ui";

type AutomationTab = "active" | "templates" | "builder";

const TRIGGER_OPTIONS: { id: string; label: string; icon: "calendar" | "spark" | "users" | "check" | "plus" | "warning" }[] = [
  { id: "class_booked", label: "Class Booked", icon: "calendar" },
  { id: "membership_expiring", label: "Membership Expiring in 3 Days", icon: "spark" },
  { id: "no_visit_14", label: "No Visit in 14 Days", icon: "users" },
  { id: "trial_completed", label: "Trial Completed", icon: "check" },
  { id: "member_joined", label: "New Member Joined", icon: "plus" },
  { id: "payment_failed", label: "Payment Failed", icon: "warning" }
];

const ACTION_OPTIONS: { id: string; label: string; icon: "edit" | "users" | "check" | "spark" }[] = [
  { id: "send_email", label: "Send Email", icon: "edit" },
  { id: "send_sms", label: "Send SMS / WhatsApp", icon: "users" },
  { id: "create_task", label: "Create Staff Task", icon: "check" },
  { id: "update_crm", label: "Update CRM Stage", icon: "spark" }
];

const TEMPLATE_AUTOMATIONS = [
  {
    id: "booking-confirm",
    name: "Booking Confirmation",
    trigger: "Class Booked",
    action: "Send Email",
    active: true,
    runs: 1247,
    icon: "calendar" as const
  },
  {
    id: "class-reminder",
    name: "Class Reminder (24h)",
    trigger: "Class Booked",
    action: "Send SMS",
    active: true,
    runs: 983,
    icon: "calendar" as const
  },
  {
    id: "trial-followup",
    name: "Trial Follow-up",
    trigger: "Trial Completed",
    action: "Create Task + Send Email",
    active: true,
    runs: 40,
    icon: "spark" as const
  },
  {
    id: "winback",
    name: "Win-back Nudge (14d inactive)",
    trigger: "No Visit in 14 Days",
    action: "Send WhatsApp",
    active: false,
    runs: 89,
    icon: "users" as const
  },
  {
    id: "membership-expiry",
    name: "Membership Expiry Warning",
    trigger: "Membership Expiring in 3 Days",
    action: "Send Email + SMS",
    active: true,
    runs: 312,
    icon: "check" as const
  }
];

export function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<AutomationTab>("active");
  const [builderStep, setBuilderStep] = useState<"trigger" | "condition" | "action" | "review">(
    "trigger"
  );
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [automations, setAutomations] = useState(TEMPLATE_AUTOMATIONS);

  const toggleAutomation = (id: string) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    );
  };

  const tabs: { id: AutomationTab; label: string; icon: string }[] = [
    { id: "active", label: "Active Automations", icon: "spark" },
    { id: "templates", label: "Template Library", icon: "dashboard" },
    { id: "builder", label: "Build New", icon: "plus" }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Automations"
        description="Automate member communications, follow-ups, and staff tasks using visual workflow rules."
        actions={
          <button
            className="fitos-button fitos-button--primary"
            onClick={() => setActiveTab("builder")}
            type="button"
          >
            <Icon name="plus" size={16} />
            New Automation
          </button>
        }
      />

      {/* Tab Bar */}
      <div className="member-tab-bar">
        {tabs.map((tab) => (
          <button
            className={`member-tab-bar__tab${activeTab === tab.id ? " member-tab-bar__tab--active" : ""}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <Icon name={tab.icon as Parameters<typeof Icon>[0]["name"]} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="member-tab-content">
        {/* ── ACTIVE ── */}
        {activeTab === "active" && (
          <div className="form-stack">
            <div className="automation-list">
              {automations.map((automation) => (
                <div
                  className={`automation-card${automation.active ? " automation-card--active" : " automation-card--paused"}`}
                  key={automation.id}
                >
                  <div
                    className="automation-card__icon"
                    style={{
                      background: automation.active
                        ? "rgba(198,255,0,0.12)"
                        : "rgba(255,255,255,0.05)"
                    }}
                  >
                    <Icon
                      name={automation.icon as Parameters<typeof Icon>[0]["name"]}
                      size={20}
                    />
                  </div>
                  <div className="automation-card__info">
                    <div className="automation-card__name">{automation.name}</div>
                    <div className="automation-card__flow">
                      <span className="automation-flow-node automation-flow-node--trigger">
                        ⚡ {automation.trigger}
                      </span>
                      <span className="automation-flow-arrow">→</span>
                      <span className="automation-flow-node automation-flow-node--action">
                        ✉ {automation.action}
                      </span>
                    </div>
                  </div>
                  <div className="automation-card__stats">
                    <div className="automation-card__runs">{automation.runs.toLocaleString()} runs</div>
                    <div
                      className={`automation-card__status${automation.active ? " automation-card__status--on" : ""}`}
                    >
                      {automation.active ? "Active" : "Paused"}
                    </div>
                  </div>
                  <label className="automation-toggle" title={automation.active ? "Pause" : "Activate"}>
                    <input
                      checked={automation.active}
                      onChange={() => toggleAutomation(automation.id)}
                      type="checkbox"
                    />
                    <span className="automation-toggle__track">
                      <span className="automation-toggle__thumb" />
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TEMPLATES ── */}
        {activeTab === "templates" && (
          <div className="automation-templates-grid">
            {[
              {
                name: "Booking Confirmation",
                desc: "Send an email immediately after a class is booked.",
                trigger: "Class Booked",
                action: "Send Email",
                category: "Bookings"
              },
              {
                name: "Class Reminder",
                desc: "Text the member 24h before their scheduled class.",
                trigger: "Class Booked",
                action: "Send SMS",
                category: "Bookings"
              },
              {
                name: "Win-back Nudge",
                desc: "WhatsApp message to members inactive for 14+ days.",
                trigger: "No Visit in 14 Days",
                action: "Send WhatsApp",
                category: "Retention"
              },
              {
                name: "Membership Expiry Warning",
                desc: "Notify members 3 days before their plan expires.",
                trigger: "Membership Expiring",
                action: "Send Email + SMS",
                category: "Retention"
              },
              {
                name: "Trial Follow-up",
                desc: "Create a staff task + send an offer email after trial completion.",
                trigger: "Trial Completed",
                action: "Create Task + Email",
                category: "Leads"
              },
              {
                name: "New Member Welcome",
                desc: "Welcome email series starting on the day a member joins.",
                trigger: "New Member Joined",
                action: "Send Email",
                category: "Onboarding"
              }
            ].map((tmpl) => (
              <Card className="automation-template-card" key={tmpl.name}>
                <div className="automation-template-card__category">{tmpl.category}</div>
                <div className="automation-template-card__name">{tmpl.name}</div>
                <p className="muted" style={{ fontSize: "0.82rem", margin: "0.5rem 0 1rem" }}>
                  {tmpl.desc}
                </p>
                <div className="automation-flow-node automation-flow-node--trigger" style={{ marginBottom: "0.3rem" }}>
                  ⚡ {tmpl.trigger}
                </div>
                <div className="automation-flow-node automation-flow-node--action">
                  ✉ {tmpl.action}
                </div>
                <button
                  className="fitos-button fitos-button--secondary fitos-button--small"
                  onClick={() => setActiveTab("builder")}
                  style={{ marginTop: "1rem" }}
                  type="button"
                >
                  Use Template
                </button>
              </Card>
            ))}
          </div>
        )}

        {/* ── BUILDER ── */}
        {activeTab === "builder" && (
          <div className="automation-builder">
            {/* Progress Steps */}
            <div className="automation-builder__steps">
              {(["trigger", "condition", "action", "review"] as const).map((step, i) => (
                <div
                  className={`automation-builder__step${builderStep === step ? " automation-builder__step--active" : ""} ${["trigger", "condition", "action", "review"].indexOf(builderStep) > i ? "automation-builder__step--done" : ""}`}
                  key={step}
                  onClick={() => setBuilderStep(step)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setBuilderStep(step)}
                >
                  <div className="automation-builder__step-num">{i + 1}</div>
                  <span>{step.charAt(0).toUpperCase() + step.slice(1)}</span>
                </div>
              ))}
            </div>

            {/* Step: Trigger */}
            {builderStep === "trigger" && (
              <Card>
                <h2 style={{ marginBottom: "0.25rem" }}>⚡ Choose a Trigger</h2>
                <p className="muted" style={{ marginBottom: "1.5rem", fontSize: "0.85rem" }}>
                  This event will start the automation.
                </p>
                <div className="builder-option-grid">
                  {TRIGGER_OPTIONS.map((opt) => (
                    <button
                      className={`builder-option${selectedTrigger === opt.id ? " builder-option--selected" : ""}`}
                      key={opt.id}
                      onClick={() => setSelectedTrigger(opt.id)}
                      type="button"
                    >
                      <Icon name={opt.icon as Parameters<typeof Icon>[0]["name"]} size={22} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
                <div className="form-actions" style={{ marginTop: "1.5rem" }}>
                  <button
                    className="fitos-button fitos-button--primary"
                    disabled={!selectedTrigger}
                    onClick={() => setBuilderStep("condition")}
                    type="button"
                  >
                    Next: Add Condition →
                  </button>
                </div>
              </Card>
            )}

            {/* Step: Condition */}
            {builderStep === "condition" && (
              <Card>
                <h2 style={{ marginBottom: "0.25rem" }}>⚙ Add a Condition (Optional)</h2>
                <p className="muted" style={{ marginBottom: "1.5rem", fontSize: "0.85rem" }}>
                  Narrow when the automation runs based on member data.
                </p>
                <div className="form-grid">
                  <div>
                    <label className="form-field__label">Filter by</label>
                    <select className="fitos-control">
                      <option>No condition — run for all members</option>
                      <option>Membership plan = specific plan</option>
                      <option>Member status = active</option>
                      <option>Last visit &gt; 14 days ago</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions" style={{ marginTop: "1.5rem" }}>
                  <button
                    className="fitos-button fitos-button--ghost"
                    onClick={() => setBuilderStep("trigger")}
                    type="button"
                  >
                    ← Back
                  </button>
                  <button
                    className="fitos-button fitos-button--primary"
                    onClick={() => setBuilderStep("action")}
                    type="button"
                  >
                    Next: Choose Action →
                  </button>
                </div>
              </Card>
            )}

            {/* Step: Action */}
            {builderStep === "action" && (
              <Card>
                <h2 style={{ marginBottom: "0.25rem" }}>✉ Choose an Action</h2>
                <p className="muted" style={{ marginBottom: "1.5rem", fontSize: "0.85rem" }}>
                  What should FITOS do when the trigger fires?
                </p>
                <div className="builder-option-grid">
                  {ACTION_OPTIONS.map((opt) => (
                    <button
                      className={`builder-option${selectedAction === opt.id ? " builder-option--selected" : ""}`}
                      key={opt.id}
                      onClick={() => setSelectedAction(opt.id)}
                      type="button"
                    >
                      <Icon name={opt.icon as Parameters<typeof Icon>[0]["name"]} size={22} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
                <div className="form-actions" style={{ marginTop: "1.5rem" }}>
                  <button
                    className="fitos-button fitos-button--ghost"
                    onClick={() => setBuilderStep("condition")}
                    type="button"
                  >
                    ← Back
                  </button>
                  <button
                    className="fitos-button fitos-button--primary"
                    disabled={!selectedAction}
                    onClick={() => setBuilderStep("review")}
                    type="button"
                  >
                    Next: Review →
                  </button>
                </div>
              </Card>
            )}

            {/* Step: Review */}
            {builderStep === "review" && (
              <Card>
                <h2 style={{ marginBottom: "0.25rem" }}>✓ Review & Activate</h2>
                <p className="muted" style={{ marginBottom: "1.5rem", fontSize: "0.85rem" }}>
                  Confirm your automation before publishing it.
                </p>
                <div className="automation-review">
                  <div className="automation-review__flow">
                    <div className="automation-flow-node automation-flow-node--trigger automation-flow-node--lg">
                      ⚡{" "}
                      {TRIGGER_OPTIONS.find((t) => t.id === selectedTrigger)?.label ??
                        "No trigger selected"}
                    </div>
                    <div className="automation-review__arrow">↓</div>
                    <div className="automation-flow-node automation-flow-node--action automation-flow-node--lg">
                      ✉{" "}
                      {ACTION_OPTIONS.find((a) => a.id === selectedAction)?.label ??
                        "No action selected"}
                    </div>
                  </div>
                </div>
                <div className="form-grid" style={{ marginTop: "1.5rem" }}>
                  <div>
                    <label className="form-field__label">Automation Name</label>
                    <input
                      className="fitos-control"
                      defaultValue={`${TRIGGER_OPTIONS.find((t) => t.id === selectedTrigger)?.label ?? "My"} Automation`}
                    />
                  </div>
                </div>
                <div className="form-actions" style={{ marginTop: "1.5rem" }}>
                  <button
                    className="fitos-button fitos-button--ghost"
                    onClick={() => setBuilderStep("action")}
                    type="button"
                  >
                    ← Back
                  </button>
                  <button
                    className="fitos-button fitos-button--primary"
                    onClick={() => {
                      setActiveTab("active");
                      setBuilderStep("trigger");
                    }}
                    type="button"
                  >
                    🚀 Activate Automation
                  </button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
