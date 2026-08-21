import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Icon, StatusBadge } from "@fitos/ui";
import { useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { FitosLogo } from "../../app/logo";
import { PageLoading, formatDateTime } from "../shared";

type MemberTab = "home" | "schedule" | "membership" | "attendance";

export function MemberPortalPage() {
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MemberTab>("home");
  const [selectedOccurrence, setSelectedOccurrence] = useState<string | null>(null);

  // Look up current member record
  const currentMember = useQuery({
    queryKey: ["member", "me"],
    queryFn: async () => {
      if (!auth) return null;
      const res = await api.members(new URLSearchParams({ query: auth.user.email ?? "", limit: "1" }));
      return res.data[0] ?? null;
    },
    enabled: Boolean(auth)
  });

  const memberId = currentMember.data?.id;

  const creditBalance = useQuery({
    queryKey: ["member", memberId ?? "", "credits", "balance"],
    queryFn: () => api.creditBalance(memberId!),
    enabled: Boolean(memberId)
  });

  const memberships = useQuery({
    queryKey: ["member", memberId ?? "", "memberships"],
    queryFn: () => api.memberMemberships(memberId!),
    enabled: Boolean(memberId)
  });

  const memberBookings = useQuery({
    queryKey: ["member", memberId ?? "", "bookings"],
    queryFn: () => api.bookings(new URLSearchParams({ memberId: memberId!, limit: "20" })),
    enabled: Boolean(memberId)
  });

  const occurrences = useQuery({
    queryKey: ["schedule", "portal"],
    queryFn: () => {
      const today = new Date().toISOString().split("T")[0]!;
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return api.scheduleOccurrences(
        new URLSearchParams({ from: today, to: nextWeek.toISOString().split("T")[0]!, limit: "50" })
      );
    }
  });

  const services = useQuery({ queryKey: ["services"], queryFn: api.services });
  const staff = useQuery({ queryKey: ["staff"], queryFn: api.staff });

  const bookClassMutation = useMutation({
    mutationFn: (occurrenceId: string) => {
      if (!memberId) throw new Error("Member profile not found.");
      return api.createBooking({
        occurrenceId,
        memberId
      });
    },
    onSuccess: () => {
      setSelectedOccurrence(null);
      void queryClient.invalidateQueries({ queryKey: ["member", memberId, "bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["member", memberId, "credits"] });
    }
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: string) => api.cancelBooking(bookingId, "Cancelled by member"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["member", memberId, "bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["member", memberId, "credits"] });
    }
  });

  if (!auth) return <Navigate replace to="/login" />;

  const activePlan = memberships.data?.find((m) => m.status === "active");
  const upcomingBookings = (memberBookings.data?.data ?? []).filter((b) => b.status === "confirmed");
  const pastBookings = (memberBookings.data?.data ?? []).filter((b) => b.status === "cancelled");

  return (
    <div className="member-portal-shell">
      {/* ── Member Topbar ── */}
      <header className="member-portal-topbar">
        <div className="member-portal-topbar__inner">
          <div className="member-portal-topbar__brand">
            <FitosLogo height={24} />
            <span className="member-portal-badge">Member Portal</span>
          </div>
          <div className="member-portal-topbar__user">
            <div className="member-portal-user-info">
              <strong>{auth.user.displayName || "Member"}</strong>
              <span>{activePlan ? activePlan.planSnapshot.name : "Free Account"}</span>
            </div>
            <button
              className="fitos-button fitos-button--ghost fitos-button--small"
              onClick={async () => {
                await signOut();
                navigate("/login", { replace: true });
              }}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Navigation Tabs ── */}
      <nav className="member-portal-nav">
        <div className="member-portal-nav__inner">
          {[
            { id: "home", label: "My Dashboard", icon: "dashboard" as const },
            { id: "schedule", label: "Book a Class", icon: "calendar" as const },
            { id: "membership", label: "My Membership", icon: "shield" as const },
            { id: "attendance", label: "Visit History", icon: "check" as const }
          ].map((tab) => (
            <button
              className={`member-portal-nav__tab${activeTab === tab.id ? " member-portal-nav__tab--active" : ""}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MemberTab)}
              type="button"
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Main Portal Body ── */}
      <main className="member-portal-content">
        {/* ── HOME TAB ── */}
        {activeTab === "home" && (
          <div className="form-stack">
            {/* Quick KPI stats */}
            <div className="kpi-grid">
              <Card className="kpi kpi--energy">
                <span>Available Credits</span>
                <strong>{creditBalance.data?.balance ?? 0}</strong>
              </Card>
              <Card className="kpi">
                <span>Upcoming Classes</span>
                <strong>{upcomingBookings.length}</strong>
              </Card>
              <Card className="kpi">
                <span>Active Plan</span>
                <strong style={{ fontSize: "1.1rem" }}>{activePlan ? activePlan.planSnapshot.name : "No Plan"}</strong>
              </Card>
            </div>

            {/* Next Upcoming Session */}
            <Card>
              <div className="section-header-row" style={{ marginTop: 0 }}>
                <h2>My Next Scheduled Class</h2>
                <button
                  className="fitos-button fitos-button--primary fitos-button--small"
                  onClick={() => setActiveTab("schedule")}
                  type="button"
                >
                  + Book More
                </button>
              </div>

              {upcomingBookings.length ? (
                <div className="member-portal-booking-card">
                  {upcomingBookings.map((b) => {
                    const occ = occurrences.data?.data.find((o) => o.id === b.occurrenceId);
                    const svc = services.data?.find((s) => s.id === occ?.serviceId);
                    return (
                      <div className="member-portal-booking-item" key={b.id}>
                        <div className="member-portal-booking-item__icon">
                          <Icon name="calendar" size={24} />
                        </div>
                        <div className="member-portal-booking-item__details">
                          <strong>{svc?.name ?? "Class Session"}</strong>
                          <span>{occ ? formatDateTime(occ.startsAt) : "Upcoming"}</span>
                        </div>
                        <StatusBadge status={b.status} />
                        <Button
                          loading={cancelBookingMutation.isPending}
                          onClick={() => cancelBookingMutation.mutate(b.id)}
                          size="small"
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="member-portal-empty">
                  <p>You have no upcoming class bookings.</p>
                  <Button onClick={() => setActiveTab("schedule")} variant="primary">
                    Browse Class Schedule
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── SCHEDULE / BOOKING TAB ── */}
        {activeTab === "schedule" && (
          <div className="form-stack">
            <Card>
              <h2>Available Classes &amp; Timetable</h2>
              <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
                Select any upcoming session below to reserve your spot instantly using your available credits.
              </p>

              {occurrences.isLoading ? (
                <PageLoading />
              ) : occurrences.data?.data.length ? (
                <div className="member-portal-schedule-grid">
                  {occurrences.data.data.map((occ) => {
                    const svc = services.data?.find((s) => s.id === occ.serviceId);
                    const trainer = staff.data?.find((u) => u.user.id === occ.trainerUserId);
                    const isBooked = upcomingBookings.some((b) => b.occurrenceId === occ.id);
                    const start = new Date(occ.startsAt);
                    return (
                      <div className="member-portal-class-item" key={occ.id}>
                        <div className="member-portal-class-item__time">
                          <strong>{start.toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })}</strong>
                          <span>{start.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="member-portal-class-item__info">
                          <h4>{svc?.name ?? "Class Session"}</h4>
                          <p>Trainer: {trainer?.user.displayName ?? "Instructor"} · {svc?.durationMinutes ?? 45} mins</p>
                        </div>
                        <div className="member-portal-class-item__action">
                          {isBooked ? (
                            <span className="member-booked-badge">
                              <Icon name="check" size={14} /> Booked
                            </span>
                          ) : (
                            <Button
                              disabled={(creditBalance.data?.balance ?? 0) <= 0}
                              loading={bookClassMutation.isPending && selectedOccurrence === occ.id}
                              onClick={() => {
                                setSelectedOccurrence(occ.id);
                                bookClassMutation.mutate(occ.id);
                              }}
                              size="small"
                              variant="primary"
                            >
                              {(creditBalance.data?.balance ?? 0) > 0 ? "Book Class" : "0 Credits Left"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">No classes scheduled for the coming week.</p>
              )}
            </Card>
          </div>
        )}

        {/* ── MEMBERSHIP TAB ── */}
        {activeTab === "membership" && (
          <div className="form-stack">
            <Card>
              <h2>My Membership &amp; Credit Balance</h2>
              {activePlan ? (
                <div className="member-portal-plan-card">
                  <div className="selected-entity-badge">
                    <div className="selected-entity-badge__info">
                      <Icon name="spark" size={24} />
                      <div>
                        <strong style={{ fontSize: "1.1rem" }}>{activePlan.planSnapshot.name}</strong>
                        <span>Valid until: {activePlan.endsAt ? new Date(activePlan.endsAt).toLocaleDateString() : "Ongoing"}</span>
                      </div>
                    </div>
                    <StatusBadge status={activePlan.status} />
                  </div>
                  <div className="kpi-grid" style={{ marginTop: "1rem" }}>
                    <Card className="kpi kpi--energy">
                      <span>Available Credits</span>
                      <strong>{creditBalance.data?.balance ?? 0}</strong>
                    </Card>
                    <Card className="kpi">
                      <span>Included Per Cycle</span>
                      <strong>{activePlan.planSnapshot.includedCredits}</strong>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="member-portal-empty">
                  <p>You currently do not have an active membership plan.</p>
                  <p className="muted" style={{ fontSize: "0.85rem" }}>
                    Please speak with gym front desk staff to activate a membership package.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── ATTENDANCE TAB ── */}
        {activeTab === "attendance" && (
          <Card>
            <h2>My Past Class Visits</h2>
            {pastBookings.length ? (
              <div className="member-portal-history-list">
                {pastBookings.map((b) => {
                  const occ = occurrences.data?.data.find((o) => o.id === b.occurrenceId);
                  const svc = services.data?.find((s) => s.id === occ?.serviceId);
                  return (
                    <div className="member-portal-history-item" key={b.id}>
                      <div>
                        <strong>{svc?.name ?? "Class Session"}</strong>
                        <span className="muted" style={{ fontSize: "0.82rem", display: "block" }}>
                          {occ ? formatDateTime(occ.startsAt) : "Past Session"}
                        </span>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No past attendance records found.</p>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
