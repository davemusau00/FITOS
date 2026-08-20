import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  EmptyState,
  PageHeader,
  SearchBar,
  StatusBadge
} from "@fitos/ui";
import type { PaymentTransactionResponse } from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatCurrency, formatDateTime } from "../shared";

export function UnmatchedPaymentsPage() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransactionResponse | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const unmatched = useQuery({
    queryKey: ["payments", "unmatched"],
    queryFn: () => {
      const params = new URLSearchParams({ unmatched: "true", limit: "50" });
      return api.payments(params);
    }
  });

  const members = useQuery({
    queryKey: ["members", memberSearch],
    queryFn: () =>
      api.members(
        new URLSearchParams({
          limit: "10",
          ...(memberSearch ? { query: memberSearch } : {})
        })
      )
  });

  const columns: DataTableColumn<PaymentTransactionResponse>[] = [
    {
      id: "amount",
      header: "Amount",
      cell: (p) => (
        <div>
          <strong className="fitos-data-table__primary">
            {formatCurrency(p.amount.amountMinor, p.amount.currency)}
          </strong>
          <span className="fitos-data-table__muted" style={{ textTransform: "capitalize" }}>
            {p.method.replace("_", " ")}
          </span>
        </div>
      )
    },
    {
      id: "reference",
      header: "Reference / Details",
      cell: (p) => p.reference || p.note || "No reference"
    },
    {
      id: "date",
      header: "Date",
      cell: (p) => formatDateTime(p.recordedAt)
    },
    {
      id: "action",
      header: "",
      cell: (p) => (
        <Button
          onClick={() => setSelectedTransaction(p)}
          size="small"
          variant={selectedTransaction?.id === p.id ? "primary" : "ghost"}
        >
          {selectedTransaction?.id === p.id ? "Selected" : "Reconcile"}
        </Button>
      )
    }
  ];

  if (unmatched.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader
        eyebrow="Financial Operations"
        title="Unmatched Payments"
        description="Review incoming or recorded transactions that require matching with a member or membership."
      />

      <ErrorNotice error={unmatched.error} />

      <div style={{ display: "grid", gridTemplateColumns: selectedTransaction ? "1fr 1fr" : "1fr", gap: "1.5rem" }}>
        <Card>
          <h2>Unallocated / Unmatched Transactions</h2>
          {!unmatched.data?.data.length ? (
            <EmptyState
              description="All recorded payments have been allocated to members or packages."
              title="No unmatched transactions"
            />
          ) : (
            <DataTable columns={columns} data={unmatched.data.data} label="Unmatched Transactions" />
          )}
        </Card>

        {selectedTransaction ? (
          <Card>
            <h2>Match Transaction</h2>
            <div className="form-stack">
              <div className="selected-entity-badge">
                <div className="selected-entity-badge__info">
                  <strong>
                    {formatCurrency(
                      selectedTransaction.amount.amountMinor,
                      selectedTransaction.amount.currency
                    )}
                  </strong>
                  <span>{selectedTransaction.reference || selectedTransaction.method}</span>
                </div>
                <StatusBadge status={selectedTransaction.status} />
              </div>

              <SearchBar
                aria-label="Find matching member"
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search member by name or phone..."
                value={memberSearch}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {members.data?.data.map((m) => (
                  <div key={m.id} style={{ padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                    <div>
                      <strong>{m.firstName} {m.lastName}</strong>
                      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                        {m.phone ?? m.email}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        // In a full implementation this matches the transaction
                        setSelectedTransaction(null);
                      }}
                      size="small"
                      variant="secondary"
                    >
                      Allocate to Member
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
