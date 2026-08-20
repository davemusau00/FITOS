import { useQuery } from "@tanstack/react-query";
import { EmptyState, PageHeader, Icon, Card } from "@fitos/ui";
import { Link } from "react-router-dom";
import { StatusBadge } from "@fitos/ui";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { PageLoading, ErrorNotice } from "../shared";

const queryKeys = {
  members: (query: string) => ["members", query] as const,
  branches: ["branches"] as const,
  staff: ["staff"] as const
};

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "energy" }) {
  return (
    <Card className={`kpi ${tone ? "kpi--energy" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}

export function OverviewPage() {
  const { auth } = useAuth();
  const members = useQuery({
    queryKey: queryKeys.members(""),
    queryFn: () => api.members(new URLSearchParams())
  });
  const branches = useQuery({ queryKey: queryKeys.branches, queryFn: api.branches });
  const staff = useQuery({
    queryKey: queryKeys.staff,
    queryFn: api.staff,
    enabled: can(auth, "staff:read")
  });
  if (members.isLoading || branches.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader
        eyebrow="Today at FITOS"
        title="Overview"
        description="A clear starting point for your people, branches, and setup progress."
        actions={
          <Link className="fitos-button fitos-button--primary" to="/app/members/new">
            <Icon name="plus" size={16} />
            Add member
          </Link>
        }
      />
      <ErrorNotice error={members.error ?? branches.error ?? staff.error} />
      <section className="kpi-grid">
        <Kpi label="Total members" value={members.data?.data.length ?? 0} tone="energy" />
        <Kpi
          label="Active members"
          value={members.data?.data.filter((member) => member.status === "active").length ?? 0}
        />
        <Kpi label="Branches" value={branches.data?.length ?? 0} />
        <Kpi label="Staff" value={staff.data?.length ?? "—"} />
      </section>
      <section className="dashboard-grid">
        <Card>
          <h2>Recent members</h2>
          {members.data?.data.length ? (
            <ul className="activity-list">
              {members.data.data.slice(0, 5).map((member) => (
                <li key={member.id}>
                  <Link to={`/app/members/${member.id}`}>
                    <strong>
                      {member.firstName} {member.lastName}
                    </strong>
                    <span>{member.phone ?? "No phone"}</span>
                  </Link>
                  <StatusBadge status={member.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              action={
                <Link className="fitos-button fitos-button--primary" to="/app/members/new">
                  Add first member
                </Link>
              }
              description="Start with the people you serve."
              title="No members yet"
            />
          )}
        </Card>
        <Card>
          <h2>Setup progress</h2>
          <ul className="setup-list">
            <li className={branches.data?.length ? "is-done" : ""}>
              <Icon name="building" size={18} />
              Add your branch
            </li>
            <li className={members.data?.data.length ? "is-done" : ""}>
              <Icon name="users" size={18} />
              Create your first member
            </li>
            <li>
              <Icon name="calendar" size={18} />
              Configure services and schedules
            </li>
          </ul>
          <Link className="text-link" to="/onboarding">
            Continue setup <Icon name="chevron-right" size={16} />
          </Link>
        </Card>
      </section>
    </>
  );
}
