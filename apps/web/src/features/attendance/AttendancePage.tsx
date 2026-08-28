import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  SearchBar,
  StatusBadge
} from "@fitos/ui";
import type { AttendanceRecordResponse, AttendanceStatus } from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { branchQueryKeys } from "../../lib/query-keys";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

export function AttendancePage() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [checkingInMember, setCheckingInMember] = useState<{ id: string; name: string } | null>(
    null
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [checkInError, setCheckInError] = useState<unknown>(null);

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const attendance = useQuery({
    queryKey: branchQueryKeys.list("attendance", selectedBranch || "all"),
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedBranch) params.set("branchId", selectedBranch);
      params.set("limit", "100");
      return api.attendanceRecords(params);
    }
  });

  const members = useQuery({
    queryKey: ["members-checkin", memberSearch],
    queryFn: () =>
      api.members(
        new URLSearchParams({
          limit: "8",
          ...(memberSearch ? { query: memberSearch } : {})
        })
      ),
    enabled: Boolean(memberSearch.trim())
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AttendanceStatus }) =>
      api.updateAttendanceStatus(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("attendance") });
    }
  });

  const checkInMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const branchId = selectedBranch || branches.data?.[0]?.id;
      if (!branchId) throw new Error("Please select a branch.");
      return api.checkIn({
        branchId,
        memberId,
        overrideReason: overrideReason.trim() || undefined
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("attendance") });
      setCheckingInMember(null);
      setOverrideReason("");
      setMemberSearch("");
      setCheckInError(null);
    },
    onError: (err) => {
      setCheckInError(err);
    }
  });

  const records = attendance.data?.data ?? [];
  const checkedInCount = records.filter((r) => r.status === "checked_in").length;
  const attendedCount = records.filter((r) => r.status === "attended").length;

  const columns: DataTableColumn<AttendanceRecordResponse>[] = [
    {
      id: "status",
      header: "Status",
      cell: (r) => <StatusBadge status={r.status} />
    },
    {
      id: "member",
      header: "Member ID",
      cell: (r) => (
        <Link className="fitos-data-table__primary" to={`/app/members/${r.memberId}`}>
          {r.memberId.slice(0, 8)}...
        </Link>
      )
    },
    {
      id: "branch",
      header: "Branch",
      cell: (r) => branches.data?.find((b) => b.id === r.branchId)?.name ?? "Branch"
    },
    {
      id: "checkin_time",
      header: "Checked in at",
      cell: (r) => (r.checkedInAt ? formatDateTime(r.checkedInAt) : "—")
    },
    {
      id: "note",
      header: "Override / Note",
      cell: (r) => r.overrideReason || "—"
    },
    {
      id: "actions",
      header: "Update status",
      cell: (r) =>
        can(auth, "attendance:checkin") && r.status === "checked_in" ? (
          <Button
            onClick={() => updateStatusMutation.mutate({ id: r.id, status: "attended" })}
            size="small"
            variant="ghost"
          >
            Mark Attended
          </Button>
        ) : null
    }
  ];

  if (attendance.isLoading || branches.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader
        eyebrow="Front Desk & Operations"
        title="Attendance & Check-in"
        description="Verify entitlements, scan or search members, and monitor live facility and class attendance."
      />

      <ErrorNotice error={attendance.error} />

      {/* Hero Check-in Search */}
      <Card>
        <h2 style={{ marginTop: 0 }}>Front Desk Quick Check-in</h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "280px" }}>
            <SearchBar
              aria-label="Member check-in search"
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search member by name, phone or member # to check in..."
              value={memberSearch}
            />
          </div>

          <select
            aria-label="Select check-in branch"
            className="fitos-control"
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{ width: "200px" }}
            value={selectedBranch}
          >
            <option value="">Default Branch</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Member search dropdown */}
        {memberSearch.trim() ? (
          <div
            style={{
              marginTop: "0.75rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              maxHeight: "200px",
              overflowY: "auto",
              padding: "0.25rem"
            }}
          >
            {members.isLoading ? (
              <p className="muted" style={{ padding: "0.5rem" }}>
                Searching...
              </p>
            ) : !members.data?.data.length ? (
              <p className="muted" style={{ padding: "0.5rem" }}>
                No matching members found.
              </p>
            ) : (
              members.data.data.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    borderBottom: "1px solid var(--border-subtle, #222)"
                  }}
                >
                  <div>
                    <strong>
                      {m.firstName} {m.lastName}
                    </strong>
                    <span className="muted" style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                      ({m.phone ?? m.email ?? "No contact info"})
                    </span>
                  </div>
                  <Button
                    icon="check"
                    onClick={() =>
                      setCheckingInMember({ id: m.id, name: `${m.firstName} ${m.lastName}`.trim() })
                    }
                    size="small"
                    variant="primary"
                  >
                    Check In
                  </Button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </Card>

      {/* KPI row */}
      <section className="kpi-grid">
        <Card className="kpi kpi--energy">
          <span>Currently Checked In</span>
          <strong>{checkedInCount}</strong>
        </Card>
        <Card className="kpi">
          <span>Completed Visits</span>
          <strong>{attendedCount}</strong>
        </Card>
        <Card className="kpi">
          <span>Total Recorded Today</span>
          <strong>{records.length}</strong>
        </Card>
      </section>

      {/* Attendance log table */}
      <Card>
        <div className="section-header-row" style={{ marginTop: 0 }}>
          <h2>Recent Check-ins & Attendance History</h2>
          <select
            aria-label="Filter branch attendance"
            className="fitos-control"
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{ width: "200px" }}
            value={selectedBranch}
          >
            <option value="">All branches</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {!records.length ? (
          <EmptyState
            description="Members will appear here once checked in at the front desk or into a scheduled class."
            title="No check-ins recorded"
          />
        ) : (
          <DataTable
            columns={columns}
            data={records}
            label="Attendance Log"
            mobileRenderer={(record) => (
              <Card className="fitos-mobile-data-card">
                <div className="fitos-mobile-data-card__meta">
                  <StatusBadge status={record.status} />
                  <span>
                    {branches.data?.find((branch) => branch.id === record.branchId)?.name ??
                      "Branch"}
                  </span>
                </div>
                <div>
                  <Link
                    className="fitos-data-table__primary"
                    to={`/app/members/${record.memberId}`}
                  >
                    Member {record.memberId.slice(0, 8)}...
                  </Link>
                  <span className="fitos-data-table__muted">
                    {record.checkedInAt
                      ? formatDateTime(record.checkedInAt)
                      : "Check-in time unavailable"}
                  </span>
                </div>
                {record.overrideReason ? (
                  <span className="fitos-data-table__muted">Note: {record.overrideReason}</span>
                ) : null}
                {can(auth, "attendance:checkin") && record.status === "checked_in" ? (
                  <Button
                    onClick={() =>
                      updateStatusMutation.mutate({ id: record.id, status: "attended" })
                    }
                    size="small"
                    variant="ghost"
                  >
                    Mark Attended
                  </Button>
                ) : null}
              </Card>
            )}
          />
        )}
      </Card>

      {/* Check In Confirmation Modal */}
      {checkingInMember ? (
        <Modal
          description={`Confirm check-in for ${checkingInMember.name}.`}
          isOpen={true}
          onClose={() => {
            setCheckingInMember(null);
            setCheckInError(null);
          }}
          title="Confirm Member Check-in"
        >
          <div className="form-stack">
            <FormField htmlFor="overrideReason" label="Staff Override / Note" optional>
              <input
                className="fitos-control"
                id="overrideReason"
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Card replaced, guest pass, verbal entitlement"
                value={overrideReason}
              />
            </FormField>

            <ErrorNotice error={checkInError} />

            <div className="form-actions">
              <Button
                onClick={() => {
                  setCheckingInMember(null);
                  setCheckInError(null);
                }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                loading={checkInMutation.isPending}
                onClick={() => checkInMutation.mutate(checkingInMember.id)}
                variant="primary"
              >
                Confirm Check-in
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
