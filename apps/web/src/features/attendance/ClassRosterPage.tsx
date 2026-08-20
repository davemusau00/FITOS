import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  EmptyState,
  PageHeader,
  StatusBadge
} from "@fitos/ui";
import type { AttendanceStatus, BookingResponse } from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

export function ClassRosterPage() {
  const { occurrenceId } = useParams();
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  const occurrence = useQuery({
    queryKey: ["occurrence", occurrenceId ?? ""],
    queryFn: () => api.scheduleOccurrence(occurrenceId!),
    enabled: Boolean(occurrenceId)
  });

  const bookings = useQuery({
    queryKey: ["bookings", "occurrence", occurrenceId ?? ""],
    queryFn: () => {
      const params = new URLSearchParams({ occurrenceId: occurrenceId!, limit: "100" });
      return api.bookings(params);
    },
    enabled: Boolean(occurrenceId)
  });

  const attendance = useQuery({
    queryKey: ["attendance", "occurrence", occurrenceId ?? ""],
    queryFn: () => {
      const params = new URLSearchParams({ occurrenceId: occurrenceId!, limit: "100" });
      return api.attendanceRecords(params);
    },
    enabled: Boolean(occurrenceId)
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ recordId, status }: { recordId: string; status: AttendanceStatus }) =>
      api.updateAttendanceStatus(recordId, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    }
  });

  const checkInBookingMutation = useMutation({
    mutationFn: async (booking: BookingResponse) => {
      return api.checkIn({
        branchId: booking.branchId,
        memberId: booking.memberId,
        occurrenceId: booking.occurrenceId
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    }
  });

  if (!occurrenceId)
    return (
      <EmptyState
        description="Please navigate from a scheduled class occurrence."
        title="No occurrence selected"
      />
    );
  if (occurrence.isLoading || bookings.isLoading || attendance.isLoading) return <PageLoading />;

  const occ = occurrence.data;
  const bookingList = bookings.data?.data ?? [];
  const attendanceList = attendance.data?.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Class Attendance"
        title="Class Roster & Check-in"
        description={
          occ
            ? `Starts: ${formatDateTime(occ.startsAt)} — Capacity: ${bookingList.filter((b) => b.status === "confirmed").length} / ${occ.capacity}`
            : ""
        }
        actions={
          <Link className="fitos-button fitos-button--ghost" to="/app/schedule">
            Back to Schedule
          </Link>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        <Card>
          <h2>Booked Members & Roster</h2>
          {!bookingList.length ? (
            <EmptyState
              description="No members have booked into this session yet."
              title="Class roster is empty"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {bookingList.map((b) => {
                const attRecord = attendanceList.find((a) => a.memberId === b.memberId);
                return (
                  <div
                    key={b.id}
                    style={{
                      padding: "0.75rem 1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <Link to={`/app/members/${b.memberId}`}>
                          <strong>Member ID: {b.memberId.slice(0, 8)}</strong>
                        </Link>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
                        Booked: {formatDateTime(b.bookedAt)} ({b.source})
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      {attRecord ? (
                        <>
                          <StatusBadge status={attRecord.status} />
                          {can(auth, "attendance:checkin") ? (
                            <select
                              aria-label="Change attendance status"
                              className="fitos-control"
                              onChange={(e) =>
                                updateStatusMutation.mutate({
                                  recordId: attRecord.id,
                                  status: e.target.value as AttendanceStatus
                                })
                              }
                              style={{ width: "140px" }}
                              value={attRecord.status}
                            >
                              <option value="checked_in">Checked In</option>
                              <option value="attended">Attended</option>
                              <option value="no_show">No-Show</option>
                              <option value="late_cancel">Late Cancel</option>
                            </select>
                          ) : null}
                        </>
                      ) : b.status === "confirmed" && can(auth, "attendance:checkin") ? (
                        <Button
                          icon="check"
                          loading={checkInBookingMutation.isPending}
                          onClick={() => checkInBookingMutation.mutate(b)}
                          size="small"
                          variant="primary"
                        >
                          Check In
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
