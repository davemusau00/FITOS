import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DetailList,
  EmptyState,
  FilterBar,
  PageHeader,
  SearchBar,
  Select,
  StatusBadge,
  Tabs,
  WorkspacePage,
  type DataTableColumn
} from "@fitos/ui";
import type { ImplementationInquiryResponse, ImplementationInquiryStatus } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatDateTime, useToast } from "../shared";

const statuses: Array<ImplementationInquiryStatus | "all"> = [
  "all",
  "draft",
  "submitted",
  "qualified",
  "needs_clarification",
  "approved",
  "converted",
  "archived"
];

export function ImplementationInquiriesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ImplementationInquiryStatus | "all">("all");
  const inquiries = useQuery({
    queryKey: ["platform", "inquiries"],
    queryFn: () => api.implementationInquiries()
  });
  const rows = useMemo(
    () =>
      (inquiries.data ?? [])
        .filter((item) => {
          const term = search.trim().toLowerCase();
          return (
            (!term ||
              `${item.businessName ?? ""} ${item.contactName ?? ""} ${item.email ?? ""}`
                .toLowerCase()
                .includes(term)) &&
            (status === "all" || item.status === status)
          );
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [inquiries.data, search, status]
  );
  const columns: Array<DataTableColumn<ImplementationInquiryResponse>> = [
    {
      id: "business",
      header: "Business",
      cell: (item) => (
        <div>
          <strong>{item.businessName ?? "Untitled business"}</strong>
          <span className="fitos-data-table__muted">{item.contactName ?? "No contact"}</span>
        </div>
      )
    },
    { id: "contact", header: "Contact", cell: (item) => <span>{item.email ?? "No email"}</span> },
    { id: "status", header: "Status", cell: (item) => <StatusBadge status={item.status} /> },
    {
      id: "updated",
      header: "Updated",
      cell: (item) => <span>{formatDateTime(item.updatedAt)}</span>
    }
  ];
  if (inquiries.isLoading) return <PageLoading />;
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Assisted setup"
        title="Implementation queue"
        description="Qualify business discovery briefs and turn approved requirements into a reviewed tenant seed plan."
      />
      <ErrorNotice error={inquiries.error} />
      <FilterBar resultCount={rows.length}>
        <SearchBar
          aria-label="Search implementation inquiries"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search business, contact, or email…"
          value={search}
        />
        <Select
          aria-label="Filter by status"
          onChange={(event) => setStatus(event.target.value as ImplementationInquiryStatus | "all")}
          value={status}
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item === "all" ? "All statuses" : item.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </FilterBar>
      {rows.length ? (
        <DataTable
          columns={columns}
          data={rows}
          label="Implementation inquiries"
          onRowClick={(item) => navigate(`/platform/inquiries/${item.id}`)}
          mobileRenderer={(item) => (
            <button
              className="platform-tenant-mobile"
              onClick={() => navigate(`/platform/inquiries/${item.id}`)}
              type="button"
            >
              <strong>{item.businessName ?? "Untitled business"}</strong>
              <StatusBadge status={item.status} />
              <span>{item.contactName ?? item.email ?? "No contact"}</span>
            </button>
          )}
        />
      ) : (
        <EmptyState
          icon="spark"
          title="No matching inquiries"
          description="New assisted-setup submissions appear here. Adjust filters to review a different lifecycle state."
        />
      )}
    </WorkspacePage>
  );
}

function formatLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function PayloadValue({ value }: { value: unknown }): ReactNode {
  if (value == null || value === "") return <span className="muted">Not provided</span>;
  if (typeof value === "boolean") return <StatusBadge status={value ? "enabled" : "disabled"} />;
  if (Array.isArray(value))
    return value.length ? (
      <ul className="platform-value-list">
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === "object" ? (
              <PayloadObject value={item as Record<string, unknown>} />
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    ) : (
      <span className="muted">None</span>
    );
  if (typeof value === "object") return <PayloadObject value={value as Record<string, unknown>} />;
  return String(value);
}
function PayloadObject({ value }: { value: Record<string, unknown> }) {
  return (
    <div className="platform-payload-grid">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <span>{formatLabel(key)}</span>
          <PayloadValue value={item} />
        </div>
      ))}
    </div>
  );
}

export function ImplementationInquiryDetailPage() {
  const { inquiryId = "" } = useParams();
  const cache = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState("discovery");
  const inquiry = useQuery({
    queryKey: ["platform", "inquiry", inquiryId],
    queryFn: () => api.implementationInquiry(inquiryId),
    enabled: Boolean(inquiryId)
  });
  const manifest = useQuery({
    queryKey: ["platform", "inquiry", inquiryId, "seed-manifest"],
    queryFn: () => api.implementationSeedManifest(inquiryId),
    enabled: Boolean(inquiryId)
  });
  const status = useMutation({
    mutationFn: (next: ImplementationInquiryStatus) =>
      api.updateImplementationInquiryStatus(inquiryId, next),
    onSuccess: (_, next) => {
      void cache.invalidateQueries({ queryKey: ["platform", "inquiry", inquiryId] });
      void cache.invalidateQueries({ queryKey: ["platform", "inquiries"] });
      void cache.invalidateQueries({ queryKey: ["platform", "overview"] });
      toast.success(`Inquiry moved to ${next.replaceAll("_", " ")}.`);
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "Unable to update inquiry.")
  });
  if (inquiry.isLoading) return <PageLoading />;
  if (!inquiry.data)
    return <ErrorNotice error={inquiry.error ?? new Error("Inquiry not found.")} />;
  const item = inquiry.data;
  const nextActions: Array<{
    status: ImplementationInquiryStatus;
    label: string;
    variant?: "primary" | "secondary" | "danger";
  }> =
    item.status === "submitted"
      ? [
          { status: "qualified", label: "Mark qualified", variant: "primary" },
          { status: "needs_clarification", label: "Request clarification", variant: "secondary" }
        ]
      : item.status === "qualified" || item.status === "needs_clarification"
        ? [
            { status: "approved", label: "Approve for seed review", variant: "primary" },
            { status: "needs_clarification", label: "Needs clarification", variant: "secondary" }
          ]
        : item.status === "approved"
          ? [{ status: "converted", label: "Mark converted", variant: "primary" }]
          : [];
  return (
    <WorkspacePage density="record">
      <PageHeader
        eyebrow="Implementation brief"
        title={item.businessName ?? "Untitled business"}
        description={`${item.contactName ?? "Unknown contact"} · ${item.email ?? "No email"}`}
        actions={
          <>
            <StatusBadge status={item.status} />
            <Link className="fitos-button fitos-button--secondary" to="/platform/inquiries">
              Back to queue
            </Link>
          </>
        }
      />
      <div className="platform-action-strip">
        {nextActions.map((action) => (
          <Button
            key={action.status}
            loading={status.isPending}
            onClick={() => status.mutate(action.status)}
            variant={action.variant ?? "secondary"}
          >
            {action.label}
          </Button>
        ))}
        {item.status !== "archived" && item.status !== "converted" ? (
          <Button
            loading={status.isPending}
            onClick={() => status.mutate("archived")}
            variant="ghost"
          >
            Archive
          </Button>
        ) : null}
      </div>
      <Tabs
        activeId={tab}
        onChange={setTab}
        items={[
          { id: "discovery", label: "Discovery" },
          { id: "seed", label: "Seed preview" },
          { id: "history", label: "Submission" }
        ]}
      />
      {tab === "discovery" ? (
        <Card>
          <h2>Structured discovery</h2>
          <PayloadObject value={item.payload} />
        </Card>
      ) : null}
      {tab === "seed" ? (
        <Card>
          <h2>Deterministic seed preview</h2>
          {manifest.isLoading ? (
            <p className="muted">Building the reviewed preview…</p>
          ) : manifest.error ? (
            <ErrorNotice error={manifest.error} />
          ) : manifest.data ? (
            <div className="platform-seed-sections">
              {Object.entries(manifest.data)
                .filter(
                  ([key]) => !["schemaVersion", "sourceInquiryId", "generatedAt"].includes(key)
                )
                .map(([key, value]) => (
                  <section key={key}>
                    <h3>{formatLabel(key)}</h3>
                    <PayloadValue value={value} />
                  </section>
                ))}
            </div>
          ) : (
            <EmptyState
              title="No seed preview"
              description="A normalized seed preview could not be generated from this inquiry."
            />
          )}
        </Card>
      ) : null}
      {tab === "history" ? (
        <div className="platform-detail-grid">
          <Card>
            <h2>Submission metadata</h2>
            <DetailList
              items={[
                { label: "Inquiry ID", value: item.id },
                { label: "Schema version", value: item.schemaVersion },
                { label: "Created", value: formatDateTime(item.createdAt) },
                { label: "Updated", value: formatDateTime(item.updatedAt) },
                { label: "Submitted", value: formatDateTime(item.submittedAt) }
              ]}
            />
          </Card>
          <Card>
            <Alert title="Conversion guard" tone="info">
              This brief never creates or changes a tenant automatically. Conversion remains a
              reviewed Platform action.
            </Alert>
          </Card>
        </div>
      ) : null}
    </WorkspacePage>
  );
}
