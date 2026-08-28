import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  FormField,
  Icon,
  Modal,
  Skeleton,
  StatusBadge
} from "@fitos/ui";
import type {
  AttendanceRecordResponse,
  BookingResponse,
  BranchResponse,
  CreditLedgerEntryResponse,
  MemberResponse,
  MembershipPlanResponse,
  PaymentTransactionResponse
} from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { branchQueryKeys } from "../../lib/query-keys";
import { ErrorNotice, PageLoading, formatCurrency, formatDate, formatDateTime } from "../shared";

type Tab =
  | "overview"
  | "bookings"
  | "attendance"
  | "credits"
  | "timeline"
  | "followups"
  | "performance"
  | "assessments"
  | "therapy";

type MemberFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  homeBranchId: string;
};

function toMemberPayload(values: MemberFormValues) {
  return {
    contact: {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      dateOfBirth: values.dateOfBirth || null
    },
    homeBranchId: values.homeBranchId
  };
}

const MEMBER_TAGS = ["High Value", "Personal Training", "Early Adopter", "At Risk", "VIP"];

export function MemberDetailPage() {
  const { auth } = useAuth();
  const { memberId } = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [isActivatingMembership, setIsActivatingMembership] = useState(false);
  const [isAdjustingCredits, setIsAdjustingCredits] = useState(false);
  const [noteInput, setNoteInput] = useState("");

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const member = useQuery({
    queryKey: ["member", memberId ?? ""],
    queryFn: () => api.member(memberId!),
    enabled: Boolean(memberId)
  });
  const timeline = useQuery({
    queryKey: ["member", memberId ?? "", "timeline"],
    queryFn: () => api.memberTimeline(memberId!),
    enabled: Boolean(memberId)
  });
  const memberships = useQuery({
    queryKey: ["member", memberId ?? "", "memberships"],
    queryFn: () => api.memberMemberships(memberId!),
    enabled: Boolean(memberId)
  });
  const creditLedger = useQuery({
    queryKey: ["member", memberId ?? "", "credits"],
    queryFn: () => api.creditLedger(memberId!),
    enabled: Boolean(memberId)
  });
  const creditBalance = useQuery({
    queryKey: ["member", memberId ?? "", "credits", "balance"],
    queryFn: () => api.creditBalance(memberId!),
    enabled: Boolean(memberId)
  });
  const plans = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => api.membershipPlans()
  });
  const bookings = useQuery({
    queryKey: ["member", memberId ?? "", "bookings"],
    queryFn: () => api.bookings(new URLSearchParams({ memberId: memberId!, limit: "100" })),
    enabled: Boolean(memberId) && can(auth, "booking:read")
  });
  const payments = useQuery({
    queryKey: ["member", memberId ?? "", "payments"],
    queryFn: () => api.payments(new URLSearchParams({ memberId: memberId!, limit: "100" })),
    enabled: Boolean(memberId) && can(auth, "payment:read")
  });
  const attendance = useQuery({
    queryKey: ["member", memberId ?? "", "attendance"],
    queryFn: () =>
      api.attendanceRecords(new URLSearchParams({ memberId: memberId!, limit: "100" })),
    enabled: Boolean(memberId) && can(auth, "attendance:read")
  });
  const occurrences = useQuery({
    queryKey: ["schedule", "member-profile-lookup"],
    queryFn: () => api.scheduleOccurrences(new URLSearchParams({ limit: "100" })),
    enabled: Boolean(memberId) && can(auth, "booking:read")
  });
  const services = useQuery({
    queryKey: ["services", "member-profile-lookup"],
    queryFn: api.services,
    enabled: Boolean(memberId) && can(auth, "booking:read")
  });

  const activeMembership = memberships.data?.find((m) => m.status === "active");
  const pausedMembership = memberships.data?.find((m) => m.status === "paused");
  const currentMembership = activeMembership ?? pausedMembership;
  const totalVisits = attendance.data?.data.length ?? 0;
  const totalBookings = bookings.data?.data.length ?? 0;

  const cancelMembershipMutation = useMutation({
    mutationFn: (membershipId: string) =>
      api.cancelMembership(memberId!, membershipId, "Cancelled by staff"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["member", memberId, "memberships"] });
      void queryClient.invalidateQueries({ queryKey: ["member", memberId, "credits"] });
    }
  });
  const membershipLifecycleMutation = useMutation({
    mutationFn: ({ membershipId, action }: { membershipId: string; action: "hold" | "resume" }) =>
      action === "hold"
        ? api.holdMembership(memberId!, membershipId)
        : api.resumeMembership(memberId!, membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["member", memberId, "memberships"] });
      void queryClient.invalidateQueries({ queryKey: ["member", memberId, "credits"] });
    }
  });
  const renewMembershipMutation = useMutation({
    mutationFn: (membershipId: string) => api.renewMembership(memberId!, membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["member", memberId, "memberships"] });
      void queryClient.invalidateQueries({ queryKey: ["member", memberId, "credits"] });
    }
  });

  const creditColumns: DataTableColumn<CreditLedgerEntryResponse>[] = [
    {
      id: "delta",
      header: "Movement",
      cell: (e) => (
        <strong style={{ color: e.delta > 0 ? "var(--success)" : "var(--danger)" }}>
          {e.delta > 0 ? `+${e.delta}` : e.delta} credit{Math.abs(e.delta) === 1 ? "" : "s"}
        </strong>
      )
    },
    {
      id: "reason",
      header: "Reason",
      cell: (e) => <StatusBadge status={e.reason} />
    },
    {
      id: "note",
      header: "Description / Reference",
      cell: (e) => e.note ?? (e.bookingId ? `Booking ref: ${e.bookingId.slice(0, 8)}` : "—")
    },
    {
      id: "date",
      header: "Date & Time",
      cell: (e) => formatDateTime(e.createdAt)
    }
  ];

  const bookingColumns: DataTableColumn<BookingResponse>[] = [
    {
      id: "session",
      header: "Session",
      cell: (booking) => {
        const occurrence = occurrences.data?.data.find((item) => item.id === booking.occurrenceId);
        const service = services.data?.find((item) => item.id === occurrence?.serviceId);
        return (
          <div>
            <strong className="fitos-data-table__primary">
              {booking.serviceName ?? service?.name ?? "Class session"}
            </strong>
            <span className="fitos-data-table__muted">
              {occurrence ? formatDateTime(occurrence.startsAt) : booking.occurrenceId.slice(0, 8)}
            </span>
          </div>
        );
      }
    },
    { id: "status", header: "Status", cell: (booking) => <StatusBadge status={booking.status} /> },
    {
      id: "credits",
      header: "Credits",
      cell: (booking) => (booking.creditsDebited ? `-${booking.creditsDebited}` : "None")
    },
    { id: "booked", header: "Booked", cell: (booking) => formatDateTime(booking.bookedAt) }
  ];

  const paymentColumns: DataTableColumn<PaymentTransactionResponse>[] = [
    {
      id: "amount",
      header: "Amount",
      cell: (payment) => formatCurrency(payment.amount.amountMinor, payment.amount.currency)
    },
    { id: "method", header: "Method", cell: (payment) => <StatusBadge status={payment.method} /> },
    {
      id: "allocation",
      header: "Allocation",
      cell: (payment) => payment.allocationType ?? "Unallocated"
    },
    { id: "status", header: "Status", cell: (payment) => <StatusBadge status={payment.status} /> },
    {
      id: "recorded",
      header: "Recorded",
      cell: (payment) => formatDateTime(payment.recordedAt)
    }
  ];

  const attendanceColumns: DataTableColumn<AttendanceRecordResponse>[] = [
    {
      id: "visit",
      header: "Visit / Class",
      cell: (record) => {
        const occurrence = occurrences.data?.data.find((item) => item.id === record.occurrenceId);
        const service = services.data?.find((item) => item.id === occurrence?.serviceId);
        return occurrence
          ? `${service?.name ?? "Class"} · ${formatDateTime(occurrence.startsAt)}`
          : "General visit";
      }
    },
    { id: "status", header: "Status", cell: (record) => <StatusBadge status={record.status} /> },
    {
      id: "checkin",
      header: "Checked in",
      cell: (record) => (record.checkedInAt ? formatDateTime(record.checkedInAt) : "—")
    }
  ];

  const tabs: {
    id: Tab;
    label: string;
    icon: "dashboard" | "calendar" | "check" | "spark" | "users";
  }[] = [
    { id: "overview", label: "Overview", icon: "dashboard" },
    { id: "bookings", label: "Bookings", icon: "calendar" },
    { id: "attendance", label: "Attendance", icon: "check" },
    { id: "credits", label: "Credits & Payments", icon: "spark" },
    { id: "performance", label: "Performance", icon: "spark" },
    { id: "assessments", label: "Assessments", icon: "spark" },
    { id: "therapy", label: "Therapy", icon: "spark" },
    { id: "timeline", label: "Activity", icon: "dashboard" },
    { id: "followups", label: "CRM Follow-ups", icon: "users" }
  ];

  if (!memberId) return <Navigate replace to="/app/members" />;
  if (member.isLoading || branches.isLoading) return <PageLoading />;
  if (member.error || !member.data) return <ErrorNotice error={member.error} />;

  const fullName = `${member.data.contact.firstName} ${member.data.contact.lastName ?? ""}`.trim();
  const initials = [member.data.contact.firstName[0], member.data.contact.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* CRM Profile Header */}
      <div className="member-profile-header">
        <div className="member-profile-header__inner">
          {/* Avatar */}
          <div className="member-avatar member-avatar--lg">
            <span>{initials}</span>
          </div>

          {/* Identity */}
          <div className="member-profile-header__identity">
            <div className="member-profile-header__name-row">
              <h1 className="member-profile-header__name">{fullName}</h1>
              <StatusBadge status={member.data.status} />
              {activeMembership && (
                <span className="member-tag member-tag--plan">
                  {activeMembership.planSnapshot.name}
                </span>
              )}
            </div>
            <div className="member-profile-header__meta">
              {member.data.contact.phone && (
                <span>
                  <Icon name="users" size={13} />
                  {member.data.contact.phone}
                </span>
              )}
              {member.data.contact.email && (
                <span>
                  <Icon name="users" size={13} />
                  {member.data.contact.email}
                </span>
              )}
              <span>
                <Icon name="calendar" size={13} />
                Joined {formatDate(member.data.joinedAt)}
              </span>
              {member.data.memberNumber && (
                <span className="member-profile-header__number">#{member.data.memberNumber}</span>
              )}
            </div>

            {/* Tags */}
            <div className="member-tags">
              {MEMBER_TAGS.slice(0, 2).map((tag) => (
                <span className="member-tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Lifetime KPI Stats */}
          <div className="member-profile-header__kpis">
            <div className="member-stat">
              <strong>{totalVisits}</strong>
              <span>Total Visits</span>
            </div>
            <div className="member-stat">
              <strong>{totalBookings}</strong>
              <span>Bookings</span>
            </div>
            <div className="member-stat">
              <strong>{creditBalance.data?.balance ?? 0}</strong>
              <span>Credits Left</span>
            </div>
            <div className="member-stat">
              <strong>{activeMembership ? "Active" : "None"}</strong>
              <span>Membership</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="member-profile-header__actions">
            {can(auth, "membership:manage") && !activeMembership ? (
              <Button icon="plus" onClick={() => setIsActivatingMembership(true)} size="small">
                Assign Plan
              </Button>
            ) : null}
            {activeMembership && can(auth, "membership:override") ? (
              <Button onClick={() => setIsAdjustingCredits(true)} size="small" variant="secondary">
                Adjust Credits
              </Button>
            ) : null}
            <Button icon="edit" onClick={() => setEditing((v) => !v)} size="small" variant="ghost">
              {editing ? "Cancel Edit" : "Edit"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="member-tab-bar">
        {tabs.map((tab) => (
          <button
            className={`member-tab-bar__tab${activeTab === tab.id ? " member-tab-bar__tab--active" : ""}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <Icon name={tab.icon as Parameters<typeof Icon>[0]["name"]} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="member-tab-content">
        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="member-overview-grid">
            {/* Contact Info */}
            <Card>
              <h2>Contact &amp; Identity</h2>
              <dl className="detail-list">
                <div>
                  <dt>Phone</dt>
                  <dd>{member.data.contact.phone ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{member.data.contact.email ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Date of birth</dt>
                  <dd>
                    {member.data.contact.dateOfBirth
                      ? formatDate(member.data.contact.dateOfBirth)
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Home branch</dt>
                  <dd>
                    {branches.data?.find((branch) => branch.id === member.data?.homeBranchId)
                      ?.name ?? "Not assigned"}
                  </dd>
                </div>
                <div>
                  <dt>Member number</dt>
                  <dd>{member.data.memberNumber ?? "Assigned later"}</dd>
                </div>
              </dl>
            </Card>

            {/* Active Membership */}
            <Card>
              <div className="section-header-row" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                <h2>Active Membership</h2>
                <div className="form-actions">
                  {currentMembership && can(auth, "membership:manage") ? (
                    <>
                      <Button
                        disabled={renewMembershipMutation.isPending}
                        onClick={() => renewMembershipMutation.mutate(currentMembership.id)}
                        size="small"
                        variant="ghost"
                      >
                        Renew Plan
                      </Button>
                      <Button
                        disabled={membershipLifecycleMutation.isPending}
                        onClick={() =>
                          membershipLifecycleMutation.mutate({
                            membershipId: currentMembership.id,
                            action: currentMembership.status === "paused" ? "resume" : "hold"
                          })
                        }
                        size="small"
                        variant="ghost"
                      >
                        {currentMembership.status === "paused" ? "Resume Plan" : "Hold Plan"}
                      </Button>
                      <Button
                        disabled={cancelMembershipMutation.isPending}
                        onClick={() => cancelMembershipMutation.mutate(currentMembership.id)}
                        size="small"
                        variant="ghost"
                      >
                        Cancel Plan
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              {currentMembership ? (
                <div className="form-stack">
                  <div className="selected-entity-badge">
                    <div className="selected-entity-badge__info">
                      <Icon name="spark" size={20} />
                      <div>
                        <strong>{currentMembership.planSnapshot.name}</strong>
                        <span>
                          Valid until: {formatDate(currentMembership.endsAt)} · Started:{" "}
                          {formatDate(currentMembership.startsAt)}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={currentMembership.status} />
                  </div>

                  <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                    <Card className="kpi kpi--energy">
                      <span>Available credits</span>
                      <strong>{creditBalance.data?.balance ?? 0}</strong>
                    </Card>
                    <Card className="kpi">
                      <span>Total included</span>
                      <strong>{currentMembership.planSnapshot.includedCredits}</strong>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="empty-membership-box">
                  <p className="muted">No active membership plan currently assigned.</p>
                  {can(auth, "membership:manage") ? (
                    <Button
                      icon="plus"
                      onClick={() => setIsActivatingMembership(true)}
                      size="small"
                      variant="secondary"
                    >
                      Assign plan
                    </Button>
                  ) : null}
                </div>
              )}
            </Card>

            {/* Retention Workflow */}
            <Card>
              <h2>Retention Stage</h2>
              <div className="retention-stages">
                {["Active", "At Risk", "Lapsed", "Churned", "Re-engaged"].map((stage, i) => (
                  <div
                    className={`retention-stage${i === 0 ? " retention-stage--current" : ""}`}
                    key={stage}
                  >
                    <span className="retention-stage__dot" />
                    <span>{stage}</span>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}>
                Last visit:{" "}
                {attendance.data?.data[0]?.checkedInAt
                  ? formatDate(attendance.data.data[0].checkedInAt)
                  : "Unknown"}
              </p>
            </Card>

            {/* Quick Notes */}
            <Card>
              <h2>Staff Notes</h2>
              <div className="form-stack">
                <div className="form-actions">
                  <input
                    className="fitos-control"
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add a quick note about this member…"
                    value={noteInput}
                  />
                  <Button
                    disabled={!noteInput.trim()}
                    onClick={() => setNoteInput("")}
                    size="small"
                  >
                    Save
                  </Button>
                </div>
                <p className="muted" style={{ fontSize: "0.8rem" }}>
                  Notes are visible to all staff with member read access.
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* ── BOOKINGS TAB ── */}
        {activeTab === "bookings" && (
          <div className="form-stack">
            {can(auth, "booking:read") ? (
              <Card className="detail-editor">
                <div className="section-header-row" style={{ marginTop: 0 }}>
                  <h2>Booking History</h2>
                  <Link
                    className="fitos-button fitos-button--secondary fitos-button--small"
                    to={`/app/bookings/new?memberId=${memberId}`}
                  >
                    <Icon name="plus" size={14} />
                    New Booking
                  </Link>
                </div>
                {bookings.isLoading || occurrences.isLoading || services.isLoading ? (
                  <Skeleton height="6rem" />
                ) : bookings.data?.data.length ? (
                  <DataTable
                    columns={bookingColumns}
                    data={bookings.data.data}
                    label="Member Bookings"
                    mobileRenderer={(booking) => {
                      const occurrence = occurrences.data?.data.find(
                        (item) => item.id === booking.occurrenceId
                      );
                      const service = services.data?.find(
                        (item) => item.id === occurrence?.serviceId
                      );
                      return (
                        <Card className="fitos-mobile-data-card">
                          <strong className="fitos-data-table__primary">
                            {booking.serviceName ?? service?.name ?? "Class session"}
                          </strong>
                          <span className="fitos-data-table__muted">
                            {occurrence
                              ? formatDateTime(occurrence.startsAt)
                              : "Session time unavailable"}
                          </span>
                          <div className="fitos-mobile-data-card__meta">
                            <StatusBadge status={booking.status} />
                            <span>
                              {booking.creditsDebited
                                ? `-${booking.creditsDebited} credits`
                                : "No credits debited"}
                            </span>
                          </div>
                        </Card>
                      );
                    }}
                  />
                ) : (
                  <p className="muted">No bookings recorded for this member.</p>
                )}
              </Card>
            ) : (
              <p className="muted">You don't have permission to view bookings.</p>
            )}
          </div>
        )}

        {/* ── ATTENDANCE TAB ── */}
        {activeTab === "attendance" && (
          <div className="form-stack">
            {can(auth, "attendance:read") ? (
              <Card className="detail-editor">
                <h2>Attendance History</h2>
                {attendance.isLoading ? (
                  <Skeleton height="6rem" />
                ) : attendance.data?.data.length ? (
                  <DataTable
                    columns={attendanceColumns}
                    data={attendance.data.data}
                    label="Member Attendance"
                  />
                ) : (
                  <p className="muted">No attendance recorded for this member.</p>
                )}
              </Card>
            ) : (
              <p className="muted">You don't have permission to view attendance.</p>
            )}
          </div>
        )}

        {/* ── CREDITS & PAYMENTS TAB ── */}
        {activeTab === "credits" && (
          <div className="form-stack">
            <Card className="detail-editor">
              <div className="section-header-row" style={{ marginTop: 0 }}>
                <h2>Credit Ledger</h2>
                {activeMembership && can(auth, "membership:override") ? (
                  <Button
                    onClick={() => setIsAdjustingCredits(true)}
                    size="small"
                    variant="secondary"
                  >
                    Adjust Credits
                  </Button>
                ) : null}
              </div>
              {creditLedger.isLoading ? (
                <Skeleton height="6rem" />
              ) : creditLedger.data?.length ? (
                <DataTable columns={creditColumns} data={creditLedger.data} label="Credit Ledger" />
              ) : (
                <p className="muted">No credit movements recorded yet.</p>
              )}
            </Card>

            {can(auth, "payment:read") ? (
              <Card className="detail-editor">
                <h2>Payment History</h2>
                {payments.isLoading ? (
                  <Skeleton height="6rem" />
                ) : payments.data?.data.length ? (
                  <DataTable
                    columns={paymentColumns}
                    data={payments.data.data}
                    label="Member Payments"
                    mobileRenderer={(payment) => (
                      <Card className="fitos-mobile-data-card">
                        <strong className="fitos-data-table__primary">
                          {formatCurrency(payment.amount.amountMinor, payment.amount.currency)}
                        </strong>
                        <span className="fitos-data-table__muted">
                          {payment.method.replace("_", " ")} · {formatDateTime(payment.recordedAt)}
                        </span>
                        <div className="fitos-mobile-data-card__meta">
                          <StatusBadge status={payment.status} />
                          <span>{payment.allocationType ?? "Unallocated"}</span>
                        </div>
                      </Card>
                    )}
                  />
                ) : (
                  <p className="muted">No payments recorded for this member.</p>
                )}
              </Card>
            ) : null}
          </div>
        )}

        {/* ── TIMELINE TAB ── */}
        {activeTab === "timeline" && (
          <Card className="detail-editor">
            <h2>Activity Timeline</h2>
            {timeline.isLoading ? (
              <Skeleton height="6rem" />
            ) : timeline.data?.length ? (
              <ul className="timeline">
                {timeline.data.map((event) => (
                  <li key={event.id}>
                    <span />
                    <div>
                      <strong>{event.action.replaceAll(".", " ")}</strong>
                      <p>{formatDateTime(event.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No activity has been recorded yet.</p>
            )}
          </Card>
        )}

        {/* ── CRM FOLLOW-UPS TAB ── */}
        {activeTab === "followups" && (
          <div className="member-followups-grid">
            <Card>
              <h2>Follow-up Queue</h2>
              <div className="crm-followup-empty">
                <div className="crm-followup-empty__icon">
                  <Icon name="check" size={32} />
                </div>
                <p>No open follow-ups for this member.</p>
                <Button icon="plus" size="small" variant="secondary">
                  Schedule Follow-up
                </Button>
              </div>
            </Card>

            <Card>
              <h2>Communication History</h2>
              <div className="crm-followup-empty">
                <div className="crm-followup-empty__icon">
                  <Icon name="spark" size={32} />
                </div>
                <p>No messages sent yet.</p>
                <Button icon="plus" size="small" variant="secondary">
                  Send Message
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ── PERFORMANCE & THERAPY TAB ── */}
        {(activeTab === "performance" || activeTab === "assessments" || activeTab === "therapy") &&
          memberId && <PerformanceProfileTab memberId={memberId} section={activeTab} />}
      </div>

      {/* Member Editor (inline below tabs when open) */}
      {editing ? (
        <MemberEditor
          branches={branches.data ?? []}
          member={member.data}
          onSaved={(updated) => {
            queryClient.setQueryData(["member", memberId], updated);
            void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("members") });
            setEditing(false);
          }}
        />
      ) : null}

      {/* Activate Membership Modal */}
      {isActivatingMembership ? (
        <ActivateMembershipModal
          isOpen={true}
          memberId={memberId}
          onClose={() => setIsActivatingMembership(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["member", memberId, "memberships"] });
            void queryClient.invalidateQueries({ queryKey: ["member", memberId, "credits"] });
            void queryClient.invalidateQueries({
              queryKey: ["member", memberId, "credits", "balance"]
            });
            setIsActivatingMembership(false);
          }}
          plans={plans.data?.filter((p) => p.isActive) ?? []}
        />
      ) : null}

      {isAdjustingCredits && activeMembership ? (
        <CreditAdjustmentModal
          isOpen={true}
          memberId={memberId}
          membershipId={activeMembership.id}
          onClose={() => setIsAdjustingCredits(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["member", memberId, "credits"] });
            void queryClient.invalidateQueries({
              queryKey: ["member", memberId, "credits", "balance"]
            });
            setIsAdjustingCredits(false);
          }}
        />
      ) : null}

      <ErrorNotice error={bookings.error ?? payments.error ?? attendance.error} />
    </>
  );
}

function CreditAdjustmentModal({
  isOpen,
  onClose,
  memberId,
  membershipId,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  membershipId: string;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<{ delta: number; reason: string }>({
    defaultValues: { delta: 1, reason: "" }
  });

  return (
    <Modal
      description="Add or remove credits with a permanent ledger entry and audit event."
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust membership credits"
    >
      <form
        className="form-stack"
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          try {
            await api.adjustCredit(memberId, {
              membershipId,
              delta: Number(values.delta),
              reason: values.reason.trim()
            });
            onSuccess();
          } catch (cause) {
            setError(cause);
          }
        })}
      >
        <FormField error={errors.delta?.message} htmlFor="creditDelta" label="Credit change">
          <input
            className="fitos-control"
            id="creditDelta"
            type="number"
            {...register("delta", {
              required: "Enter a credit change",
              validate: (value) => Number(value) !== 0 || "Change cannot be zero",
              valueAsNumber: true
            })}
          />
        </FormField>
        <FormField error={errors.reason?.message} htmlFor="creditAdjustmentReason" label="Reason">
          <input
            className="fitos-control"
            id="creditAdjustmentReason"
            placeholder="Required audit reason"
            {...register("reason", { required: "A reason is required" })}
          />
        </FormField>
        <ErrorNotice error={error} />
        <div className="form-actions">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button loading={isSubmitting} type="submit">
            Record adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MemberEditor({
  branches,
  member,
  onSaved
}: {
  branches: BranchResponse[];
  member: MemberResponse;
  onSaved(updated: MemberResponse): void;
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<MemberFormValues>({
    defaultValues: {
      firstName: member.contact.firstName,
      lastName: member.contact.lastName ?? "",
      phone: member.contact.phone ?? "",
      email: member.contact.email ?? "",
      dateOfBirth: member.contact.dateOfBirth ?? "",
      homeBranchId: member.homeBranchId ?? ""
    }
  });
  const [error, setError] = useState<unknown>(null);
  return (
    <form
      className="form-card form-stack detail-editor"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        try {
          onSaved(await api.updateMember(member.id, toMemberPayload(values)));
        } catch (cause) {
          setError(cause);
        }
      })}
    >
      <h2>Edit member</h2>
      <div className="form-grid">
        <FormField htmlFor="editFirstName" label="First name">
          <input
            className="fitos-control"
            id="editFirstName"
            {...register("firstName", { required: true })}
          />
        </FormField>
        <FormField htmlFor="editLastName" label="Last name" optional>
          <input className="fitos-control" id="editLastName" {...register("lastName")} />
        </FormField>
        <FormField htmlFor="editPhone" label="Phone" optional>
          <input className="fitos-control" id="editPhone" {...register("phone")} />
        </FormField>
        <FormField htmlFor="editEmail" label="Email" optional>
          <input className="fitos-control" id="editEmail" type="email" {...register("email")} />
        </FormField>
        <FormField htmlFor="editHomeBranch" label="Home branch">
          <select
            className="fitos-control"
            id="editHomeBranch"
            {...register("homeBranchId", { required: true })}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <ErrorNotice error={error} />
      <Button loading={isSubmitting} type="submit">
        Save changes
      </Button>
    </form>
  );
}

function ActivateMembershipModal({
  isOpen,
  onClose,
  memberId,
  plans,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  plans: MembershipPlanResponse[];
  onSuccess: () => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<{ planId: string; startsAt: string }>({
    defaultValues: {
      planId: plans[0]?.id ?? "",
      startsAt: new Date().toISOString().split("T")[0] ?? ""
    }
  });

  const onSubmit = async (values: { planId: string; startsAt: string }) => {
    setError(null);
    try {
      await api.activateMembership(memberId, {
        planId: values.planId,
        startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined
      });
      onSuccess();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Modal
      description="Select a membership plan to grant class booking credits to this member."
      isOpen={isOpen}
      onClose={onClose}
      title="Activate membership"
    >
      <form className="form-stack" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-grid">
          <FormField htmlFor="membershipPlan" label="Membership plan">
            <select
              className="fitos-control"
              id="membershipPlan"
              {...register("planId", { required: true })}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.includedCredits} credits
                  {p.durationDays ? ` · ${p.durationDays} days` : ""})
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="membershipStart" label="Start date">
            <input
              className="fitos-control"
              id="membershipStart"
              type="date"
              {...register("startsAt", { required: true })}
            />
          </FormField>
        </div>

        <ErrorNotice error={error} />

        <div className="form-actions">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button loading={isSubmitting} type="submit">
            Activate plan &amp; grant credits
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Performance & Therapy Inline Tab ────────────────────────────────────────
function PerformanceProfileTab({
  memberId,
  section
}: {
  memberId: string;
  section: "performance" | "assessments" | "therapy";
}) {
  const profileQ = useQuery({
    queryKey: ["member-performance", memberId],
    queryFn: () => api.memberPerformanceProfile(memberId),
    retry: 1
  });

  const therapyQ = useQuery({
    queryKey: ["therapy-sessions-member", memberId],
    queryFn: () => api.therapySessions(memberId),
    retry: 1
  });

  const profile = profileQ.data;
  const therapySessions = therapyQ.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* ── Performance Profile Summary ── */}
      {section !== "therapy" && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px",
            padding: "1.25rem"
          }}
        >
          <h3
            style={{ fontSize: ".9rem", fontWeight: 800, color: "white", marginBottom: ".75rem" }}
          >
            ⚡ Performance Profile
          </h3>
          {profileQ.isLoading ? (
            <Skeleton height="4rem" />
          ) : profile ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: ".75rem",
                  marginBottom: "1rem"
                }}
              >
                <div
                  style={{
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.18)",
                    borderRadius: "10px",
                    padding: ".75rem"
                  }}
                >
                  <div
                    style={{
                      fontSize: ".7rem",
                      color: "rgba(255,255,255,0.4)",
                      marginBottom: "2px"
                    }}
                  >
                    Total Assessments
                  </div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "white" }}>
                    {profile.totalAssessments}
                  </div>
                </div>
                <div
                  style={{
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.18)",
                    borderRadius: "10px",
                    padding: ".75rem"
                  }}
                >
                  <div
                    style={{
                      fontSize: ".7rem",
                      color: "rgba(255,255,255,0.4)",
                      marginBottom: "2px"
                    }}
                  >
                    Last Assessed
                  </div>
                  <div style={{ fontSize: ".95rem", fontWeight: 700, color: "white" }}>
                    {profile.lastAssessedAt
                      ? new Date(profile.lastAssessedAt).toLocaleDateString("en-KE", {
                          dateStyle: "medium"
                        })
                      : "Not yet assessed"}
                  </div>
                </div>
              </div>

              {/* Latest Metrics */}
              {Object.keys(profile.latestMetrics).length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: ".72rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      marginBottom: ".5rem"
                    }}
                  >
                    Latest Biometric Snapshot
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                      gap: ".5rem"
                    }}
                  >
                    {Object.entries(profile.latestMetrics).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: "8px",
                          padding: ".6rem .75rem"
                        }}
                      >
                        <div
                          style={{
                            fontSize: ".65rem",
                            color: "rgba(255,255,255,0.35)",
                            textTransform: "capitalize"
                          }}
                        >
                          {k.replace(/([A-Z])/g, " $1")}
                        </div>
                        <div style={{ fontSize: ".95rem", fontWeight: 800, color: "white" }}>
                          {typeof v === "number" ? v.toLocaleString() : String(v)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assessment Timeline */}
              {profile.timeline.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <div
                    style={{
                      fontSize: ".72rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      marginBottom: ".5rem"
                    }}
                  >
                    Assessment History
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
                    {profile.timeline
                      .slice()
                      .reverse()
                      .map((sess) => (
                        <div
                          key={sess.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: "8px",
                            padding: ".6rem .85rem",
                            fontSize: ".82rem"
                          }}
                        >
                          <div>
                            <span style={{ color: "white", fontWeight: 600 }}>
                              {sess.definitionName}
                            </span>
                            <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: ".5rem" }}>
                              {sess.summary.substring(0, 60)}…
                            </span>
                          </div>
                          <span
                            style={{
                              color: "rgba(255,255,255,0.3)",
                              whiteSpace: "nowrap",
                              marginLeft: ".75rem",
                              fontSize: ".75rem"
                            }}
                          >
                            {new Date(sess.conductedAt).toLocaleDateString("en-KE", {
                              dateStyle: "short"
                            })}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: ".85rem" }}>
              No performance data available. Complete an assessment scan first.
            </p>
          )}
        </div>
      )}

      {/* ── Therapy Sessions ── */}
      {section !== "performance" && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px",
            padding: "1.25rem"
          }}
        >
          <h3
            style={{ fontSize: ".9rem", fontWeight: 800, color: "white", marginBottom: ".75rem" }}
          >
            🛠 Therapy & Recovery Sessions
          </h3>
          {therapyQ.isLoading ? (
            <Skeleton height="4rem" />
          ) : therapySessions.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: ".85rem" }}>
              No therapy sessions recorded for this member.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
              {therapySessions.map((s) => {
                const delta =
                  s.prePainScore !== null && s.postPainScore !== null
                    ? s.prePainScore - s.postPainScore
                    : null;
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "8px",
                      padding: ".65rem .85rem"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: ".84rem", color: "white", fontWeight: 600 }}>
                        {s.protocolName}
                      </div>
                      <div
                        style={{
                          fontSize: ".73rem",
                          color: "rgba(255,255,255,0.4)",
                          marginTop: "2px"
                        }}
                      >
                        {s.modalityCode.replace(/_/g, " ")} • {s.staffName}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
                      {delta !== null && (
                        <span
                          style={{
                            fontSize: ".8rem",
                            fontWeight: 700,
                            color: delta >= 0 ? "#22c55e" : "#ef4444"
                          }}
                        >
                          Pain {delta >= 0 ? `↓${delta}` : `↑${Math.abs(delta)}`}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: ".73rem",
                          color: "rgba(255,255,255,0.3)",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {new Date(s.startedAt).toLocaleDateString("en-KE", { dateStyle: "short" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
