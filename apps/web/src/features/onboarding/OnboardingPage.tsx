import { Link } from "react-router-dom";
import { Icon, PageHeader } from "@fitos/ui";
import { useAuth } from "../../app/auth";

function OnboardingStep({
  complete,
  number,
  title,
  description,
  to
}: {
  complete?: boolean;
  number: string;
  title: string;
  description: string;
  to?: string;
}) {
  const content = (
    <>
      <span className="onboarding-step__number">
        {complete ? <Icon name="check" size={18} /> : number}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {to ? <Icon name="chevron-right" size={20} /> : <span className="muted">Coming next</span>}
    </>
  );
  return to ? (
    <Link className="onboarding-step" to={to}>
      {content}
    </Link>
  ) : (
    <div className="onboarding-step">{content}</div>
  );
}

export function OnboardingPage() {
  const { auth } = useAuth();
  return (
    <>
      <PageHeader
        eyebrow="Get ready"
        title="Set up FITOS"
        description="Complete the essentials, then build services and schedules when the next operational slice is enabled."
      />
      <section className="onboarding-steps">
        <OnboardingStep
          complete={Boolean(auth?.tenant.name)}
          number="01"
          title="Business"
          description="Organization profile, timezone and currency."
          to="/app/settings/organization"
        />
        <OnboardingStep
          complete={Boolean(auth?.branches.length)}
          number="02"
          title="First branch"
          description="Create the operating location for members and staff."
          to="/app/settings/branches"
        />
        <OnboardingStep
          number="03"
          title="Team"
          description="Review access and branch assignments."
          to="/app/settings/team"
        />
        <OnboardingStep
          number="04"
          title="Services"
          description="Configure service catalog, appointments, and class schedules."
          to="/app/services"
        />
      </section>
    </>
  );
}
