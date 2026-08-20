import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
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
  PageHeader,
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
import { ErrorNotice, PageLoading, formatCurrency, formatDate, formatDateTime } from "../shared";

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

export function MemberDetailPage() {
  const { auth } = useAuth();
  const { memberId } = useParams();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [isActivatingMembership, setIsActivatingMembership] = useState(false);
  const [isAdjustingCredits, setIsAdjustingCredits] = useState(false);

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

  const cancelMembershipMutation = useMutation({
    mutationFn: (membershipId: string) =>
      api.cancelMembership(memberId!, membershipId, "Cancelled by staff"),
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
              {service?.name ?? "Class session"}
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

  if (!memberId) return <Navigate replace to="/app/members" />;
  if (member.isLoading || branches.isLoading) return <PageLoading />;
  if (member.error || !member.data) return <ErrorNotice error={member.error} />;

  return (
    <>
      <PageHeader
        eyebrow="Member profile"
        title={`${member.data.contact.firstName} ${member.data.contact.lastName ?? ""}`.trim()}
        description={`Joined ${formatDate(member.data.joinedAt)}`}
        actions={
          <>
            <StatusBadge status={member.data.status} />
            {can(auth, "membership:manage") && !activeMembership ? (
              <Button icon="plus" onClick={() => setIsActivatingMembership(true)}>
                Activate membership
              </Button>
            ) : null}
            <Button icon="edit" onClick={() => setEditing((open) => !open)} variant="secondary">
              {editing ? "Close edit" : "Edit profile"}
            </Button>
          </>
        }
      />

      {/* Detail Grid */}
      <section className="detail-grid">
        {/* Left Column: Profile & Home Branch */}
        <Card>
          <h2>Contact & Identity</h2>
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
              <dt>Home branch</dt>
              <dd>
                {branches.data?.find((branch) => branch.id === member.data?.homeBranchId)?.name ??
                  "Not assigned"}
              </dd>
            </div>
            <div>
              <dt>Member number</dt>
              <dd>{member.data.memberNumber ?? "Assigned later"}</dd>
            </div>
          </dl>
        </Card>

        {/* Right Column: Active Membership & Credits */}
        <Card>
          <div className="section-header-row" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            <h2>Active Membership & Entitlements</h2>
            <div className="form-actions">
              {activeMembership && can(auth, "membership:override") ? (
                <Button
                  onClick={() => setIsAdjustingCredits(true)}
                  size="small"
                  variant="secondary"
                >
                  Adjust credits
                </Button>
              ) : null}
              {activeMembership && can(auth, "membership:manage") ? (
                <Button
                  onClick={() => cancelMembershipMutation.mutate(activeMembership.id)}
                  size="small"
                  variant="ghost"
                >
                  Cancel plan
                </Button>
              ) : null}
            </div>
          </div>

          {activeMembership ? (
            <div className="form-stack">
              <div className="selected-entity-badge">
                <div className="selected-entity-badge__info">
                  <Icon name="spark" size={20} />
                  <div>
                    <strong>{activeMembership.planSnapshot.name}</strong>
                    <span>
                      Valid until: {formatDate(activeMembership.endsAt)} (Started:{" "}
                      {formatDate(activeMembership.startsAt)})
                    </span>
                  </div>
                </div>
                <StatusBadge status={activeMembership.status} />
              </div>

              <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                <Card className="kpi kpi--energy">
                  <span>Available credits</span>
                  <strong>{creditBalance.data?.balance ?? 0}</strong>
                </Card>
                <Card className="kpi">
                  <span>Total included</span>
                  <strong>{activeMembership.planSnapshot.includedCredits}</strong>
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
      </section>

      {/* Credit Ledger History */}
      <Card className="detail-editor">
        <h2>Credit Ledger & Audit History</h2>
        {creditLedger.isLoading ? (
          <Skeleton height="6rem" />
        ) : creditLedger.data?.length ? (
          <DataTable columns={creditColumns} data={creditLedger.data} label="Credit Ledger" />
        ) : (
          <p className="muted">No credit movements recorded yet.</p>
        )}
      </Card>

      {can(auth, "booking:read") ? (
        <Card className="detail-editor">
          <h2>Booking History</h2>
          {bookings.isLoading || occurrences.isLoading || services.isLoading ? (
            <Skeleton height="6rem" />
          ) : bookings.data?.data.length ? (
            <DataTable columns={bookingColumns} data={bookings.data.data} label="Member Bookings" />
          ) : (
            <p className="muted">No bookings recorded for this member.</p>
          )}
        </Card>
      ) : null}

      {can(auth, "payment:read") ? (
        <Card className="detail-editor">
          <h2>Payment History</h2>
          {payments.isLoading ? (
            <Skeleton height="6rem" />
          ) : payments.data?.data.length ? (
            <DataTable columns={paymentColumns} data={payments.data.data} label="Member Payments" />
          ) : (
            <p className="muted">No payments recorded for this member.</p>
          )}
        </Card>
      ) : null}

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
      ) : null}

      <ErrorNotice error={bookings.error ?? payments.error ?? attendance.error} />

      {/* Activity Timeline */}
      <Card className="detail-editor">
        <h2>Timeline</h2>
        {timeline.isLoading ? (
          <Skeleton height="6rem" />
        ) : timeline.data?.length ? (
          <ul className="timeline">
            {timeline.data.map((event) => (
              <li key={event.id}>
                <span />
                <div>
                  <strong>{event.action.replaceAll(".", " ")}</strong>
                  <p>{formatDate(event.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No activity has been recorded yet.</p>
        )}
      </Card>

      {/* Member Editor */}
      {editing ? (
        <MemberEditor
          branches={branches.data ?? []}
          member={member.data}
          onSaved={(updated) => {
            queryClient.setQueryData(["member", memberId], updated);
            void queryClient.invalidateQueries({ queryKey: ["members"] });
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
            Activate plan & grant credits
          </Button>
        </div>
      </form>
    </Modal>
  );
}
