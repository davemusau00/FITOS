import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
  TextArea,
  WorkspacePage
} from "@fitos/ui";
import {
  PLATFORM_FEATURE_REGISTRY,
  SaaS_PLAN_QUOTAS,
  type ImplementationInquiryResponse
} from "@fitos/contracts";
import { api } from "../../lib/api/client";

function useDocumentTitle(title: string, description: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | FITOS`;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    const priorDescription = meta.content;
    meta.content = description;
    return () => {
      document.title = previous;
      if (meta) meta.content = priorDescription;
    };
  }, [description, title]);
}

const capabilityDescriptions: Record<string, string> = {
  "feature.crm": "Lead capture, pipelines, follow-ups, and member conversion.",
  "feature.insights": "Operational and growth reporting with branch and date context.",
  "feature.portal": "Member booking, schedule, membership, and progress experiences.",
  "feature.automations": "Persisted operational triggers, messages, outcomes, and retry.",
  "feature.assessments": "Protocols, results, provenance, retesting, and progress.",
  "feature.therapy": "Versioned protocols, safety checks, sessions, and outcomes.",
  "feature.inventory": "Stock, lots, suppliers, stocktakes, and session consumption.",
  "feature.equipment": "Assets, pools, maintenance, calibration, and capacity constraints.",
  "feature.sites": "Controlled tenant websites with preview and publishing.",
  "feature.integrations": "File imports and approved provider connections with provenance."
};

export function FeaturesPage() {
  useDocumentTitle("Features", "Explore the current and developing capabilities of FITOS.");
  return (
    <WorkspacePage className="marketing-content" density="consumer">
      <PageHeader
        eyebrow="FITOS capabilities"
        title="Everything your facility needs, honestly labelled."
        description="Core, specialist, and developing capabilities share one member, schedule, resource, and branch model."
      />
      <div className="marketing-card-grid">
        {PLATFORM_FEATURE_REGISTRY.map((feature) => (
          <Card key={feature.key}>
            <div className="marketing-card__topline">
              <Badge
                tone={
                  feature.maturity === "stable"
                    ? "success"
                    : feature.maturity === "beta"
                      ? "warning"
                      : "neutral"
                }
              >
                {feature.maturity}
              </Badge>
            </div>
            <h2>{feature.name}</h2>
            <p className="muted">{capabilityDescriptions[feature.key]}</p>
          </Card>
        ))}
      </div>
      <MarketingCta />
    </WorkspacePage>
  );
}

const solutionContent = {
  gyms: {
    title: "Gyms and multi-location clubs",
    description:
      "Unify daily operations across branches without turning every role into an administrator.",
    points: [
      "Branch-aware members, schedules, bookings, and attendance",
      "Command, Ops, Front Desk, and Coach workspaces",
      "Membership entitlements, CRM, automations, and Sites"
    ]
  },
  studios: {
    title: "Studios and class-led facilities",
    description:
      "Operate high-touch schedules where space, coaches, and equipment define capacity.",
    points: [
      "Recurring timetables and mobile agendas",
      "Waitlists and resource-aware booking",
      "Member self-service and controlled public booking"
    ]
  },
  performance: {
    title: "Performance labs",
    description: "Connect assessments, equipment, practitioners, and longitudinal progress.",
    points: [
      "Generic protocols and versioned metrics",
      "Manual and file import with provenance",
      "Batteries, retesting, review, and member-visible progress"
    ]
  },
  "rehab-wellness": {
    title: "Rehab, therapy, and wellness",
    description: "Coordinate appointments, protocols, safety checks, equipment, and follow-up.",
    points: [
      "Practice workspace for practitioners",
      "Versioned therapy protocols and session parameters",
      "Consent links, checklists, outcomes, and inventory consumption"
    ]
  }
} as const;

export function SolutionsPage() {
  const { solution } = useParams();
  const selected =
    solution && solution in solutionContent
      ? solutionContent[solution as keyof typeof solutionContent]
      : null;
  useDocumentTitle(
    selected?.title ?? "Solutions",
    selected?.description ?? "FITOS solutions for modern fitness and wellness facilities."
  );
  if (selected) return <SolutionDetail content={selected} />;
  return (
    <WorkspacePage className="marketing-content" density="consumer">
      <PageHeader
        eyebrow="Built around your operation"
        title="Purpose-built workspaces. One shared operating system."
        description="Choose your facility model to see how FITOS connects the people, resources, and workflows that matter most."
      />
      <div className="marketing-card-grid">
        {Object.entries(solutionContent).map(([slug, item]) => (
          <Card key={slug}>
            <h2>{item.title}</h2>
            <p className="muted">{item.description}</p>
            <Link
              className="fitos-button fitos-button--secondary fitos-button--small"
              to={`/solutions/${slug}`}
            >
              Explore solution
            </Link>
          </Card>
        ))}
      </div>
      <MarketingCta />
    </WorkspacePage>
  );
}

function SolutionDetail({
  content
}: {
  content: (typeof solutionContent)[keyof typeof solutionContent];
}) {
  return (
    <WorkspacePage className="marketing-content" density="consumer">
      <PageHeader
        eyebrow="FITOS solution"
        title={content.title}
        description={content.description}
        actions={
          <Link className="fitos-button fitos-button--primary" to="/configure">
            Build your setup plan
          </Link>
        }
      />
      <Card>
        <h2>What FITOS connects</h2>
        <ul className="marketing-check-list">
          {content.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </Card>
      <MarketingCta />
    </WorkspacePage>
  );
}

const stableCapabilities = PLATFORM_FEATURE_REGISTRY.filter(
  (feature) => feature.maturity === "stable"
).map((feature) => feature.name);
const plans = [
  {
    key: "starter",
    name: "Starter",
    summary: "Core member, booking, attendance, and site workflows for a focused facility.",
    capabilities: stableCapabilities
  },
  {
    key: "pro",
    name: "Pro",
    summary: "Multi-workspace operations with room to request beta and specialist capabilities.",
    capabilities: stableCapabilities
  },
  {
    key: "business",
    name: "Business",
    summary: "Higher limits for growing organizations; advanced workflows remain capability-gated.",
    capabilities: stableCapabilities
  }
] as const;

export function PricingPage() {
  useDocumentTitle(
    "Plans",
    "Compare FITOS plans and operational limits without payment collection."
  );
  return (
    <WorkspacePage className="marketing-content" density="consumer">
      <PageHeader
        eyebrow="Plans without hidden promises"
        title="Choose the operating scope that fits today."
        description="Plans define capabilities and usage limits. Payment collection and live billing are intentionally not part of this release."
      />
      <div className="marketing-plan-grid">
        {plans.map((plan) => {
          const quota = SaaS_PLAN_QUOTAS[plan.key];
          return (
            <Card
              className={
                plan.key === "pro" ? "marketing-plan-card is-featured" : "marketing-plan-card"
              }
              key={plan.key}
            >
              <Badge tone={plan.key === "pro" ? "success" : "neutral"}>{plan.name}</Badge>
              <h2>{plan.summary}</h2>
              <ul className="marketing-check-list">
                {plan.capabilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="muted">
                Up to {quota.maxBranches} branches · {quota.maxStaff.toLocaleString()} staff ·{" "}
                {quota.maxMembers.toLocaleString()} active members
              </p>
              <Link className="fitos-button fitos-button--primary fitos-button--full" to="/signup">
                Start with {plan.name}
              </Link>
            </Card>
          );
        })}
      </div>
      <Alert title="No payment required" tone="info">
        Starting FITOS creates a trial workspace. Plan discussions and changes are handled without
        checkout in this phase.
      </Alert>
    </WorkspacePage>
  );
}

export function ContactPage() {
  useDocumentTitle("Talk to FITOS", "Send the FITOS team a short implementation inquiry.");
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<ImplementationInquiryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    contactName: "",
    businessName: "",
    email: "",
    phone: "",
    message:
      searchParams.get("reason") === "plan-review"
        ? "I would like a FITOS plan and capability review. Our expected branches, members, and workflows are: "
        : ""
  });
  const canSubmit = useMemo(
    () =>
      values.contactName.trim() &&
      values.businessName.trim() &&
      values.email.includes("@") &&
      values.message.trim(),
    [values]
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    void api
      .submitImplementationInquiry({
        contactName: values.contactName,
        businessName: values.businessName,
        email: values.email,
        phone: values.phone || undefined,
        payload: { source: "marketing_contact", message: values.message }
      })
      .then(setResult)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Unable to submit your inquiry.")
      )
      .finally(() => setSubmitting(false));
  };
  if (result)
    return (
      <WorkspacePage className="marketing-content" density="consumer">
        <Alert title="Your inquiry is with the FITOS team" tone="success">
          Reference {result.id}. We have preserved the business context you submitted.
        </Alert>
        <MarketingCta />
      </WorkspacePage>
    );
  return (
    <WorkspacePage className="marketing-content" density="consumer">
      <PageHeader
        eyebrow="Talk to FITOS"
        title="Tell us what your operation needs."
        description="Use this short route for a conversation, or open the detailed configuration brief when you are ready to map branches, services, equipment, and data."
      />
      <div className="marketing-contact-grid">
        <Card>
          <form className="form-stack" onSubmit={submit}>
            <FormField htmlFor="contact-name" label="Your name">
              <Input
                id="contact-name"
                required
                value={values.contactName}
                onChange={(event) => setValues({ ...values, contactName: event.target.value })}
              />
            </FormField>
            <FormField htmlFor="contact-business" label="Business">
              <Input
                id="contact-business"
                required
                value={values.businessName}
                onChange={(event) => setValues({ ...values, businessName: event.target.value })}
              />
            </FormField>
            <FormField htmlFor="contact-email" label="Email">
              <Input
                id="contact-email"
                required
                type="email"
                value={values.email}
                onChange={(event) => setValues({ ...values, email: event.target.value })}
              />
            </FormField>
            <FormField htmlFor="contact-phone" label="Phone or WhatsApp" optional>
              <Input
                id="contact-phone"
                value={values.phone}
                onChange={(event) => setValues({ ...values, phone: event.target.value })}
              />
            </FormField>
            <FormField htmlFor="contact-message" label="What should FITOS solve?">
              <TextArea
                id="contact-message"
                required
                value={values.message}
                onChange={(event) => setValues({ ...values, message: event.target.value })}
              />
            </FormField>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Button disabled={!canSubmit} loading={submitting} type="submit">
              Send inquiry
            </Button>
          </form>
        </Card>
        <Card>
          <h2>Ready for a detailed brief?</h2>
          <p className="muted">
            The guided configuration flow captures branches, services, memberships, specialist
            equipment, migration needs, and launch priorities.
          </p>
          <Link className="fitos-button fitos-button--secondary" to="/configure">
            Configure FITOS
          </Link>
        </Card>
      </div>
    </WorkspacePage>
  );
}

function MarketingCta() {
  return (
    <section className="marketing-cta">
      <div>
        <p className="fitos-page-header__eyebrow">Your next step</p>
        <h2>Map FITOS to the way your facility actually works.</h2>
        <p>Start a workspace immediately or build an assisted implementation brief.</p>
      </div>
      <div>
        <Link className="fitos-button fitos-button--primary" to="/configure">
          Configure FITOS
        </Link>
        <Link className="fitos-button fitos-button--secondary" to="/signup">
          Start FITOS
        </Link>
      </div>
    </section>
  );
}
