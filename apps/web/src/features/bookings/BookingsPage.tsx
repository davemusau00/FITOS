import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  DataTable,
  type DataTableColumn,
  Card,
  EmptyState,
  FormField,
  Icon,
  Modal,
  PageHeader,
  SearchBar,
  StatusBadge
} from "@fitos/ui";
import type { BookingResponse, BookingStatus } from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { branchQueryKeys } from "../../lib/query-keys";
import { useBranch } from "../../app/branch-context";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

export function BookingsPage() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [cancellingBooking, setCancellingBooking] = useState<BookingResponse | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<unknown>(null);
  const { activeBranchId } = useBranch();

  const statusFilter = (params.get("status") as BookingStatus) || "";
  const memberSearch = params.get("query") || "";

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const services = useQuery({
    queryKey: branchQueryKeys.list("services", activeBranchId),
    queryFn: () => api.servicesByBranch(activeBranchId),
    enabled: Boolean(activeBranchId)
  });
  const members = useQuery({
    queryKey: branchQueryKeys.list("members", activeBranchId, "lookup"),
    queryFn: () => api.members(new URLSearchParams({ branchId: activeBranchId, limit: "100" })),
    enabled: Boolean(activeBranchId)
  });
  const occurrences = useQuery({
    queryKey: branchQueryKeys.list("schedule", activeBranchId, "lookup"),
    queryFn: () => api.scheduleOccurrences(new URLSearchParams({ branchId: activeBranchId })),
    enabled: Boolean(activeBranchId)
  });

  const requestParams = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter) p.set("status", statusFilter);
    if (activeBranchId) p.set("branchId", activeBranchId);
    return p;
  }, [statusFilter, activeBranchId]);

  const bookingsQuery = useQuery({
    queryKey: branchQueryKeys.list("bookings", activeBranchId, requestParams.toString()),
    queryFn: () => api.bookings(requestParams),
    enabled: Boolean(activeBranchId)
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.cancelBooking(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("bookings") });
      void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("schedule") });
      setCancellingBooking(null);
      setCancelReason("");
    },
    onError: (err) => setCancelError(err)
  });

  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };

  const rawBookings = bookingsQuery.data?.data ?? [];

  const filteredBookings = rawBookings.filter((b) => {
    if (!memberSearch) return true;
    const member = members.data?.data.find((m) => m.id === b.memberId);
    if (!member) return false;
    const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
    const q = memberSearch.toLowerCase();
    return (
      fullName.includes(q) ||
      (member.phone && member.phone.includes(q)) ||
      (member.email && member.email.toLowerCase().includes(q))
    );
  });

  const columns: DataTableColumn<BookingResponse>[] = [
    {
      id: "member",
      header: "Member",
      cell: (b) => {
        const m = members.data?.data.find((mem) => mem.id === b.memberId);
        return (
          <div>
            <strong className="fitos-data-table__primary">
              {m ? `${m.firstName} ${m.lastName}` : b.memberId.slice(0, 8)}
            </strong>
            <span className="fitos-data-table__muted">{m?.phone ?? "No phone"}</span>
          </div>
        );
      }
    },
    {
      id: "session",
      header: "Session / Class",
      cell: (b) => {
        const occ = occurrences.data?.data.find((o) => o.id === b.occurrenceId);
        const srv = services.data?.find((s) => s.id === occ?.serviceId);
        return (
          <div>
            <strong className="fitos-data-table__primary">{srv?.name ?? "Class session"}</strong>
            <span className="fitos-data-table__muted">
              {occ ? formatDateTime(occ.startsAt) : "—"}
            </span>
          </div>
        );
      }
    },
    {
      id: "source",
      header: "Source",
      cell: (b) => <StatusBadge status={b.source} />
    },
    {
      id: "status",
      header: "Status",
      cell: (b) => (
        <div>
          <StatusBadge status={b.status} />
          {b.cancellationReason ? (
            <span className="fitos-data-table__muted" style={{ display: "block" }}>
              {b.cancellationReason}
            </span>
          ) : null}
        </div>
      )
    },
    {
      id: "bookedAt",
      header: "Booked",
      cell: (b) => formatDateTime(b.bookedAt)
    },
    {
      id: "actions",
      header: "",
      cell: (b) =>
        b.status === "confirmed" && can(auth, "booking:cancel") ? (
          <Button
            onClick={() => {
              setCancellingBooking(b);
              setCancelReason("");
              setCancelError(null);
            }}
            size="small"
            variant="danger"
          >
            Cancel
          </Button>
        ) : null
    }
  ];

  if (bookingsQuery.isLoading || branches.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description="View, manage, and cancel member reservations across class sessions."
        actions={
          can(auth, "booking:create") ? (
            <Link className="fitos-button fitos-button--primary" to="/app/bookings/new">
              <Icon name="plus" size={16} />
              New booking
            </Link>
          ) : null
        }
      />

      <ErrorNotice error={bookingsQuery.error} onRetry={() => void bookingsQuery.refetch()} />

      <section className="filter-row">
        <SearchBar
          aria-label="Search by member"
          onChange={(e) => setFilter("query", e.target.value)}
          placeholder="Search member name or phone..."
          value={memberSearch}
        />
        <select
          aria-label="Filter by status"
          className="fitos-control"
          onChange={(e) => setFilter("status", e.target.value)}
          value={statusFilter}
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </section>

      {!filteredBookings.length ? (
        <EmptyState
          action={
            can(auth, "booking:create") ? (
              <Link className="fitos-button fitos-button--primary" to="/app/bookings/new">
                Create first booking
              </Link>
            ) : undefined
          }
          description="Reservations made by staff or through online self-service will appear here."
          title="No bookings found"
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredBookings}
          label="Bookings"
          mobileRenderer={(booking) => {
            const member = members.data?.data.find((item) => item.id === booking.memberId);
            const occurrence = occurrences.data?.data.find(
              (item) => item.id === booking.occurrenceId
            );
            const service = services.data?.find((item) => item.id === occurrence?.serviceId);
            return (
              <Card className="fitos-mobile-data-card">
                <div>
                  <strong className="fitos-data-table__primary">
                    {member
                      ? `${member.firstName} ${member.lastName ?? ""}`
                      : booking.memberId.slice(0, 8)}
                  </strong>
                  <span className="fitos-data-table__muted">
                    {service?.name ?? "Class session"} ·{" "}
                    {occurrence ? formatDateTime(occurrence.startsAt) : "Time unavailable"}
                  </span>
                </div>
                <div className="fitos-mobile-data-card__meta">
                  <StatusBadge status={booking.status} />
                  <span>{booking.source}</span>
                </div>
                {booking.status === "confirmed" && can(auth, "booking:cancel") ? (
                  <Button
                    onClick={() => {
                      setCancellingBooking(booking);
                      setCancelReason("");
                      setCancelError(null);
                    }}
                    size="small"
                    variant="danger"
                  >
                    Cancel booking
                  </Button>
                ) : null}
              </Card>
            );
          }}
        />
      )}

      {/* Cancellation Modal */}
      {cancellingBooking ? (
        <Modal
          description="Cancelling will immediately release the reserved spot back into session capacity."
          isOpen={true}
          onClose={() => setCancellingBooking(null)}
          title="Cancel booking"
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (cancelReason.trim()) {
                cancelMutation.mutate({
                  id: cancellingBooking.id,
                  reason: cancelReason.trim()
                });
              }
            }}
          >
            <FormField
              error={!cancelReason.trim() ? "Reason is required" : undefined}
              htmlFor="bookingCancelReason"
              label="Cancellation reason"
            >
              <input
                autoFocus
                className="fitos-control"
                id="bookingCancelReason"
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Member requested via WhatsApp, schedule conflict"
                value={cancelReason}
              />
            </FormField>

            <ErrorNotice error={cancelError} />

            <div className="form-actions">
              <Button onClick={() => setCancellingBooking(null)} variant="ghost">
                Close
              </Button>
              <Button
                disabled={!cancelReason.trim()}
                loading={cancelMutation.isPending}
                type="submit"
                variant="danger"
              >
                Confirm cancellation
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
