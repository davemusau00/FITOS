import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
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
import { branchQueryKeys } from "../../lib/query-keys";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"plans" | "retention" | "assign">("plans");
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [assigningMember, setAssigningMember] = useState<{ id: string; name: string } | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const plans = useQuery({
    queryKey: branchQueryKeys.list("membership-plans", selectedBranch || "all"),
    queryFn: () => api.membershipPlans(selectedBranch || undefined)
  });
  const members = useQuery({
    queryKey: branchQueryKeys.list("members", selectedBranch || "all", memberSearch),
    queryFn: () =>
      api.members(
        new URLSearchParams({
          limit: "100",
          ...(selectedBranch ? { branchId: selectedBranch } : {}),
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

  const allMembers = members.data?.data ?? [];
  const activeMembers = allMembers.filter((m) => m.status === "active");
  const inactiveMembers = allMembers.filter((m) => m.status === "inactive");

  if (plans.isLoading || branches.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Memberships &amp; Retention"
        description="Configure recurring plans, assign entitlements, and monitor members requiring retention action."
        actions={
          can(auth, "membership:manage") ? (
            <Button icon="plus" onClick={() => setIsCreatingPlan(true)}>
              New membership plan
            </Button>
          ) : null
        }
      />

      <ErrorNotice error={plans.error} />

      {/* KPI Stats */}
      <div className="kpi-grid">
        <Card className="kpi kpi--energy">
          <span>Active Plans</span>
          <strong>{plans.data?.filter((p) => p.isActive).length ?? 0}</strong>
        </Card>
        <Card className="kpi">
          <span>Active Memberships</span>
          <strong>{activeMembers.length}</strong>
        </Card>
        <Card className="kpi">
          <span>Expiring / At Risk</span>
          <strong>{inactiveMembers.length}</strong>
        </Card>
        <Card className="kpi">
          <span>Total Plans</span>
          <strong>{plans.data?.length ?? 0}</strong>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="member-tab-bar" style={{ marginBottom: "1.25rem" }}>
        {[
          {
            id: "plans",
            label: `Plans Catalog (${plans.data?.length ?? 0})`,
            icon: "shield" as const
          },
          {
            id: "retention",
            label: `Retention Queue (${inactiveMembers.length})`,
            icon: "users" as const
          },
          { id: "assign", label: "Assign Entitlements", icon: "plus" as const }
        ].map((tab) => (
          <button
            className={`member-tab-bar__tab${activeTab === tab.id ? " member-tab-bar__tab--active" : ""}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            type="button"
          >
            <Icon name={tab.icon} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── PLANS CATALOG TAB ── */}
      {activeTab === "plans" && (
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
            <DataTable
              columns={planColumns}
              data={plans.data}
              label="Membership Plans"
              mobileRenderer={(plan) => (
                <Card className="fitos-mobile-data-card">
                  <div>
                    <strong className="fitos-data-table__primary">{plan.name}</strong>
                    <span className="fitos-data-table__muted">{plan.slug}</span>
                  </div>
                  <div className="fitos-mobile-data-card__meta">
                    <span>
                      {plan.price
                        ? formatCurrency(plan.price.amountMinor, plan.price.currency)
                        : "Free / Trial"}
                    </span>
                    <StatusBadge status={plan.isActive ? "active" : "inactive"} />
                  </div>
                  <span className="fitos-data-table__muted">
                    {plan.durationDays ? `${plan.durationDays} days` : "Ongoing"} ·{" "}
                    {plan.includedCredits} sessions ·{" "}
                    {plan.branchId
                      ? (branches.data?.find((branch) => branch.id === plan.branchId)?.name ??
                        "Branch")
                      : "All branches"}
                  </span>
                  <span className="fitos-data-table__muted">
                    {plan.publicVisible ? "Public sale" : "Staff only"}
                  </span>
                </Card>
              )}
            />
          )}
        </>
      )}

      {/* ── RETENTION QUEUE TAB ── */}
      {activeTab === "retention" && (
        <div className="form-stack">
          <Card>
            <h2>Retention &amp; Renewal Queue</h2>
            <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
              Members flagged for retention review due to inactivity or plan expiration.
            </p>

            {inactiveMembers.length ? (
              <div className="form-stack">
                {inactiveMembers.map((member) => (
                  <div className="at-risk-row" key={member.id}>
                    <div className="at-risk-row__avatar">
                      {member.firstName[0]}
                      {member.lastName?.[0]}
                    </div>
                    <div className="at-risk-row__info">
                      <strong>
                        {member.firstName} {member.lastName ?? ""}
                      </strong>
                      <span>
                        {member.phone ?? member.email ?? "No contact recorded"} · Joined{" "}
                        {formatDate(member.joinedAt)}
                      </span>
                    </div>
                    <StatusBadge status={member.status} />
                    <div className="form-actions">
                      <Button
                        onClick={() =>
                          setAssigningMember({
                            id: member.id,
                            name: `${member.firstName} ${member.lastName ?? ""}`.trim()
                          })
                        }
                        size="small"
                        variant="secondary"
                      >
                        Re-activate Plan
                      </Button>
                      <Button
                        onClick={() => navigate(`/app/members/${member.id}`)}
                        size="small"
                        variant="ghost"
                      >
                        Profile →
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="crm-followup-empty">
                <Icon name="check" size={32} />
                <p>Great job! All members are currently active with valid plans.</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── ASSIGN ENTITLEMENTS TAB ── */}
      {activeTab === "assign" && (
        <Card>
          <div className="section-header-row" style={{ marginTop: 0 }}>
            <h2>Member Entitlement Assignment</h2>
            <SearchBar
              aria-label="Search members"
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search member by name, phone or email..."
              value={memberSearch}
            />
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div className="form-stack">
              {allMembers.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "0.625rem",
                    background: "var(--surface-2)"
                  }}
                >
                  <div className="table-member-cell">
                    <div className="table-member-avatar">
                      {m.firstName[0]}
                      {m.lastName?.[0]}
                    </div>
                    <div>
                      <strong>
                        {m.firstName} {m.lastName ?? ""}
                      </strong>
                      <span className="muted" style={{ fontSize: "0.8rem", display: "block" }}>
                        {m.phone ?? m.email ?? "No contact"}
                      </span>
                    </div>
                  </div>
                  <div className="form-actions">
                    <StatusBadge status={m.status} />
                    <Button
                      onClick={() =>
                        setAssigningMember({
                          id: m.id,
                          name: `${m.firstName} ${m.lastName ?? ""}`.trim()
                        })
                      }
                      size="small"
                      variant="primary"
                    >
                      Assign Plan
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── CREATE PLAN MODAL ── */}
      {isCreatingPlan ? (
        <CreatePlanModal
          branches={branches.data ?? []}
          isOpen={true}
          onClose={() => setIsCreatingPlan(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({
              queryKey: branchQueryKeys.all("membership-plans")
            });
            setIsCreatingPlan(false);
          }}
        />
      ) : null}

      {/* ── ASSIGN MEMBERSHIP MODAL ── */}
      {assigningMember ? (
        <AssignPlanModal
          isOpen={true}
          memberId={assigningMember.id}
          memberName={assigningMember.name}
          onClose={() => setAssigningMember(null)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all("members") });
            setAssigningMember(null);
          }}
          plans={plans.data?.filter((p) => p.isActive) ?? []}
        />
      ) : null}
    </>
  );
}

function CreatePlanModal({
  isOpen,
  onClose,
  branches,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  branches: BranchResponse[];
  onSuccess: () => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<PlanFormValues>({
    defaultValues: {
      name: "",
      slug: "",
      priceAmount: "",
      currency: "KES",
      durationDays: "30",
      includedCredits: 12,
      branchId: "",
      publicVisible: true
    }
  });

  const onSubmit = async (values: PlanFormValues) => {
    setError(null);
    try {
      const payload: CreateMembershipPlanRequest = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        includedCredits: Number(values.includedCredits),
        durationDays: values.durationDays ? Number(values.durationDays) : null,
        branchId: values.branchId || null,
        publicVisible: values.publicVisible,
        price: values.priceAmount
          ? {
              amountMinor: String(Math.round(Number(values.priceAmount) * 100)),
              currency: values.currency
            }
          : null
      };
      await api.createMembershipPlan(payload);
      onSuccess();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Modal
      description="Create a recurring pass or membership tier with credit allotments."
      isOpen={isOpen}
      onClose={onClose}
      title="Create membership plan"
    >
      <form className="form-stack" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-grid">
          <FormField error={errors.name?.message} htmlFor="planName" label="Plan name">
            <input
              className="fitos-control"
              id="planName"
              placeholder="e.g. Monthly Unlimited, 10-Class Punch Pass"
              {...register("name", {
                required: "Plan name is required",
                onChange: (e) => {
                  const val = e.target.value as string;
                  setValue(
                    "slug",
                    val
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                  );
                }
              })}
            />
          </FormField>

          <FormField error={errors.slug?.message} htmlFor="planSlug" label="URL Slug">
            <input
              className="fitos-control"
              id="planSlug"
              placeholder="monthly-unlimited"
              {...register("slug", { required: "Slug is required" })}
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
                required: "Credits allotment is required",
                valueAsNumber: true,
                min: { value: 1, message: "Min 1 credit" }
              })}
            />
          </FormField>

          <FormField htmlFor="planDuration" label="Plan duration (days)" optional>
            <input
              className="fitos-control"
              id="planDuration"
              placeholder="30 (leave blank for ongoing)"
              type="number"
              {...register("durationDays")}
            />
          </FormField>

          <FormField htmlFor="planPrice" label="Price amount" optional>
            <input
              className="fitos-control"
              id="planPrice"
              placeholder="5000"
              type="number"
              {...register("priceAmount")}
            />
          </FormField>

          <FormField htmlFor="planCurrency" label="Currency">
            <select className="fitos-control" id="planCurrency" {...register("currency")}>
              <option value="KES">KES (Kenyan Shilling)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </FormField>

          <FormField htmlFor="planBranch" label="Branch availability" optional>
            <select className="fitos-control" id="planBranch" {...register("branchId")}>
              <option value="">All accessible branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <label className="fitos-checkbox" style={{ marginTop: "0.5rem" }}>
          <input type="checkbox" {...register("publicVisible")} />
          Show on public website / member self-service catalog
        </label>

        <ErrorNotice error={error} />

        <div className="form-actions">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button loading={isSubmitting} type="submit">
            Create plan
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AssignPlanModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  plans,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  plans: MembershipPlanResponse[];
  onSuccess: () => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<{ planId: string; startsAt: string }>({
    defaultValues: {
      planId: plans[0]?.id ?? "",
      startsAt: new Date().toISOString().split("T")[0] ?? ""
    }
  });

  const onSubmit = async (values: { planId: string; startsAt: string }) => {
    setError(null);
    try {
      await api.activateMembership(memberId, {
        planId: values.planId,
        startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined
      });
      onSuccess();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Modal
      description={`Grant class credits to ${memberName} by activating a plan.`}
      isOpen={isOpen}
      onClose={onClose}
      title="Assign membership plan"
    >
      <form className="form-stack" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-grid">
          <FormField htmlFor="assignPlanId" label="Select plan">
            <select
              className="fitos-control"
              id="assignPlanId"
              {...register("planId", { required: true })}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.includedCredits} credits ·{" "}
                  {p.durationDays ? `${p.durationDays}d` : "ongoing"})
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="assignStartsAt" label="Start date">
            <input
              className="fitos-control"
              id="assignStartsAt"
              type="date"
              {...register("startsAt", { required: true })}
            />
          </FormField>
        </div>

        <ErrorNotice error={error} />

        <div className="form-actions">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button loading={isSubmitting} type="submit">
            Activate &amp; Grant Credits
          </Button>
        </div>
      </form>
    </Modal>
  );
}
