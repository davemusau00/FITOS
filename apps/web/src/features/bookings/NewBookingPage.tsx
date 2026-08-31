import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, FormField, Icon, PageHeader, SearchBar } from "@fitos/ui";
import type {
  CreateBookingRequest,
  MemberListItem,
  ScheduleOccurrenceResponse
} from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { branchQueryKeys } from "../../lib/query-keys";
import { useBranch } from "../../app/branch-context";
import { ErrorNotice, PageLoading, formatCurrency, formatDateTime } from "../shared";

export function NewBookingPage() {
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { activeBranchId } = useBranch();
  const { auth } = useAuth();

  const preselectedOccurrenceId = urlParams.get("occurrenceId") ?? "";
  const preselectedMemberId = urlParams.get("memberId") ?? "";

  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState(preselectedMemberId);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState(preselectedOccurrenceId);
  const [overrideReason, setOverrideReason] = useState("");
  const [submissionError, setSubmissionError] = useState<unknown>(null);

  const membersQuery = useQuery({
    queryKey: branchQueryKeys.list("members", activeBranchId, memberSearch),
    queryFn: () => {
      const p = new URLSearchParams();
      if (memberSearch.trim()) p.set("query", memberSearch.trim());
      p.set("limit", "50");
      if (activeBranchId) p.set("branchId", activeBranchId);
      return api.members(p);
    },
    enabled: Boolean(activeBranchId)
  });

  const occurrencesQuery = useQuery({
    queryKey: branchQueryKeys.list("schedule", activeBranchId, "bookable"),
    queryFn: () => {
      const p = new URLSearchParams();
      p.set("status", "scheduled");
      p.set("limit", "100");
      if (activeBranchId) p.set("branchId", activeBranchId);
      return api.scheduleOccurrences(p);
    },
    enabled: Boolean(activeBranchId)
  });

  const servicesQuery = useQuery({
    queryKey: branchQueryKeys.list("services", activeBranchId),
    queryFn: () => api.servicesByBranch(activeBranchId),
    enabled: Boolean(activeBranchId)
  });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const staffQuery = useQuery({ queryKey: ["staff"], queryFn: api.staff });
  const roomsQuery = useQuery({
    queryKey: branchQueryKeys.list("rooms", activeBranchId),
    queryFn: () => api.rooms(activeBranchId),
    enabled: Boolean(activeBranchId)
  });

  const allBookingsQuery = useQuery({
    queryKey: branchQueryKeys.list("bookings", activeBranchId, "counts"),
    queryFn: () => api.bookings(new URLSearchParams({ branchId: activeBranchId })),
    enabled: Boolean(activeBranchId)
  });

  const selectedMember = membersQuery.data?.data.find((m) => m.id === selectedMemberId);
  const selectedOccurrence = occurrencesQuery.data?.data.find((o) => o.id === selectedOccurrenceId);
  const selectedService = servicesQuery.data?.find((s) => s.id === selectedOccurrence?.serviceId);
  const selectedBranch = branchesQuery.data?.find((b) => b.id === selectedOccurrence?.branchId);
  const selectedTrainer = staffQuery.data?.find(
    (st) => st.user.id === selectedOccurrence?.trainerUserId
  );
  const selectedRoom = roomsQuery.data?.find((r) => r.id === selectedOccurrence?.roomId);

  const occurrenceBookingCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of allBookingsQuery.data?.data ?? []) {
      if (b.status === "confirmed") {
        map.set(b.occurrenceId, (map.get(b.occurrenceId) ?? 0) + 1);
      }
    }
    return map;
  }, [allBookingsQuery.data]);

  const bookMutation = useMutation({
    mutationFn: (payload: CreateBookingRequest) => api.createBooking(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("bookings") });
      void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("schedule") });
      navigate("/app/bookings");
    },
    onError: (err) => setSubmissionError(err)
  });

  const handleBook = () => {
    if (!selectedMemberId || !selectedOccurrenceId) return;
    setSubmissionError(null);
    bookMutation.mutate({
      memberId: selectedMemberId,
      occurrenceId: selectedOccurrenceId,
      source: "staff",
      ...(isOccFull ? { waitlist: true } : {}),
      ...(can(auth, "booking:override") && overrideReason.trim()
        ? { overrideReason: overrideReason.trim() }
        : {})
    });
  };

  const isOccFull =
    selectedOccurrence &&
    (occurrenceBookingCounts.get(selectedOccurrence.id) ?? 0) >=
      (selectedOccurrence.effectiveCapacity ?? selectedOccurrence.capacity);

  if (membersQuery.isLoading || occurrencesQuery.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="New booking"
        description="Reserve a session spot for a gym member with real-time capacity validation."
        actions={
          <Link className="fitos-button fitos-button--ghost" to="/app/bookings">
            Cancel
          </Link>
        }
      />

      <div className="booking-stepper-grid">
        {/* Step 1: Member Selection */}
        <Card>
          <div className="card-header-step">
            <span className="step-badge">1</span>
            <h2>Select member</h2>
          </div>

          {selectedMember ? (
            <div className="selected-entity-badge">
              <div className="selected-entity-badge__info">
                <Icon name="check" size={18} />
                <div>
                  <strong>
                    {selectedMember.firstName} {selectedMember.lastName}
                  </strong>
                  <span>
                    {selectedMember.phone ?? selectedMember.email ?? "No contact recorded"}
                  </span>
                </div>
              </div>
              <Button onClick={() => setSelectedMemberId("")} size="small" variant="ghost">
                Change
              </Button>
            </div>
          ) : (
            <div className="form-stack">
              <SearchBar
                aria-label="Search members"
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search name, phone, email..."
                value={memberSearch}
              />

              <ul className="activity-list" style={{ maxHeight: "20rem", overflowY: "auto" }}>
                {membersQuery.data?.data.map((m: MemberListItem) => (
                  <li
                    className="clickable-list-item"
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                  >
                    <div>
                      <strong>
                        {m.firstName} {m.lastName}
                      </strong>
                      <span className="fitos-data-table__muted">
                        {m.phone ?? m.email ?? "No contact"} · #{m.memberNumber ?? "—"} · {m.status}
                      </span>
                    </div>
                    <Button size="small" variant="secondary">
                      Select
                    </Button>
                  </li>
                ))}
              </ul>
              {!membersQuery.data?.data.length && memberSearch.trim() ? (
                <p className="muted">No members found matching &quot;{memberSearch}&quot;.</p>
              ) : null}
            </div>
          )}
        </Card>

        {/* Step 2: Session Selection */}
        <Card>
          <div className="card-header-step">
            <span className="step-badge">2</span>
            <h2>Select session</h2>
          </div>

          {selectedOccurrence ? (
            <div className="selected-entity-badge">
              <div className="selected-entity-badge__info">
                <Icon name="check" size={18} />
                <div>
                  <strong>{selectedService?.name ?? "Class session"}</strong>
                  <span>
                    {formatDateTime(selectedOccurrence.startsAt)} · {selectedBranch?.name}
                  </span>
                </div>
              </div>
              <Button onClick={() => setSelectedOccurrenceId("")} size="small" variant="ghost">
                Change
              </Button>
            </div>
          ) : (
            <div className="form-stack">
              <ul className="activity-list" style={{ maxHeight: "20rem", overflowY: "auto" }}>
                {occurrencesQuery.data?.data.map((occ: ScheduleOccurrenceResponse) => {
                  const srv = servicesQuery.data?.find((s) => s.id === occ.serviceId);
                  const br = branchesQuery.data?.find((b) => b.id === occ.branchId);
                  const booked = occurrenceBookingCounts.get(occ.id) ?? 0;
                  const capacity = occ.effectiveCapacity ?? occ.capacity;
                  const full = booked >= capacity;

                  return (
                    <li
                      className="clickable-list-item"
                      key={occ.id}
                      onClick={() => setSelectedOccurrenceId(occ.id)}
                    >
                      <div>
                        <strong>{srv?.name ?? "Session"}</strong>
                        <span className="fitos-data-table__muted">
                          {formatDateTime(occ.startsAt)} · {br?.name ?? "Branch not available"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span className={`fitos-badge fitos-badge--${full ? "danger" : "success"}`}>
                          {booked}/{capacity} booked
                        </span>
                        <Button size="small" variant="secondary">
                          {full ? "Waitlist" : "Select"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!occurrencesQuery.data?.data.length ? (
                <p className="muted">No upcoming scheduled sessions found.</p>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      {/* Step 3: Confirmation Summary */}
      {selectedMember && selectedOccurrence ? (
        <Card className="confirmation-summary-card">
          <h2>Reservation summary</h2>
          <div className="summary-details-grid">
            <div>
              <span className="fitos-data-table__muted">Member</span>
              <strong>
                {selectedMember.firstName} {selectedMember.lastName}
              </strong>
              <span>{selectedMember.phone ?? selectedMember.email ?? "—"}</span>
            </div>

            <div>
              <span className="fitos-data-table__muted">Session</span>
              <strong>{selectedService?.name}</strong>
              <span>{formatDateTime(selectedOccurrence.startsAt)}</span>
            </div>

            <div>
              <span className="fitos-data-table__muted">Location & Instructor</span>
              <strong>{selectedBranch?.name}</strong>
              <span>
                {selectedRoom ? `${selectedRoom.name} · ` : ""}
                {selectedTrainer ? `With ${selectedTrainer.user.displayName}` : "No instructor"}
              </span>
            </div>

            <div>
              <span className="fitos-data-table__muted">Pricing / Entitlement</span>
              <strong>
                {selectedService?.price
                  ? formatCurrency(
                      selectedService.price.amountMinor,
                      selectedService.price.currency
                    )
                  : "Included / Drop-in allowed"}
              </strong>
              <span className="fitos-badge fitos-badge--info">Drop-in authorized</span>
            </div>
          </div>

          {isOccFull ? (
            <Alert title="Session is at capacity" tone="warning">
              All {selectedOccurrence.capacity} spots are booked. You can join the staff-managed
              waitlist without using an entitlement credit.
            </Alert>
          ) : null}

          {can(auth, "booking:override") ? (
            <div className="booking-override-card">
              <FormField
                hint="Use only for an approved exception. The reason is retained with the booking and audit history."
                htmlFor="booking-override-reason"
                label="Entitlement override reason"
                optional
              >
                <textarea
                  className="fitos-control"
                  id="booking-override-reason"
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder="Leave blank for normal entitlement validation"
                  rows={3}
                  value={overrideReason}
                />
              </FormField>
            </div>
          ) : null}

          <ErrorNotice error={submissionError} />

          <div className="form-actions" style={{ marginTop: "1.5rem" }}>
            <Button fullWidth loading={bookMutation.isPending} onClick={handleBook}>
              {isOccFull ? "Join waitlist" : "Confirm and create booking"}
            </Button>
          </div>
        </Card>
      ) : null}
    </>
  );
}
