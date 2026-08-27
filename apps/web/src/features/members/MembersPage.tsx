import { useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  SearchBar,
  StatusBadge
} from "@fitos/ui";
import type { MemberListItem } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { useBranch } from "../../app/branch-context";
import { PageLoading, ErrorNotice, formatDate } from "../shared";

export function MembersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [selectedQuickMember, setSelectedQuickMember] = useState<MemberListItem | null>(null);
  const [activeSegment, setActiveSegment] = useState<string>("all");
  const { activeBranchId, branches, setActiveBranch } = useBranch();

  const query = params.get("query") ?? "";
  const status = params.get("status") ?? "";
  const requestParams = useMemo(() => {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (status) next.set("status", status);
    else if (activeSegment === "active") next.set("status", "active");
    else if (activeSegment === "inactive") next.set("status", "inactive");
    if (activeBranchId) next.set("branchId", activeBranchId);
    next.set("limit", "100");
    return next;
  }, [query, status, activeSegment, activeBranchId]);

  const members = useQuery({
    queryKey: ["members", activeBranchId, requestParams.toString()],
    queryFn: () => api.members(requestParams),
    enabled: Boolean(activeBranchId)
  });

  const allMembers = members.data?.data ?? [];
  const activeCount = allMembers.filter((m) => m.status === "active").length;
  const inactiveCount = allMembers.filter((m) => m.status === "inactive").length;

  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };

  const memberColumns: DataTableColumn<MemberListItem>[] = [
    {
      id: "member",
      header: "Member",
      cell: (member) => {
        const initials = `${member.firstName[0] ?? ""}${member.lastName?.[0] ?? ""}`;
        return (
          <div className="table-member-cell">
            <div className="table-member-avatar">{initials}</div>
            <div>
              <strong className="fitos-data-table__primary">
                {member.firstName} {member.lastName ?? ""}
              </strong>
              <span className="fitos-data-table__muted">
                {member.email ?? member.phone ?? "No contact"}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      id: "memberNumber",
      header: "Member #",
      cell: (m) =>
        m.memberNumber ? (
          <span className="member-profile-header__number">#{m.memberNumber}</span>
        ) : (
          "—"
        )
    },
    {
      id: "phone",
      header: "Phone",
      cell: (member) => member.phone ?? "—"
    },
    {
      id: "status",
      header: "Status",
      cell: (member) => <StatusBadge status={member.status} />
    },
    {
      id: "joined",
      header: "Joined",
      cell: (member) => formatDate(member.joinedAt)
    },
    {
      id: "actions",
      header: "",
      cell: (member) => (
        <div className="form-actions">
          <button
            className="fitos-button fitos-button--ghost fitos-button--small"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedQuickMember(member);
            }}
            type="button"
          >
            Quick View
          </button>
          <button
            className="fitos-button fitos-button--secondary fitos-button--small"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/members/${member.id}`);
            }}
            type="button"
          >
            Profile →
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Members Directory"
        description="Search, view, and manage every member across your facilities."
        actions={
          <Link className="fitos-button fitos-button--primary" to="/app/members/new">
            <Icon name="plus" size={16} />
            Add member
          </Link>
        }
      />

      <ErrorNotice error={members.error} />

      {/* KPI Stats Row */}
      <div className="kpi-grid">
        <Card className="kpi kpi--energy">
          <span>Total Members</span>
          <strong>{allMembers.length}</strong>
        </Card>
        <Card className="kpi">
          <span>Active Members</span>
          <strong>{activeCount}</strong>
        </Card>
        <Card className="kpi">
          <span>Retention Rate</span>
          <strong>
            {allMembers.length ? `${Math.round((activeCount / allMembers.length) * 100)}%` : "100%"}
          </strong>
        </Card>
        <Card className="kpi">
          <span>Inactive / Lapsed</span>
          <strong>{inactiveCount}</strong>
        </Card>
      </div>

      {/* Segment Tabs */}
      <div className="member-tab-bar" style={{ marginBottom: "1rem" }}>
        {[
          { id: "all", label: `All (${allMembers.length})` },
          { id: "active", label: `Active (${activeCount})` },
          { id: "inactive", label: `Inactive (${inactiveCount})` }
        ].map((tab) => (
          <button
            className={`member-tab-bar__tab${activeSegment === tab.id ? " member-tab-bar__tab--active" : ""}`}
            key={tab.id}
            onClick={() => {
              setActiveSegment(tab.id);
              set("status", "");
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Row */}
      <section className="filter-row">
        <SearchBar
          aria-label="Search members"
          onChange={(event) => set("query", event.currentTarget.value)}
          placeholder="Search name, phone or email..."
          value={query}
        />
        <select
          aria-label="Filter members by branch"
          className="fitos-control"
          onChange={(event) => setActiveBranch(event.currentTarget.value)}
          value={activeBranchId}
        >
          {branches.map((branch) => (
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
      ) : !allMembers.length ? (
        <EmptyState
          action={
            <Link className="fitos-button fitos-button--primary" to="/app/members/new">
              Add first member
            </Link>
          }
          description="Members will appear here with their contact information, status, and join date."
          title="No matching members"
        />
      ) : (
        <DataTable
          columns={memberColumns}
          data={allMembers}
          label="Members"
          onRowClick={(member) => setSelectedQuickMember(member)}
        />
      )}

      {/* Quick Member Side Drawer */}
      {selectedQuickMember && (
        <Modal
          description={`Member #${selectedQuickMember.memberNumber ?? "—"} · Joined ${formatDate(selectedQuickMember.joinedAt)}`}
          isOpen={true}
          onClose={() => setSelectedQuickMember(null)}
          title={`${selectedQuickMember.firstName} ${selectedQuickMember.lastName ?? ""}`.trim()}
        >
          <div className="form-stack">
            <div className="table-member-cell" style={{ padding: "0.5rem 0" }}>
              <div
                className="table-member-avatar"
                style={{ width: "3rem", height: "3rem", fontSize: "1.1rem" }}
              >
                {selectedQuickMember.firstName[0]}
                {selectedQuickMember.lastName?.[0]}
              </div>
              <div>
                <strong style={{ fontSize: "1.15rem", display: "block" }}>
                  {selectedQuickMember.firstName} {selectedQuickMember.lastName ?? ""}
                </strong>
                <StatusBadge status={selectedQuickMember.status} />
              </div>
            </div>

            <Card>
              <dl className="detail-list">
                <div>
                  <dt>Phone</dt>
                  <dd>{selectedQuickMember.phone ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selectedQuickMember.email ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Member Number</dt>
                  <dd>{selectedQuickMember.memberNumber ?? "Not assigned"}</dd>
                </div>
                <div>
                  <dt>Joined Date</dt>
                  <dd>{formatDate(selectedQuickMember.joinedAt)}</dd>
                </div>
              </dl>
            </Card>

            <div className="form-actions" style={{ justifyContent: "space-between" }}>
              <Button onClick={() => setSelectedQuickMember(null)} variant="ghost">
                Close
              </Button>
              <div className="form-actions">
                <Button
                  onClick={() => {
                    const id = selectedQuickMember.id;
                    setSelectedQuickMember(null);
                    navigate(`/app/bookings/new?memberId=${id}`);
                  }}
                  variant="secondary"
                >
                  Book Class
                </Button>
                <Button
                  onClick={() => {
                    const id = selectedQuickMember.id;
                    setSelectedQuickMember(null);
                    navigate(`/app/members/${id}`);
                  }}
                  variant="primary"
                >
                  Full Profile →
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
