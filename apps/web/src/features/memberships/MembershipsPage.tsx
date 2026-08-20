import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Checkbox,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FormField,
  Icon,
  Modal,
  PageHeader,
  SearchBar,
  StatusBadge
} from "@fitos/ui";
import type {
  BranchResponse,
  CreateMembershipPlanRequest,
  MembershipPlanResponse
} from "@fitos/contracts";
import { can, useAuth } from "../../app/auth";
import { api } from "../../lib/api/client";
import { ErrorNotice, PageLoading, formatCurrency, formatDate } from "../shared";

type PlanFormValues = {
  name: string;
  slug: string;
  priceAmount: string;
  currency: string;
  durationDays: string;
  includedCredits: number;
  branchId: string;
  publicVisible: boolean;
};

export function MembershipsPage() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"plans" | "active">("plans");
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [assigningMember, setAssigningMember] = useState<{ id: string; name: string } | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const plans = useQuery({
    queryKey: ["membership-plans", selectedBranch],
    queryFn: () => api.membershipPlans(selectedBranch || undefined)
  });
  const members = useQuery({
    queryKey: ["members", memberSearch],
    queryFn: () =>
      api.members(
        new URLSearchParams({
          limit: "50",
          ...(memberSearch ? { query: memberSearch } : {})
        })
      )
  });

  const planColumns: DataTableColumn<MembershipPlanResponse>[] = [
    {
      id: "plan",
      header: "Plan name",
      cell: (p) => (
        <div>
          <strong className="fitos-data-table__primary">{p.name}</strong>
          <span className="fitos-data-table__muted">{p.slug}</span>
        </div>
      )
    },
    {
      id: "price",
      header: "Price",
      cell: (p) =>
        p.price ? formatCurrency(p.price.amountMinor, p.price.currency) : "Free / Trial"
    },
    {
      id: "duration",
      header: "Duration",
      cell: (p) => (p.durationDays ? `${p.durationDays} days` : "Ongoing")
    },
    {
      id: "credits",
      header: "Included credits",
      cell: (p) => `${p.includedCredits} sessions`
    },
    {
      id: "branch",
      header: "Branch",
      cell: (p) =>
        p.branchId
          ? (branches.data?.find((b) => b.id === p.branchId)?.name ?? "Branch")
          : "All branches"
    },
    {
      id: "public",
      header: "Public sale",
      cell: (p) => (p.publicVisible ? "Yes" : "Staff only")
    },
    {
      id: "status",
      header: "Status",
      cell: (p) => <StatusBadge status={p.isActive ? "active" : "inactive"} />
    }
  ];

  if (plans.isLoading || branches.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Memberships"
        description="Define packages, monthly plans, punch passes, and track member entitlements."
        actions={
          can(auth, "membership:manage") ? (
            <Button icon="plus" onClick={() => setIsCreatingPlan(true)}>
              New membership plan
            </Button>
          ) : null
        }
      />

      <ErrorNotice error={plans.error} />

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.25rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "0.5rem"
        }}
      >
        <button
          className={`fitos-button ${activeTab === "plans" ? "fitos-button--primary" : "fitos-button--ghost"}`}
          onClick={() => setActiveTab("plans")}
          type="button"
        >
          Membership Plans ({plans.data?.length ?? 0})
        </button>
        <button
          className={`fitos-button ${activeTab === "active" ? "fitos-button--primary" : "fitos-button--ghost"}`}
          onClick={() => setActiveTab("active")}
          type="button"
        >
          Assign & Member Entitlements
        </button>
      </div>

      {activeTab === "plans" ? (
        <>
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
          </section>

          {!plans.data?.length ? (
            <EmptyState
              action={
                can(auth, "membership:manage") ? (
                  <Button icon="plus" onClick={() => setIsCreatingPlan(true)}>
                    Create first plan
                  </Button>
                ) : undefined
              }
              description="Membership plans grant credits for class bookings and recurring gym access."
              title="No membership plans"
            />
          ) : (
            <DataTable columns={planColumns} data={plans.data} label="Membership Plans" />
          )}
        </>
      ) : (
        <Card>
          <div className="section-header-row" style={{ marginTop: 0 }}>
            <h2>Member Entitlement Management</h2>
            <SearchBar
              aria-label="Search members"
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search member by name, phone or email..."
              value={memberSearch}
            />
          </div>

          <div style={{ marginTop: "1rem" }}>
            {members.isLoading ? (
              <PageLoading />
            ) : !members.data?.data.length ? (
              <EmptyState description="Try another search query" title="No members found" />
            ) : (
              <div className="booking-stepper__grid">
                {members.data.data.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: "1rem",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface)"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start"
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "1.05rem" }}>
                          {m.firstName} {m.lastName}
                        </strong>
                        <p className="muted" style={{ margin: "0.25rem 0", fontSize: "0.875rem" }}>
                          {m.phone ?? m.email ?? "No contact details"}
                        </p>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                      <Link
                        className="fitos-button fitos-button--ghost fitos-button--small"
                        to={`/app/members/${m.id}`}
                      >
                        View Profile
                      </Link>
                      {can(auth, "membership:manage") ? (
                        <Button
                          onClick={() =>
                            setAssigningMember({
                              id: m.id,
                              name: `${m.firstName} ${m.lastName}`.trim()
                            })
                          }
                          size="small"
                          variant="secondary"
                        >
                          Assign Plan
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Plan Creator Modal */}
      {isCreatingPlan ? (
        <CreatePlanModal
          branches={branches.data ?? []}
          defaultCurrency={auth?.tenant.currency ?? "KES"}
          isOpen={true}
          onClose={() => setIsCreatingPlan(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["membership-plans"] });
            setIsCreatingPlan(false);
          }}
        />
      ) : null}

      {/* Quick Assign Membership Modal */}
      {assigningMember ? (
        <AssignPlanModal
          isOpen={true}
          member={assigningMember}
          onClose={() => setAssigningMember(null)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["members"] });
            setAssigningMember(null);
          }}
          plans={plans.data?.filter((p) => p.isActive) ?? []}
        />
      ) : null}
    </>
  );
}

function AssignPlanModal({
  isOpen,
  onClose,
  member,
  plans,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  member: { id: string; name: string };
  plans: MembershipPlanResponse[];
  onSuccess: () => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.activateMembership(member.id, { planId: selectedPlanId });
      onSuccess();
    } catch (cause) {
      setError(cause);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      description={`Activate a membership package for ${member.name}.`}
      isOpen={isOpen}
      onClose={onClose}
      title="Assign membership plan"
    >
      <form className="form-stack" onSubmit={handleActivate}>
        <FormField htmlFor="selectPlan" label="Membership Plan">
          <select
            className="fitos-control"
            id="selectPlan"
            onChange={(e) => setSelectedPlanId(e.target.value)}
            value={selectedPlanId}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.includedCredits} credits (
                {p.durationDays ? `${p.durationDays} days` : "ongoing"})
              </option>
            ))}
          </select>
        </FormField>

        <ErrorNotice error={error} />

        <div className="form-actions">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button disabled={!selectedPlanId} loading={submitting} type="submit">
            Confirm & Activate
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CreatePlanModal({
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
  onSuccess: () => void;
}) {
  const [error, setError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<PlanFormValues>({
    defaultValues: {
      name: "",
      slug: "",
      priceAmount: "5000",
      currency: defaultCurrency,
      durationDays: "30",
      includedCredits: 10,
      branchId: "",
      publicVisible: true
    }
  });

  const onSubmit = async (values: PlanFormValues) => {
    setError(null);
    try {
      const price = values.priceAmount.trim()
        ? {
            amountMinor: String(Math.round(parseFloat(values.priceAmount) * 100)),
            currency: values.currency.trim().toUpperCase()
          }
        : null;

      const payload: CreateMembershipPlanRequest = {
        name: values.name.trim(),
        slug: values.slug.trim() || undefined,
        price,
        durationDays: values.durationDays ? Number(values.durationDays) : null,
        includedCredits: Number(values.includedCredits),
        branchId: values.branchId || null,
        publicVisible: values.publicVisible
      };

      await api.createMembershipPlan(payload);
      onSuccess();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Modal
      description="Create a credit bundle or recurring membership tier."
      isOpen={isOpen}
      onClose={onClose}
      title="New membership plan"
    >
      <form className="form-stack" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-grid">
          <FormField error={errors.name?.message} htmlFor="planName" label="Plan name">
            <input
              className="fitos-control"
              id="planName"
              placeholder="e.g. 10-Class Pack, Monthly Unlimited"
              {...register("name", { required: "Name is required" })}
            />
          </FormField>

          <FormField htmlFor="planSlug" label="URL Slug" optional>
            <input
              className="fitos-control"
              id="planSlug"
              placeholder="e.g. 10-class-pack"
              {...register("slug")}
            />
          </FormField>

          <FormField htmlFor="planPrice" label="Price (KES/amount)">
            <input
              className="fitos-control"
              id="planPrice"
              placeholder="e.g. 7500"
              step="0.01"
              type="number"
              {...register("priceAmount")}
            />
          </FormField>

          <FormField htmlFor="planDuration" label="Validity (days)" optional>
            <input
              className="fitos-control"
              id="planDuration"
              placeholder="e.g. 30 (leave blank for unlimited)"
              type="number"
              {...register("durationDays")}
            />
          </FormField>

          <FormField
            error={errors.includedCredits?.message}
            htmlFor="planCredits"
            label="Included class credits"
          >
            <input
              className="fitos-control"
              id="planCredits"
              min={1}
              type="number"
              {...register("includedCredits", {
                required: "Credits required",
                min: { value: 1, message: "At least one credit is required" }
              })}
            />
          </FormField>

          <FormField htmlFor="planBranch" label="Branch limitation" optional>
            <select className="fitos-control" id="planBranch" {...register("branchId")}>
              <option value="">Organization-wide (All branches)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="checkbox-stack">
          <label className="fitos-checkbox-row">
            <Checkbox {...register("publicVisible")} />
            <span>Available for public online purchase</span>
          </label>
        </div>

        <ErrorNotice error={error} />

        <div className="form-actions">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button loading={isSubmitting} type="submit">
            Create membership plan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
