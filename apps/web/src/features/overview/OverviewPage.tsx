import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Icon, StatusBadge, Card, EmptyState, Button } from "@fitos/ui";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { useBranch } from "../../app/branch-context";
import { PageLoading, ErrorNotice, formatDateTime } from "../shared";

const queryKeys = {
  members: (query: string) => ["members", query] as const,
  branches: ["branches"] as const,
  staff: ["staff"] as const,
  bookings: ["bookings"] as const,
  services: ["services"] as const,
  leads: ["leads"] as const,
  attendance: ["attendance"] as const
};

export function OverviewPage() {
  const { auth } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();

  const members = useQuery({
    queryKey: ["members", activeBranchId, "overview"],
    queryFn: () => api.members(new URLSearchParams({ branchId: activeBranchId, limit: "100" })),
    enabled: Boolean(activeBranchId)
  });

  const branches = useQuery({ queryKey: queryKeys.branches, queryFn: api.branches });

  const staff = useQuery({
    queryKey: queryKeys.staff,
    queryFn: api.staff,
    enabled: can(auth, "staff:read")
  });

  const bookings = useQuery({
    queryKey: ["bookings", activeBranchId, "overview"],
    queryFn: () => api.bookings(new URLSearchParams({ branchId: activeBranchId, limit: "100" })),
    enabled: can(auth, "booking:read")
  });

  const services = useQuery({
    queryKey: ["services", activeBranchId, "overview"],
    queryFn: () => api.servicesByBranch(activeBranchId),
    enabled: can(auth, "service:read")
  });

  const leads = useQuery({
    queryKey: ["leads", activeBranchId, "overview"],
    queryFn: () => api.leads(new URLSearchParams({ branchId: activeBranchId, limit: "100" })),
    enabled: can(auth, "lead:read")
  });

  const attendance = useQuery({
    queryKey: ["attendance", activeBranchId, "overview"],
    queryFn: () =>
      api.attendanceRecords(new URLSearchParams({ branchId: activeBranchId, limit: "100" })),
    enabled: can(auth, "attendance:read")
  });

  if (members.isLoading || branches.isLoading) return <PageLoading />;

  const totalMembers = members.data?.data.length ?? 0;
  const activeMembers = members.data?.data.filter((m) => m.status === "active").length ?? 0;
  const totalBookings = bookings.data?.data.length ?? 0;
  const totalServices = services.data?.length ?? 0;
  const totalStaff = staff.data?.length ?? 0;
  const totalBranches = branches.data?.length ?? 0;
  const totalLeads = leads.data?.data.length ?? 0;

  const todayFormatted = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date());

  return (
    <>
      {/* ── Page Header / Greeting ── */}
      <div className="page-header">
        <div className="page-header__left">
          <span className="page-header__eyebrow">Today at FITOS • {todayFormatted}</span>
          <h1>
            Welcome back,{" "}
            <span className="today-greeting__name">{auth?.user.displayName || "Admin"}</span>
          </h1>
          <p className="page-header__desc">
            Here is your live operational overview for {activeBranch?.name ?? "your business"}.
          </p>
        </div>

        <div className="page-header__actions">
          <Link className="fitos-button fitos-button--secondary" to="/app/bookings/new">
            <Icon name="calendar" size={16} />
            Book Class
          </Link>
          <Link className="fitos-button fitos-button--primary" to="/app/members/new">
            <Icon name="plus" size={16} />
            Add Member
          </Link>
        </div>
      </div>

      <ErrorNotice
        error={members.error ?? branches.error ?? staff.error ?? bookings.error ?? services.error}
      />

      {/* ── 6-Stat KPI Card Row (Design Truth: Screen 1) ── */}
      <section aria-label="Key Performance Indicators" className="kpi-grid">
        <div className="stat-card">
          <span className="stat-card__label">Members</span>
          <strong className="stat-card__value">{totalMembers}</strong>
          <span className="stat-card__delta stat-card__delta--up">
            <Icon name="spark" size={12} />
            {activeMembers} active
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Bookings</span>
          <strong className="stat-card__value">{totalBookings}</strong>
          <span className="stat-card__delta stat-card__delta--up">↑ 24% vs last 7 days</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Services</span>
          <strong className="stat-card__value">{totalServices}</strong>
          <span className="stat-card__delta stat-card__delta--neutral">Active programs</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Leads & CRM</span>
          <strong className="stat-card__value">{totalLeads}</strong>
          <span className="stat-card__delta stat-card__delta--up">In active funnel</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Team / Staff</span>
          <strong className="stat-card__value">{totalStaff || "—"}</strong>
          <span className="stat-card__delta stat-card__delta--neutral">Coaches & Admin</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Branches</span>
          <strong className="stat-card__value">{totalBranches}</strong>
          <span className="stat-card__delta stat-card__delta--neutral">Operating units</span>
        </div>
      </section>

      {/* ── Dashboard Main Grid ── */}
      <section className="dashboard-body">
        {/* ── Left Column: Recent Bookings & Services ── */}
        <div className="dashboard-col-left">
          {/* Recent Bookings Card */}
          <div className="fitos-card">
            <div className="card-header">
              <h2>Recent Bookings</h2>
              <Link className="card-link" to="/app/bookings">
                View all <Icon name="chevron-right" size={12} />
              </Link>
            </div>

            {bookings.data?.data && bookings.data.data.length > 0 ? (
              <div className="recent-bookings">
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Booked At</th>
                      <th>Source</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.data.data.slice(0, 5).map((b) => {
                      const member = members.data?.data.find((m) => m.id === b.memberId);
                      const name = member
                        ? `${member.firstName} ${member.lastName ?? ""}`.trim()
                        : `Member #${b.memberId.slice(0, 6)}`;
                      const initials = member
                        ? `${member.firstName[0]}${member.lastName ? member.lastName[0] : ""}`
                        : "MB";
                      return (
                        <tr key={b.id}>
                          <td>
                            <div className="member-cell">
                              <div className="member-cell__avatar">{initials}</div>
                              <span className="member-cell__name">{name}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                              {b.bookedAt ? formatDateTime(b.bookedAt) : "Recent"}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                fontSize: "0.78rem",
                                textTransform: "capitalize"
                              }}
                            >
                              {b.source.replace("_", " ")}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={b.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                action={
                  <Link className="fitos-button fitos-button--primary" to="/app/bookings/new">
                    <Icon name="calendar" size={16} />
                    Schedule first booking
                  </Link>
                }
                description="Bookings created by staff or members will appear here."
                title="No bookings recorded yet"
              />
            )}
          </div>

          {/* Recent Members Card */}
          <div className="fitos-card">
            <div className="card-header">
              <h2>Members Directory</h2>
              <Link className="card-link" to="/app/members">
                View all <Icon name="chevron-right" size={12} />
              </Link>
            </div>

            {members.data?.data && members.data.data.length > 0 ? (
              <ul className="activity-list">
                {members.data.data.slice(0, 5).map((member) => (
                  <li key={member.id}>
                    <Link
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.625rem",
                        textDecoration: "none"
                      }}
                      to={`/app/members/${member.id}`}
                    >
                      <div className="member-cell__avatar">
                        {member.firstName[0]}
                        {member.lastName ? member.lastName[0] : ""}
                      </div>
                      <div>
                        <strong style={{ color: "var(--text-primary)", display: "block" }}>
                          {member.firstName} {member.lastName ?? ""}
                        </strong>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                          {member.phone || member.email || "No contact info"}
                        </span>
                      </div>
                    </Link>
                    <StatusBadge status={member.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                action={
                  <Link className="fitos-button fitos-button--primary" to="/app/members/new">
                    <Icon name="plus" size={16} />
                    Add first member
                  </Link>
                }
                description="Start adding members to track workouts and memberships."
                title="No members yet"
              />
            )}
          </div>
        </div>

        {/* ── Right Column: Quick Actions & Live Feeds ── */}
        <div className="dashboard-col-right">
          {/* Quick Actions Panel */}
          <div className="fitos-card">
            <div className="card-header">
              <h2>Quick Actions</h2>
            </div>
            <ul className="quick-actions-list">
              <li>
                <Link className="quick-action-item" to="/app/members/new">
                  <div className="quick-action-item__icon">
                    <Icon name="plus" size={18} />
                  </div>
                  <div className="quick-action-item__info">
                    <span className="quick-action-item__label">Add New Member</span>
                    <span className="quick-action-item__desc">Create a new member profile</span>
                  </div>
                  <Icon className="quick-action-item__arrow" name="chevron-right" size={16} />
                </Link>
              </li>

              <li>
                <Link className="quick-action-item" to="/app/bookings/new">
                  <div className="quick-action-item__icon">
                    <Icon name="calendar" size={18} />
                  </div>
                  <div className="quick-action-item__info">
                    <span className="quick-action-item__label">Book a Class</span>
                    <span className="quick-action-item__desc">Schedule a class for a member</span>
                  </div>
                  <Icon className="quick-action-item__arrow" name="chevron-right" size={16} />
                </Link>
              </li>

              <li>
                <Link className="quick-action-item" to="/app/services">
                  <div className="quick-action-item__icon">
                    <Icon name="spark" size={18} />
                  </div>
                  <div className="quick-action-item__info">
                    <span className="quick-action-item__label">Services & Classes</span>
                    <span className="quick-action-item__desc">Manage classes and pricing</span>
                  </div>
                  <Icon className="quick-action-item__arrow" name="chevron-right" size={16} />
                </Link>
              </li>

              <li>
                <Link className="quick-action-item" to="/app/attendance">
                  <div className="quick-action-item__icon">
                    <Icon name="check" size={18} />
                  </div>
                  <div className="quick-action-item__info">
                    <span className="quick-action-item__label">Reception Check-in</span>
                    <span className="quick-action-item__desc">Front desk fast member check-in</span>
                  </div>
                  <Icon className="quick-action-item__arrow" name="chevron-right" size={16} />
                </Link>
              </li>
            </ul>
          </div>

          {/* Setup Progress / Activation Checklist */}
          <div className="fitos-card">
            <div className="card-header">
              <h2>Setup & Activation Progress</h2>
              <Link className="card-link" to="/onboarding">
                Resume <Icon name="chevron-right" size={12} />
              </Link>
            </div>

            <ul className="setup-list">
              <li className={branches.data?.length ? "is-done" : ""}>
                <Icon name={branches.data?.length ? "check" : "building"} size={16} />
                <span>Configure branch location</span>
              </li>
              <li className={services.data?.length ? "is-done" : ""}>
                <Icon name={services.data?.length ? "check" : "spark"} size={16} />
                <span>Add services & workout classes</span>
              </li>
              <li className={members.data?.data.length ? "is-done" : ""}>
                <Icon name={members.data?.data.length ? "check" : "users"} size={16} />
                <span>Create your first member</span>
              </li>
              <li className={bookings.data?.data.length ? "is-done" : ""}>
                <Icon name={bookings.data?.data.length ? "check" : "calendar"} size={16} />
                <span>Schedule recurring timetable & bookings</span>
              </li>
            </ul>

            <div style={{ marginTop: "1rem" }}>
              <div className="goal-item">
                <div className="goal-item__header">
                  <span className="goal-item__label">Completion</span>
                  <span className="goal-item__pct">
                    {Math.round(
                      (branches.data?.length ? 25 : 0) +
                        (services.data?.length ? 25 : 0) +
                        (members.data?.data.length ? 25 : 0) +
                        (bookings.data?.data.length ? 25 : 0)
                    )}
                    %
                  </span>
                </div>
                <div className="goal-bar">
                  <div
                    className="goal-bar__fill"
                    style={{
                      width: `${Math.round(
                        (branches.data?.length ? 25 : 0) +
                          (services.data?.length ? 25 : 0) +
                          (members.data?.data.length ? 25 : 0) +
                          (bookings.data?.data.length ? 25 : 0)
                      )}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
