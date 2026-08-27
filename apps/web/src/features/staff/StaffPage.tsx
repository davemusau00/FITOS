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
  {
    id: "role",
    header: "Roles",
    cell: (staff) => (
      <div className="fitos-data-table__tag-list">
        {(staff.roles?.length ? staff.roles : [staff.role]).map((role) => (
          <span className="fitos-data-table__tag" key={role.id}>
            {role.name}
          </span>
        ))}
      </div>
    )
  },
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
        <Alert title="Staff access" tone="info">
          Staff role assignments and branch access are enforced by the server and displayed here for
          review.
        </Alert>
      ) : null}
    </>
  );
}
