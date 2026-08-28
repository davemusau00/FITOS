import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  SearchBar,
  Select,
  StatusBadge,
  WorkspacePage,
  type DataTableColumn
} from "@fitos/ui";
import type { PlatformTenantControlRecord, TenantAccountStatus } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading } from "../shared";

type TenantRow = PlatformTenantControlRecord & { id: string };
const statuses: Array<TenantAccountStatus | "all"> = [
  "all",
  "trial",
  "active",
  "grace",
  "suspended",
  "cancelled",
  "archived"
];

export function PlatformTenantsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TenantAccountStatus | "all">("all");
  const [plan, setPlan] = useState("all");
  const tenants = useQuery({ queryKey: ["platform", "tenants"], queryFn: api.platformTenants });
  const rows = useMemo<TenantRow[]>(
    () =>
      (tenants.data ?? [])
        .map((record) => ({ ...record, id: record.tenant.id }))
        .filter((record) => {
          const term = search.trim().toLowerCase();
          const matchesSearch =
            !term ||
            record.tenant.name.toLowerCase().includes(term) ||
            record.tenant.slug.toLowerCase().includes(term);
          return (
            matchesSearch &&
            (status === "all" || record.subscription.status === status) &&
            (plan === "all" || record.subscription.plan === plan)
          );
        })
        .sort((a, b) => a.tenant.name.localeCompare(b.tenant.name)),
    [plan, search, status, tenants.data]
  );
  const columns: Array<DataTableColumn<TenantRow>> = [
    {
      id: "tenant",
      header: "Tenant",
      cell: (row) => (
        <div>
          <strong>{row.tenant.name}</strong>
          <span className="fitos-data-table__muted">{row.tenant.slug}</span>
        </div>
      )
    },
    {
      id: "status",
      header: "Lifecycle",
      cell: (row) => <StatusBadge status={row.subscription.status} />
    },
    { id: "plan", header: "Plan", cell: (row) => <span>{row.subscription.planName}</span> },
    {
      id: "usage",
      header: "Usage",
      cell: (row) => (
        <span>
          {row.usage.activeMembers.toLocaleString()} members · {row.usage.activeStaff} staff ·{" "}
          {row.usage.branches} branches
        </span>
      )
    },
    {
      id: "capabilities",
      header: "Capabilities",
      cell: (row) => <span>{row.subscription.capabilities.length} enabled</span>
    }
  ];
  if (tenants.isLoading) return <PageLoading />;
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Customers"
        title="Tenants"
        description="Find a customer, understand its lifecycle and limits, then open the control record for reasoned changes."
      />
      <ErrorNotice error={tenants.error} onRetry={() => void tenants.refetch()} />
      <FilterBar resultCount={rows.length}>
        <SearchBar
          aria-label="Search tenants"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or slug…"
          value={search}
        />
        <Select
          aria-label="Filter by lifecycle"
          onChange={(event) => setStatus(event.target.value as TenantAccountStatus | "all")}
          value={status}
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item === "all" ? "All lifecycle states" : item.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by plan"
          onChange={(event) => setPlan(event.target.value)}
          value={plan}
        >
          <option value="all">All plans</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </Select>
      </FilterBar>
      {rows.length ? (
        <DataTable
          columns={columns}
          data={rows}
          label="Platform tenants"
          onRowClick={(row) => navigate(`/platform/tenants/${row.tenant.id}`)}
          mobileRenderer={(row) => (
            <button
              className="platform-tenant-mobile"
              onClick={() => navigate(`/platform/tenants/${row.tenant.id}`)}
              type="button"
            >
              <div>
                <strong>{row.tenant.name}</strong>
                <span>{row.tenant.slug}</span>
              </div>
              <StatusBadge status={row.subscription.status} />
              <span>
                {row.usage.activeMembers} members · {row.subscription.planName}
              </span>
            </button>
          )}
        />
      ) : (
        <EmptyState
          icon="building"
          title="No matching tenants"
          description="Adjust the search or lifecycle filters to return to the full customer directory."
        />
      )}
    </WorkspacePage>
  );
}
