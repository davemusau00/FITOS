import { useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type DataTableColumn, EmptyState, Icon, PageHeader, SearchBar, StatusBadge } from "@fitos/ui";
import type { MemberListItem } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { PageLoading, ErrorNotice, formatDate } from "../shared";

const memberColumns: DataTableColumn<MemberListItem>[] = [
  {
    id: "member",
    header: "Member",
    cell: (member) => (
      <div>
        <strong className="fitos-data-table__primary">
          {member.firstName} {member.lastName}
        </strong>
        <span className="fitos-data-table__muted">{member.email ?? "No email"}</span>
      </div>
    )
  },
  { id: "phone", header: "Phone", cell: (member) => member.phone ?? "—" },
  {
    id: "status",
    header: "Status",
    cell: (member) => <StatusBadge status={member.status} />
  },
  { id: "joined", header: "Joined", cell: (member) => formatDate(member.joinedAt) }
];

export function MembersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get("query") ?? "";
  const status = params.get("status") ?? "";
  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const requestParams = useMemo(() => {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (status) next.set("status", status);
    const branch = params.get("branchId");
    if (branch) next.set("branchId", branch);
    return next;
  }, [params, query, status]);
  const members = useQuery({
    queryKey: ["members", requestParams.toString()],
    queryFn: () => api.members(requestParams)
  });
  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };
  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Members"
        description="Search, create, and maintain the people at the heart of your business."
        actions={
          <Link className="fitos-button fitos-button--primary" to="/app/members/new">
            <Icon name="plus" size={16} />
            Add member
          </Link>
        }
      />
      <section className="filter-row">
        <SearchBar
          aria-label="Search members"
          onChange={(event) => set("query", event.currentTarget.value)}
          placeholder="Search name, phone or email"
          value={query}
        />
        <select
          aria-label="Filter members by branch"
          className="fitos-control"
          onChange={(event) => set("branchId", event.currentTarget.value)}
          value={params.get("branchId") ?? ""}
        >
          <option value="">All accessible branches</option>
          {branches.data?.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter members by status"
          className="fitos-control"
          onChange={(event) => set("status", event.currentTarget.value)}
          value={status}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </select>
      </section>
      {members.isLoading ? (
        <PageLoading />
      ) : members.error ? (
        <ErrorNotice error={members.error} />
      ) : !members.data?.data.length ? (
        <EmptyState
          action={
            <Link className="fitos-button fitos-button--primary" to="/app/members/new">
              Add member
            </Link>
          }
          description={
            query || status
              ? "Try clearing or changing your filters."
              : "Create your first member to begin managing your customer base."
          }
          title={query || status ? "No matching members" : "No members yet"}
        />
      ) : (
        <DataTable
          columns={memberColumns}
          data={members.data.data}
          label="Members"
          onRowClick={(member) => navigate(`/app/members/${member.id}`)}
        />
      )}
    </>
  );
}
