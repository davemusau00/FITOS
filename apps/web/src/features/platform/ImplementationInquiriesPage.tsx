import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Button, Card, PageHeader, StatusBadge } from "@fitos/ui";
import type { ImplementationInquiryStatus } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatDateTime } from "../shared";

const statuses: ImplementationInquiryStatus[] = [
  "submitted",
  "qualified",
  "needs_clarification",
  "approved",
  "archived"
];

export function ImplementationInquiriesPage() {
  const inquiries = useQuery({
    queryKey: ["implementation-inquiries"],
    queryFn: () => api.implementationInquiries()
  });
  if (inquiries.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader
        title="Implementation inquiries"
        description="Review assisted FITOS setup briefs before any tenant is created."
      />
      <ErrorNotice error={inquiries.error} />
      <div className="card-grid">
        {(inquiries.data ?? []).map((item) => (
          <Card key={item.id}>
            <h3>{item.businessName ?? "Untitled business"}</h3>
            <p>
              {item.contactName ?? "No contact"} · {item.email ?? "No email"}
            </p>
            <StatusBadge status={item.status} />
            <p className="muted">Updated {formatDateTime(item.updatedAt)}</p>
            <Link to={`/app/platform/inquiries/${item.id}`}>Open inquiry →</Link>
          </Card>
        ))}
        {!inquiries.data?.length && (
          <Card>
            <p>No implementation inquiries yet.</p>
          </Card>
        )}
      </div>
    </>
  );
}

export function ImplementationInquiryDetailPage() {
  const { inquiryId = "" } = useParams();
  const cache = useQueryClient();
  const inquiry = useQuery({
    queryKey: ["implementation-inquiry", inquiryId],
    queryFn: () => api.implementationInquiry(inquiryId),
    enabled: Boolean(inquiryId)
  });
  const manifest = useQuery({
    queryKey: ["implementation-seed-manifest", inquiryId],
    queryFn: () => api.implementationSeedManifest(inquiryId),
    enabled: Boolean(inquiryId)
  });
  const status = useMutation({
    mutationFn: (next: ImplementationInquiryStatus) =>
      api.updateImplementationInquiryStatus(inquiryId, next),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["implementation-inquiry", inquiryId] });
      void cache.invalidateQueries({ queryKey: ["implementation-inquiries"] });
    }
  });
  if (inquiry.isLoading) return <PageLoading />;
  if (!inquiry.data)
    return <ErrorNotice error={inquiry.error ?? new Error("Inquiry not found.")} />;
  const item = inquiry.data;
  return (
    <>
      <PageHeader
        title={item.businessName ?? "Implementation inquiry"}
        description={`${item.contactName ?? "Unknown contact"} · ${item.email ?? "No email"}`}
        actions={<Link to="/app/platform/inquiries">Back to inquiries</Link>}
      />
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {statuses.map((next) => (
          <Button
            key={next}
            size="small"
            variant={item.status === next ? "primary" : "secondary"}
            onClick={() => status.mutate(next)}
          >
            {next.replace(/_/g, " ")}
          </Button>
        ))}
      </div>
      <div className="two-column-grid">
        <Card>
          <h2>Discovery payload</h2>
          <pre style={{ overflow: "auto", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(item.payload, null, 2)}
          </pre>
        </Card>
        <Card>
          <h2>Seed manifest preview</h2>
          {manifest.isLoading ? (
            <p>Building preview…</p>
          ) : (
            <pre style={{ overflow: "auto", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(manifest.data, null, 2)}
            </pre>
          )}
        </Card>
      </div>
    </>
  );
}
