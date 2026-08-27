import { Link } from "react-router-dom";
import { Card, Icon, PageHeader } from "@fitos/ui";

export function SecuritySettingsPage() {
  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <Link className="text-link" to="/app/settings">
          <Icon name="arrow-left" size={14} /> Back to Settings
        </Link>
      </div>

      <PageHeader
        eyebrow="Settings • Protection"
        title="Security & Governance"
        description="FITOS enforces strict multi-tenant isolation, cryptographic session management, and server-side capability authorization."
      />

      <section className="settings-grid">
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "0.75rem"
            }}
          >
            <div
              style={{
                background: "color-mix(in srgb, var(--fitos-energy) 15%, transparent)",
                borderRadius: "var(--radius-control)",
                color: "var(--fitos-energy)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "2.5rem",
                width: "2.5rem"
              }}
            >
              <Icon name="key" size={20} />
            </div>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Session Security</h2>
          </div>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              margin: 0
            }}
          >
            Authentication uses opaque, encrypted HttpOnly session cookies with CSRF defense.
            Signing out immediately invalidates and revokes the active session server-side.
          </p>
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "0.75rem"
            }}
          >
            <div
              style={{
                background: "color-mix(in srgb, var(--fitos-energy) 15%, transparent)",
                borderRadius: "var(--radius-control)",
                color: "var(--fitos-energy)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "2.5rem",
                width: "2.5rem"
              }}
            >
              <Icon name="shield" size={20} />
            </div>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Tenant Isolation</h2>
          </div>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              margin: 0
            }}
          >
            Every API route deterministically derives tenant, branch, and user scopes from verified
            credentials—never trusting client-supplied identifiers.
          </p>
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "0.75rem"
            }}
          >
            <div
              style={{
                background: "color-mix(in srgb, var(--fitos-energy) 15%, transparent)",
                borderRadius: "var(--radius-control)",
                color: "var(--fitos-energy)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "2.5rem",
                width: "2.5rem"
              }}
            >
              <Icon name="warning" size={20} />
            </div>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Operational Safety</h2>
          </div>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              margin: 0
            }}
          >
            All administrative overrides, member credit adjustments, and schedule mutations are
            recorded in an append-only audit trail with idempotency protections.
          </p>
        </Card>
      </section>
    </>
  );
}
