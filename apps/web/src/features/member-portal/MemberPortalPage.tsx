import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Icon, Modal, StatusBadge } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { FitosLogo } from "../../app/logo";
import { ErrorNotice, PageLoading, formatDateTime, useToast } from "../shared";

type MemberTab = "home" | "schedule" | "membership" | "attendance";

export function MemberPortalPage() {
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<MemberTab>("home");
  const [selectedOccurrence, setSelectedOccurrence] = useState<string | null>(null);
  const [cancellationTarget, setCancellationTarget] = useState<{
    id: string;
    serviceName: string;
    startsAt: string;
  } | null>(null);

  // Login form state for unauthenticated members
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<unknown>(null);

  // Check if member is logged in via dedicated member session
  const memberProfile = useQuery({
    queryKey: ["member-auth", "me"],
    queryFn: api.memberMe,
    retry: false
  });

  // Get member portal overview if logged in
  const portalOverview = useQuery({
    queryKey: ["member-auth", "overview"],
    queryFn: api.memberPortalOverview,
    enabled: Boolean(memberProfile.data)
  });

  const loginMutation = useMutation({
    mutationFn: () => api.memberLogin(identifier.trim(), password),
    onSuccess: () => {
      setLoginError(null);
      void queryClient.invalidateQueries({ queryKey: ["member-auth"] });
    },
    onError: (err) => setLoginError(err)
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.memberLogout(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["member-auth"] });
      setIdentifier("");
      setPassword("");
    }
  });

  const bookClassMutation = useMutation({
    mutationFn: (occurrenceId: string) => {
      if (!memberProfile.data) throw new Error("Please log in.");
      return api.memberBook(occurrenceId);
    },
    onSuccess: () => {
      toastSuccess("Class booked", "Your spot is confirmed.");
      setSelectedOccurrence(null);
      void queryClient.invalidateQueries({ queryKey: ["member-auth", "overview"] });
    },
    onError: (cause) =>
      toastError("Could not book class", cause instanceof Error ? cause.message : undefined)
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: string) => api.memberCancel(bookingId),
    onSuccess: (booking) => {
      toastSuccess(
        "Booking cancelled",
        booking.lateCancelled && booking.creditsDebited > 0
          ? "This was inside the cancellation window; the credit was not restored."
          : booking.creditsDebited > 0
            ? "Your credit was restored."
            : "No credit was charged for this booking."
      );
      void queryClient.invalidateQueries({ queryKey: ["member-auth", "overview"] });
    },
    onError: (cause) =>
      toastError("Could not cancel booking", cause instanceof Error ? cause.message : undefined)
  });

  // Loading state while verifying cookie session
  if (memberProfile.isLoading) return <PageLoading />;

  // ── UNLOGGED MEMBER SIGN-IN VIEW ──
  if (!memberProfile.data) {
    return (
      <div
        className="member-portal-shell"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh"
        }}
      >
        <div style={{ maxWidth: "26rem", width: "100%", padding: "1.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <FitosLogo height={32} />
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                marginTop: "1rem",
                marginBottom: "0.25rem"
              }}
            >
              Member Portal Sign In
            </h1>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Enter your phone number, member number, or email with your password.
            </p>
          </div>

          <Card>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                loginMutation.mutate();
              }}
            >
              <div className="form-group">
                <label className="fitos-label" htmlFor="member-ident">
                  Phone Number / Member # / Email
                </label>
                <input
                  autoFocus
                  className="fitos-control"
                  id="member-ident"
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. +254744444444 or GYM-0001"
                  required
                  value={identifier}
                />
              </div>

              <div className="form-group">
                <label className="fitos-label" htmlFor="member-password">
                  Password
                </label>
                <input
                  className="fitos-control"
                  id="member-password"
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  type="password"
                  value={password}
                />
              </div>

              <ErrorNotice error={loginError} />

              <Button fullWidth loading={loginMutation.isPending} variant="primary">
                Sign In to Member Portal
              </Button>
            </form>
          </Card>

          <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              Use the password created for your member account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const profile = memberProfile.data;
  const overview = portalOverview.data;
  const upcomingBookings = overview?.upcomingBookings ?? [];
  const recentAttendance = overview?.recentAttendance ?? [];

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
              <strong>
                {profile.firstName} {profile.lastName ?? ""}
              </strong>
              <span>
                #{profile.memberNumber ?? "—"} · {profile.activePlan?.name ?? "Pay As You Go"}
              </span>
            </div>
            <button
              className="fitos-button fitos-button--ghost fitos-button--small"
              onClick={() => logoutMutation.mutate()}
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
                <strong>{profile.creditBalance}</strong>
              </Card>
              <Card className="kpi">
                <span>Upcoming Classes</span>
                <strong>{upcomingBookings.length}</strong>
              </Card>
              <Card className="kpi">
                <span>Active Plan</span>
                <strong style={{ fontSize: "1.1rem" }}>
                  {profile.activePlan?.name ?? "Drop-in"}
                </strong>
              </Card>
            </div>

            {/* Next Upcoming Session */}
            <Card>
              <div className="section-header-row" style={{ marginTop: 0 }}>
                <h2>My Scheduled Sessions</h2>
                <button
                  className="fitos-button fitos-button--primary fitos-button--small"
                  onClick={() => setActiveTab("schedule")}
                  type="button"
                >
                  + Book a Class
                </button>
              </div>

              {upcomingBookings.length ? (
                <div className="member-portal-booking-card">
                  {upcomingBookings.map((b) => (
                    <div className="member-portal-booking-item" key={b.id}>
                      <div className="member-portal-booking-item__icon">
                        <Icon name="calendar" size={24} />
                      </div>
                      <div className="member-portal-booking-item__details">
                        <strong>{b.serviceName}</strong>
                        <span>{formatDateTime(b.startsAt)}</span>
                      </div>
                      <StatusBadge status={b.status} />
                      <Button
                        loading={cancelBookingMutation.isPending}
                        onClick={() =>
                          setCancellationTarget({
                            id: b.id,
                            serviceName: b.serviceName,
                            startsAt: b.startsAt
                          })
                        }
                        size="small"
                        variant="ghost"
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
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

        {cancellationTarget ? (
          <Modal
            description={`This will cancel ${cancellationTarget.serviceName} on ${formatDateTime(cancellationTarget.startsAt)}. Credit restoration is determined by the server cancellation policy.`}
            isOpen={true}
            onClose={() => setCancellationTarget(null)}
            title="Cancel booking?"
          >
            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <Button onClick={() => setCancellationTarget(null)} variant="ghost">
                Keep Booking
              </Button>
              <Button
                loading={cancelBookingMutation.isPending}
                onClick={() => {
                  cancelBookingMutation.mutate(cancellationTarget.id, {
                    onSuccess: () => setCancellationTarget(null)
                  });
                }}
                variant="danger"
              >
                Cancel Booking
              </Button>
            </div>
          </Modal>
        ) : null}

        {/* ── SCHEDULE / BOOKING TAB ── */}
        {activeTab === "schedule" && (
          <div className="form-stack">
            <Card>
              <h2>Available Classes &amp; Timetable</h2>
              <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
                Select any upcoming session below to reserve your spot instantly using your
                available credits ({profile.creditBalance} remaining).
              </p>

              {portalOverview.isLoading ? (
                <PageLoading />
              ) : overview?.bookableOccurrences.length ? (
                <div className="member-portal-schedule-grid">
                  {overview.bookableOccurrences.map((occ) => {
                    const isBooked = upcomingBookings.some((b) => b.occurrenceId === occ.id);
                    const eligibility = occ.bookingEligibility;
                    const start = new Date(occ.startsAt);
                    return (
                      <div className="member-portal-class-item" key={occ.id}>
                        <div className="member-portal-class-item__time">
                          <strong>
                            {start.toLocaleDateString("en-KE", {
                              weekday: "short",
                              month: "short",
                              day: "numeric"
                            })}
                          </strong>
                          <span>
                            {start.toLocaleTimeString("en-KE", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        <div className="member-portal-class-item__info">
                          <h4>Class Session</h4>
                          <p>Available session · reserve with credits</p>
                        </div>
                        <div className="member-portal-class-item__action">
                          {isBooked ? (
                            <span className="member-booked-badge">
                              <Icon name="check" size={14} /> Booked
                            </span>
                          ) : (
                            <Button
                              disabled={
                                eligibility ? !eligibility.canBook : profile.creditBalance <= 0
                              }
                              loading={bookClassMutation.isPending && selectedOccurrence === occ.id}
                              onClick={() => {
                                setSelectedOccurrence(occ.id);
                                bookClassMutation.mutate(occ.id);
                              }}
                              size="small"
                              variant="primary"
                            >
                              {eligibility?.reasonCode === "WAITLIST_ONLY"
                                ? "Join Waitlist"
                                : eligibility && !eligibility.canBook
                                  ? eligibility.message
                                  : "Book Class"}
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
              {profile.activePlan ? (
                <div className="member-portal-plan-card">
                  <div className="selected-entity-badge">
                    <div className="selected-entity-badge__info">
                      <Icon name="spark" size={24} />
                      <div>
                        <strong style={{ fontSize: "1.1rem" }}>{profile.activePlan.name}</strong>
                        <span>
                          Member #{profile.memberNumber ?? "—"} · Status: {profile.status}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={profile.status} />
                  </div>
                  <div className="kpi-grid" style={{ marginTop: "1rem" }}>
                    <Card className="kpi kpi--energy">
                      <span>Available Credits</span>
                      <strong>{profile.creditBalance}</strong>
                    </Card>
                    <Card className="kpi">
                      <span>Member Status</span>
                      <strong style={{ textTransform: "capitalize" }}>{profile.status}</strong>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="member-portal-empty">
                  <p>You currently do not have an active membership package.</p>
                  <p className="muted" style={{ fontSize: "0.85rem" }}>
                    Please speak with gym front desk staff to activate credits.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── ATTENDANCE TAB ── */}
        {activeTab === "attendance" && (
          <Card>
            <h2>My Visit &amp; Attendance History</h2>
            {recentAttendance.length ? (
              <div className="member-portal-history-list">
                {recentAttendance.map((a) => (
                  <div className="member-portal-history-item" key={a.id}>
                    <div>
                      <strong>{a.serviceName}</strong>
                      <span className="muted" style={{ fontSize: "0.82rem", display: "block" }}>
                        {formatDateTime(a.checkedInAt ?? a.createdAt)}
                      </span>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No past attendance records recorded yet.</p>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
