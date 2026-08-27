import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const staff = useQuery({ queryKey: ["staff"], queryFn: api.staff });
  const roles = useQuery({ queryKey: ["staff-roles"], queryFn: api.staffRoles });
  const update = useMutation({
    mutationFn: ({
      userId,
      roleIds,
      branchIds
    }: {
      userId: string;
      roleIds: string[];
      branchIds: string[];
    }) => api.updateStaff(userId, { roleId: roleIds[0]!, roleIds, branchIds }),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
    }
  });
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
      {can(auth, "staff:manage") && rows.length ? (
        <section className="settings-panel">
          <h2>Role assignments</h2>
          <p className="muted">
            Select a staff member to review or update multiple workspace roles.
          </p>
          <div className="form-field">
            <label htmlFor="staff-role-user">Staff member</label>
            <select
              id="staff-role-user"
              value={editingId ?? ""}
              onChange={(event) => {
                const id = event.target.value;
                const record = rows.find((item) => item.user.id === id);
                setEditingId(id || null);
                setSelectedRoleIds(
                  record?.roles?.map((role) => role.id) ?? (record ? [record.role.id] : [])
                );
              }}
            >
              <option value="">Choose staff member</option>
              {rows.map((record) => (
                <option key={record.user.id} value={record.user.id}>
                  {record.user.displayName}
                </option>
              ))}
            </select>
          </div>
          {editingId ? (
            <>
              <div className="form-field">
                <label htmlFor="staff-role-assignments">Roles</label>
                <select
                  id="staff-role-assignments"
                  multiple
                  value={selectedRoleIds}
                  onChange={(event) =>
                    setSelectedRoleIds(
                      Array.from(event.target.selectedOptions, (option) => option.value)
                    )
                  }
                >
                  {(roles.data ?? []).map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="fitos-button fitos-button--primary"
                disabled={!selectedRoleIds.length || update.isPending}
                onClick={() => {
                  const record = rows.find((item) => item.user.id === editingId);
                  if (record)
                    update.mutate({
                      userId: editingId,
                      roleIds: selectedRoleIds,
                      branchIds: record.branches.map((branch) => branch.id)
                    });
                }}
                type="button"
              >
                {update.isPending ? "Saving…" : "Save role assignments"}
              </button>
              {update.error ? <ErrorNotice error={update.error} /> : null}
            </>
          ) : null}
        </section>
      ) : null}
      {can(auth, "staff:manage") ? (
        <Alert title="Staff access" tone="info">
          Staff role assignments and branch access are enforced by the server and displayed here for
          review.
        </Alert>
      ) : null}
    </>
  );
}
