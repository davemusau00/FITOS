import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  DataTable,
  type DataTableColumn,
  EmptyState,
  PageHeader,
  StatusBadge
} from "@fitos/ui";
import type { StaffUserResponse } from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { PageLoading, ErrorNotice } from "../shared";

type StaffRow = StaffUserResponse & { id: string };

const staffColumns: Array<DataTableColumn<StaffRow>> = [
  {
    id: "staff",
    header: "Staff member",
    cell: (staff) => (
      <div>
        <strong className="fitos-data-table__primary">{staff.user.displayName}</strong>
        <span className="fitos-data-table__muted">{staff.user.email}</span>
      </div>
    )
  },
  { id: "role", header: "Role", cell: (staff) => staff.role.name },
  {
    id: "branches",
    header: "Branches",
    cell: (staff) => staff.branches.map((branch) => branch.name).join(", ") || "No branch access"
  },
  { id: "status", header: "Status", cell: (staff) => <StatusBadge status={staff.user.status} /> }
];

export function StaffPage() {
  const { auth } = useAuth();
  const staff = useQuery({ queryKey: ["staff"], queryFn: api.staff });
  if (staff.isLoading) return <PageLoading />;
  const rows: StaffRow[] = (staff.data ?? []).map((record) => ({ ...record, id: record.user.id }));
  return (
    <>
      <PageHeader
        eyebrow="Access"
        title="Staff"
        description="View the people who can operate this organization and the access they hold."
      />
      {staff.error ? (
        <ErrorNotice error={staff.error} />
      ) : !rows.length ? (
        <EmptyState
          description="Invite people after your first branch is ready."
          title="No staff access yet"
        />
      ) : (
        <DataTable columns={staffColumns} data={rows} label="Staff" />
      )}
      {can(auth, "staff:manage") ? (
        <Alert title="Staff invitations" tone="info">
          The invitation and branch-access API is active. The acceptance flow will ship with secure
          email delivery in the automation slice.
        </Alert>
      ) : null}
    </>
  );
}
