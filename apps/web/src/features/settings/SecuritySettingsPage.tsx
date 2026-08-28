import { Link } from "react-router-dom";
import { Card, Icon, type IconName, PageHeader } from "@fitos/ui";

function SecurityTile({
  icon,
  title,
  children
}: {
  icon: IconName;
  title: string;
  children: string;
}) {
  return (
    <Card>
      <div className="security-tile__heading">
        <div className="security-tile__icon">
          <Icon name={icon} size={20} />
        </div>
        <h2>{title}</h2>
      </div>
      <p className="security-tile__body">{children}</p>
    </Card>
  );
}

export function SecuritySettingsPage() {
  return (
    <>
      <div className="settings-back-link">
        <Link className="text-link" to="/app/settings">
          <Icon name="arrow-left" size={14} /> Back to Settings
        </Link>
      </div>
      <PageHeader
        eyebrow="Settings · Protection"
        title="Security & Governance"
        description="FITOS enforces strict multi-tenant isolation, cryptographic session management, and server-side capability authorization."
      />
      <section className="settings-grid">
        <SecurityTile icon="key" title="Session Security">
          Authentication uses opaque, encrypted HttpOnly session cookies with CSRF defense. Signing
          out immediately invalidates and revokes the active session server-side.
        </SecurityTile>
        <SecurityTile icon="shield" title="Tenant Isolation">
          Every API route deterministically derives tenant, branch, and user scopes from verified
          credentials—never trusting client-supplied identifiers.
        </SecurityTile>
        <SecurityTile icon="warning" title="Operational Safety">
          All administrative overrides, member credit adjustments, and schedule mutations are
          recorded in an append-only audit trail with idempotency protections.
        </SecurityTile>
      </section>
    </>
  );
}
