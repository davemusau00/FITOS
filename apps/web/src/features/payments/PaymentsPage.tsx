import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  SearchBar,
  StatusBadge
} from "@fitos/ui";
import type {
  BranchResponse,
  CreatePaymentRequest,
  PaymentMethod,
  PaymentTransactionResponse
} from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatCurrency, formatDateTime } from "../shared";

type PaymentFormValues = {
  branchId: string;
  memberId: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  reference: string;
  note: string;
  allocationType: "walkIn" | "other";
};

export function PaymentsPage() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null);
  const [paymentActionReason, setPaymentActionReason] = useState("");

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const payments = useQuery({
    queryKey: ["payments", selectedBranch, selectedMethod, selectedStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedBranch) params.set("branchId", selectedBranch);
      if (selectedMethod) params.set("method", selectedMethod);
      if (selectedStatus) params.set("status", selectedStatus);
      params.set("limit", "100");
      return api.payments(params);
    }
  });

  const voidMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      api.voidPayment(paymentId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      setVoidingPaymentId(null);
      setPaymentActionReason("");
    }
  });

  const refundMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      api.refundPayment(paymentId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      setRefundingPaymentId(null);
      setPaymentActionReason("");
    }
  });

  const data = payments.data?.data ?? [];
  const completedPayments = data.filter((p) => p.status === "completed");
  const totalCollectedMinor = completedPayments.reduce(
    (sum, p) => sum + Number(p.amount.amountMinor),
    0
  );

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
      id: "branch",
      header: "Branch",
      cell: (p) => branches.data?.find((b) => b.id === p.branchId)?.name ?? "Branch"
    },
    {
      id: "reference",
      header: "Reference",
      cell: (p) => (
        <div>
          <span>{p.reference || "—"}</span>
          {p.note ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>
              {p.note}
            </p>
          ) : null}
        </div>
      )
    },
    {
      id: "allocation",
      header: "Allocation",
      cell: (p) => (
        <span style={{ textTransform: "capitalize" }}>{p.allocationType || "Unallocated"}</span>
      )
    },
    {
      id: "status",
      header: "Status",
      cell: (p) => <StatusBadge status={p.status} />
    },
    {
      id: "date",
      header: "Date & Time",
      cell: (p) => formatDateTime(p.recordedAt)
    },
    {
      id: "actions",
      header: "",
      cell: (p) =>
        p.status === "completed" && can(auth, "payment:refund") ? (
          <div className="form-actions">
            <Button onClick={() => setRefundingPaymentId(p.id)} size="small" variant="ghost">
              Refund
            </Button>
            <Button onClick={() => setVoidingPaymentId(p.id)} size="small" variant="ghost">
              Void
            </Button>
          </div>
        ) : null
    }
  ];

  if (payments.isLoading || branches.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader
        eyebrow="Financial Operations"
        title="Payments"
        description="Record and review POS payments, member cash/bank transactions, and reconciliations."
        actions={
          can(auth, "payment:record") ? (
            <Button icon="plus" onClick={() => setIsRecordingPayment(true)}>
              Record payment
            </Button>
          ) : null
        }
      />

      <ErrorNotice error={payments.error} />
      <ErrorNotice error={voidMutation.error ?? refundMutation.error} />

      <section className="kpi-grid">
        <Card className="kpi kpi--energy">
          <span>Collected (completed)</span>
          <strong>
            {formatCurrency(
              String(totalCollectedMinor),
              data[0]?.amount.currency ?? auth?.tenant.currency ?? "KES"
            )}
          </strong>
        </Card>
        <Card className="kpi">
          <span>Total Transactions</span>
          <strong>{data.length}</strong>
        </Card>
        <Card className="kpi">
          <span>Cash / M-Pesa / Bank</span>
          <strong>{completedPayments.length}</strong>
        </Card>
        <Card className="kpi">
          <span>Voided</span>
          <strong>{data.filter((p) => p.status === "voided").length}</strong>
        </Card>
      </section>

      <section className="filter-row">
        <select
          aria-label="Filter by branch"
          className="fitos-control"
          onChange={(e) => setSelectedBranch(e.target.value)}
          value={selectedBranch}
        >
          <option value="">All branches</option>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by payment method"
          className="fitos-control"
          onChange={(e) => setSelectedMethod(e.target.value)}
          value={selectedMethod}
        >
          <option value="">All payment methods</option>
          <option value="cash">Cash</option>
          <option value="mpesa">M-Pesa</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>

        <select
          aria-label="Filter by status"
          className="fitos-control"
          onChange={(e) => setSelectedStatus(e.target.value)}
          value={selectedStatus}
        >
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="voided">Voided</option>
          <option value="pending">Pending</option>
        </select>
      </section>

      {!data.length ? (
        <EmptyState
          action={
            can(auth, "payment:record") ? (
              <Button icon="plus" onClick={() => setIsRecordingPayment(true)}>
                Record first payment
              </Button>
            ) : undefined
          }
          description="Record cash, bank transfer, or M-Pesa payments for memberships and walk-in passes."
          title="No payment records found"
        />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          label="Payments Ledger"
          mobileRenderer={(payment) => (
            <Card className="fitos-mobile-data-card">
              <div>
                <strong className="fitos-data-table__primary">
                  {formatCurrency(payment.amount.amountMinor, payment.amount.currency)}
                </strong>
                <span className="fitos-data-table__muted" style={{ textTransform: "capitalize" }}>
                  {payment.method.replace("_", " ")} · {formatDateTime(payment.recordedAt)}
                </span>
              </div>
              <div className="fitos-mobile-data-card__meta">
                <StatusBadge status={payment.status} />
                <span>
                  {branches.data?.find((branch) => branch.id === payment.branchId)?.name ??
                    "Branch"}
                </span>
              </div>
              <span className="fitos-data-table__muted">
                {payment.reference || "No reference"} · {payment.allocationType || "Unallocated"}
              </span>
              {payment.note ? (
                <span className="fitos-data-table__muted">{payment.note}</span>
              ) : null}
              {payment.status === "completed" && can(auth, "payment:refund") ? (
                <div className="form-actions">
                  <Button
                    onClick={() => setRefundingPaymentId(payment.id)}
                    size="small"
                    variant="ghost"
                  >
                    Refund
                  </Button>
                  <Button
                    onClick={() => setVoidingPaymentId(payment.id)}
                    size="small"
                    variant="ghost"
                  >
                    Void
                  </Button>
                </div>
              ) : null}
            </Card>
          )}
        />
      )}

      {/* Record Payment Modal */}
      {isRecordingPayment ? (
        <RecordPaymentModal
          branches={branches.data ?? []}
          defaultCurrency={auth?.tenant.currency ?? "KES"}
          isOpen={true}
          onClose={() => setIsRecordingPayment(false)}
          onSuccess={async () => {
            await queryClient.refetchQueries({ queryKey: ["payments"] });
            setIsRecordingPayment(false);
          }}
        />
      ) : null}

      {/* Void confirmation modal */}
      {voidingPaymentId ? (
        <Modal
          description="Are you sure you want to void this payment record? This action is audited."
          isOpen={true}
          onClose={() => setVoidingPaymentId(null)}
          title="Void payment transaction"
        >
          <div className="form-stack">
            <FormField htmlFor="voidReason" label="Reason">
              <input
                className="fitos-control"
                id="voidReason"
                onChange={(event) => setPaymentActionReason(event.target.value)}
                placeholder="Why is this record being voided?"
                value={paymentActionReason}
              />
            </FormField>
            <div className="form-actions">
              <Button
                onClick={() => {
                  setVoidingPaymentId(null);
                  setPaymentActionReason("");
                }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={!paymentActionReason.trim()}
                loading={voidMutation.isPending}
                onClick={() =>
                  voidMutation.mutate({
                    paymentId: voidingPaymentId,
                    reason: paymentActionReason.trim()
                  })
                }
                variant="primary"
              >
                Confirm Void
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {refundingPaymentId ? (
        <Modal
          description="Record that the full payment amount was returned. This financial action is audited."
          isOpen={true}
          onClose={() => {
            setRefundingPaymentId(null);
            setPaymentActionReason("");
          }}
          title="Refund payment transaction"
        >
          <div className="form-stack">
            <FormField htmlFor="refundReason" label="Reason">
              <input
                className="fitos-control"
                id="refundReason"
                onChange={(event) => setPaymentActionReason(event.target.value)}
                placeholder="Why is this payment being refunded?"
                value={paymentActionReason}
              />
            </FormField>
            <div className="form-actions">
              <Button
                onClick={() => {
                  setRefundingPaymentId(null);
                  setPaymentActionReason("");
                }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={!paymentActionReason.trim()}
                loading={refundMutation.isPending}
                onClick={() =>
                  refundMutation.mutate({
                    paymentId: refundingPaymentId,
                    reason: paymentActionReason.trim()
                  })
                }
                variant="primary"
              >
                Confirm Refund
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function RecordPaymentModal({
  isOpen,
  onClose,
  branches,
  defaultCurrency,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  branches: BranchResponse[];
  defaultCurrency: string;
  onSuccess: () => Promise<void>;
}) {
  const [error, setError] = useState<unknown>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);

  const members = useQuery({
    queryKey: ["members-picker", memberSearch],
    queryFn: () =>
      api.members(
        new URLSearchParams({
          limit: "10",
          ...(memberSearch ? { query: memberSearch } : {})
        })
      )
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<PaymentFormValues>({
    defaultValues: {
      branchId: branches[0]?.id ?? "",
      amount: "1500",
      currency: defaultCurrency,
      method: "cash",
      reference: "",
      note: "",
      allocationType: "other"
    }
  });

  const onSubmit = async (values: PaymentFormValues) => {
    setError(null);
    try {
      const payload: CreatePaymentRequest = {
        branchId: values.branchId,
        memberId: selectedMember?.id || null,
        amount: {
          amountMinor: String(Math.round(parseFloat(values.amount) * 100)),
          currency: values.currency.trim().toUpperCase()
        },
        method: values.method,
        reference: values.reference.trim() || null,
        note: values.note.trim() || null,
        allocationType: selectedMember ? values.allocationType : null
      };
      await api.createPayment(payload);
      await onSuccess();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Modal
      description="Record an in-person, bank transfer, or M-Pesa transaction."
      isOpen={isOpen}
      onClose={onClose}
      title="Record payment"
    >
      <form className="form-stack" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-grid">
          <FormField error={errors.branchId?.message} htmlFor="payBranch" label="Branch">
            <select
              className="fitos-control"
              id="payBranch"
              {...register("branchId", { required: "Branch is required" })}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            error={errors.amount?.message}
            htmlFor="payAmount"
            label="Amount (in standard units)"
          >
            <input
              className="fitos-control"
              id="payAmount"
              step="0.01"
              type="number"
              {...register("amount", { required: "Amount is required" })}
            />
          </FormField>

          <FormField htmlFor="payMethod" label="Payment Method">
            <select className="fitos-control" id="payMethod" {...register("method")}>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card / POS</option>
              <option value="other">Other</option>
            </select>
          </FormField>

          <FormField htmlFor="payAlloc" label="Allocation Type">
            <select className="fitos-control" id="payAlloc" {...register("allocationType")}>
              <option value="walkIn">Walk-in Day Pass</option>
              <option value="other">General member payment</option>
            </select>
          </FormField>

          <FormField htmlFor="payRef" label="Payment Reference / Receipt #" optional>
            <input
              className="fitos-control"
              id="payRef"
              placeholder="e.g. QKH7890X / Cheque 102"
              {...register("reference")}
            />
          </FormField>

          <FormField htmlFor="payNote" label="Internal Note" optional>
            <input
              className="fitos-control"
              id="payNote"
              placeholder="e.g. Paid at front desk"
              {...register("note")}
            />
          </FormField>
        </div>

        {/* Member selector */}
        <div style={{ marginTop: "0.5rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              fontWeight: 600
            }}
          >
            Associated Member (optional)
          </label>
          {selectedMember ? (
            <div className="selected-entity-badge" style={{ marginBottom: "0.5rem" }}>
              <div className="selected-entity-badge__info">
                <strong>{selectedMember.name}</strong>
              </div>
              <Button onClick={() => setSelectedMember(null)} size="small" variant="ghost">
                Clear
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <SearchBar
                aria-label="Find member"
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search member by name..."
                value={memberSearch}
              />
              {memberSearch && members.data?.data.length ? (
                <div
                  style={{
                    maxHeight: "120px",
                    overflowY: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0.25rem"
                  }}
                >
                  {members.data.data.map((m) => (
                    <button
                      key={m.id}
                      className="fitos-button fitos-button--ghost"
                      onClick={() => {
                        setSelectedMember({
                          id: m.id,
                          name: `${m.firstName} ${m.lastName}`.trim()
                        });
                        setMemberSearch("");
                      }}
                      style={{ width: "100%", justifyContent: "flex-start", padding: "0.4rem" }}
                      type="button"
                    >
                      {m.firstName} {m.lastName} ({m.phone ?? m.email ?? "no contact"})
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <ErrorNotice error={error} />

        <div className="form-actions">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button loading={isSubmitting} type="submit">
            Confirm & Save Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
