import { Link } from "react-router-dom";
import { Icon, type IconName } from "@fitos/ui";
import { useAuth } from "../../app/auth";
import { FitosLogo } from "../../app/logo";

type OnboardingStepItem = {
  number: string;
  title: string;
  description: string;
  icon: IconName;
  to: string;
  isComplete: boolean;
};

export function OnboardingPage() {
  const { auth } = useAuth();

  const steps: OnboardingStepItem[] = [
    {
      number: "01",
      title: "Business Profile & Identity",
      description: "Organization name, default timezone, and local operating currency.",
      icon: "building",
      to: "/app/settings/organization",
      isComplete: Boolean(auth?.tenant?.name)
    },
    {
      number: "02",
      title: "First Branch & Location",
      description: "Create and configure your main studio, gym facility, or training branch.",
      icon: "building",
      to: "/app/settings/branches",
      isComplete: Boolean(auth?.branches && auth.branches.length > 0)
    },
    {
      number: "03",
      title: "Team & Staff Access",
      description: "Invite trainers, coaches, receptionists, and configure role-based permissions.",
      icon: "team",
      to: "/app/settings/team",
      isComplete: false
    },
    {
      number: "04",
      title: "Services & Workout Catalog",
      description:
        "Define class types, personal training services, schedules, and membership passes.",
      icon: "spark",
      to: "/app/services",
      isComplete: false
    }
  ];

  const completedCount = steps.filter((s) => s.isComplete).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="onboarding-screen">
      {/* ── Topbar ── */}
      <header className="onboarding-topbar">
        <FitosLogo height={24} />
        <Link
          className="fitos-button fitos-button--secondary fitos-button--small"
          to="/app/overview"
        >
          <Icon name="dashboard" size={14} />
          Go to Dashboard
        </Link>
      </header>

      {/* ── Main Container ── */}
      <main className="onboarding-container">
        {/* ── Hero ── */}
        <div className="onboarding-hero">
          <div>
            <span className="page-header__eyebrow">Get Ready • Business Setup</span>
            <h1>Set up your FITOS Operating System</h1>
            <p>
              Complete the essentials to start scheduling classes, managing coaches, and booking
              members seamlessly.
            </p>
          </div>

          <div className="onboarding-progress-badge">
            <div>
              <span>Setup Progress</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "0.25rem",
                  marginTop: "0.15rem"
                }}
              >
                <strong>{progressPercent}%</strong>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                  ({completedCount} of {steps.length} steps)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2-Column Layout ── */}
        <div className="onboarding-layout">
          {/* Left Column: Steps List */}
          <section aria-label="Setup Steps" className="onboarding-steps">
            {steps.map((step) => (
              <Link
                className={`onboarding-step ${step.isComplete ? "onboarding-step--done" : ""}`}
                key={step.number}
                to={step.to}
              >
                <div className="onboarding-step__number">
                  {step.isComplete ? (
                    <Icon name="check" size={20} style={{ color: "var(--success)" }} />
                  ) : (
                    <span>{step.number}</span>
                  )}
                </div>

                <div className="onboarding-step__info">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h2>{step.title}</h2>
                    {step.isComplete ? (
                      <span
                        className="fitos-badge fitos-badge--success"
                        style={{ fontSize: "0.65rem", padding: "0.15rem 0.45rem" }}
                      >
                        Done
                      </span>
                    ) : null}
                  </div>
                  <p>{step.description}</p>
                </div>

                <div className="onboarding-step__action">
                  <span>{step.isComplete ? "Review" : "Configure"}</span>
                  <Icon name="chevron-right" size={16} />
                </div>
              </Link>
            ))}
          </section>

          {/* Right Column: Setup Guide Summary */}
          <aside className="onboarding-summary-card">
            <div>
              <h3
                style={{
                  color: "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem"
                }}
              >
                <Icon name="spark" size={16} style={{ color: "var(--fitos-energy)" }} />
                Why complete setup?
              </h3>
              <p style={{ marginTop: "0.5rem" }}>
                Configuring your business unlocks live class booking, member check-ins, automated
                reminders, and revenue reporting.
              </p>
            </div>

            <hr className="divider" style={{ margin: 0 }} />

            <div>
              <h4
                style={{
                  color: "var(--text-primary)",
                  fontSize: "0.8375rem",
                  margin: "0 0 0.5rem"
                }}
              >
                What happens next:
              </h4>
              <ul className="setup-list">
                <li className={auth?.tenant?.name ? "is-done" : ""}>
                  <Icon name="check" size={14} />
                  <span>Branded member portal active</span>
                </li>
                <li className={auth?.branches?.length ? "is-done" : ""}>
                  <Icon name="check" size={14} />
                  <span>Timetable scheduling enabled</span>
                </li>
                <li>
                  <Icon name="spark" size={14} />
                  <span>Front desk reception ready</span>
                </li>
              </ul>
            </div>

            <hr className="divider" style={{ margin: 0 }} />

            <Link
              className="fitos-button fitos-button--primary fitos-button--full"
              to="/app/overview"
            >
              Finish & Open Dashboard
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
