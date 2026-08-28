import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  EmptyState,
  FilterBar,
  PageHeader,
  SearchBar,
  Timeline,
  WorkspacePage
} from "@fitos/ui";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

export function PlatformAuditPage() {
  const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: ["platform", "audit"], queryFn: api.platformAudit });
  const events = useMemo(
    () =>
      (query.data ?? []).filter(
        (event) =>
          !search.trim() ||
          `${event.action} ${event.resourceType} ${event.resourceId ?? ""}`
            .toLowerCase()
            .includes(search.trim().toLowerCase())
      ),
    [query.data, search]
  );
  if (query.isLoading) return <PageLoading />;
  return (
    <WorkspacePage density="record">
      <PageHeader
        eyebrow="Governance"
        title="Platform audit"
        description="Review control-plane changes without exposing private tenant operating records."
      />
      <ErrorNotice error={query.error} />
      <FilterBar resultCount={events.length}>
        <SearchBar
          aria-label="Search platform audit"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search action or resource…"
          value={search}
        />
      </FilterBar>
      <Card>
        <Timeline
          items={events.map((event) => ({
            id: event.id,
            title: event.action.replaceAll("_", " "),
            meta: formatDateTime(event.createdAt),
            body: `${event.resourceType} · ${event.resourceId ?? "No resource identifier"}`,
            tone:
              event.action.includes("suspend") ||
              event.action.includes("cancel") ||
              event.action.includes("revoke")
                ? "warning"
                : "info"
          }))}
          empty={
            <EmptyState
              icon="shield"
              title="No matching platform activity"
              description="Control-plane changes appear here after lifecycle, capability, or implementation actions."
            />
          }
        />
      </Card>
    </WorkspacePage>
  );
}
