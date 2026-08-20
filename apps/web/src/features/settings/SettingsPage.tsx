import { Link } from "react-router-dom";
import { Icon, PageHeader } from "@fitos/ui";

function SettingsLink({
  icon,
  title,
  description,
  to
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link className="settings-link" to={to}>
      <Icon name={icon} size={22} />
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

export function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Control center"
        title="Settings"
        description="Configure the organization, branches, people, and security rules behind your daily operations."
      />
      <section className="settings-grid">
        <SettingsLink
          icon="building"
          title="Organization"
          description="Name, timezone, and currency"
          to="/app/settings/organization"
        />
        <SettingsLink
          icon="building"
          title="Branches"
          description="Locations and operational context"
          to="/app/settings/branches"
        />
        <SettingsLink
          icon="team"
          title="Team & permissions"
          description="Roles and branch access"
          to="/app/settings/team"
        />
        <SettingsLink
          icon="shield"
          title="Security"
          description="Sessions and safe operation"
          to="/app/settings/security"
        />
      </section>
    </>
  );
}
