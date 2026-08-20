import { Card, Icon, PageHeader } from "@fitos/ui";

export function SecuritySettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Security"
        description="FITOS uses secure, server-revocable sessions and server-side capabilities."
      />
      <section className="settings-grid">
        <Card>
          <Icon name="key" size={24} />
          <h2>Sessions</h2>
          <p>
            Authentication uses opaque HttpOnly session cookies. Sign out revokes the active session
            on the server.
          </p>
        </Card>
        <Card>
          <Icon name="shield" size={24} />
          <h2>Tenant isolation</h2>
          <p>
            Every API request resolves tenant and branch scope from the authenticated session—never
            from a browser-supplied tenant ID.
          </p>
        </Card>
        <Card>
          <Icon name="warning" size={24} />
          <h2>Operational safety</h2>
          <p>
            Privileged changes are written to an append-only audit log. Financial and booking
            controls are added in their domain slices.
          </p>
        </Card>
      </section>
    </>
  );
}
