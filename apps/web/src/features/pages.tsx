import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  type DataTableColumn,
  DataTable,
  EmptyState,
  FormField,
  Icon,
  PageHeader,
  SearchBar,
  Skeleton,
  StatusBadge
} from "@fitos/ui";
import type {
  BranchResponse,
  LeadResponse,
  MemberListItem,
  MemberResponse,
  StaffUserResponse
} from "@fitos/contracts";
import { can, useAuth } from "../app/auth";
import { api, ApiClientError } from "../lib/api/client";

const queryKeys = {
  organization: ["organization"] as const,
  branches: ["branches"] as const,
  members: (query: string) => ["members", query] as const,
  member: (id: string) => ["member", id] as const,
  memberTimeline: (id: string) => ["member", id, "timeline"] as const,
  leads: (query: string) => ["leads", query] as const,
  staff: ["staff"] as const
};

function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof ApiClientError ? error.message : "Something went wrong. Try again.";
  const requestId = error instanceof ApiClientError ? error.requestId : undefined;
  return (
    <Alert title="Unable to complete that action" tone="danger">
      {message}
      {requestId ? ` Reference: ${requestId}` : ""}
    </Alert>
  );
}

function PageLoading() {
  return (
    <div className="page-loading">
      <Skeleton height="2.75rem" width="16rem" />
      <Skeleton height="16rem" />
      <Skeleton height="16rem" />
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export function LoginPage() {
  const { auth, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<{ email: string; password: string }>({
    defaultValues: { email: "owner@gym.fitos.test", password: "ChangeMe123!" }
  });
  const [error, setError] = useState<unknown>(null);
  if (auth) return <Navigate replace to="/app/overview" />;
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="fitos-logo fitos-logo--large">
          <span>F</span>
          <strong>FITOS</strong>
        </div>
        <p className="login-eyebrow">Fitness operating system</p>
        <h1>Run the floor with clarity.</h1>
        <p className="login-copy">
          Bookings, members, payments and growth in one focused workspace.
        </p>
        <form
          className="form-stack"
          onSubmit={handleSubmit(async (input) => {
            setError(null);
            try {
              await signIn(input);
              navigate("/app/overview", { replace: true });
            } catch (cause) {
              setError(cause);
            }
          })}
        >
          <FormField error={errors.email?.message} htmlFor="email" label="Email">
            <input
              autoComplete="email"
              className="fitos-control"
              id="email"
              {...register("email", { required: "Enter your email." })}
            />
          </FormField>
          <FormField error={errors.password?.message} htmlFor="password" label="Password">
            <input
              autoComplete="current-password"
              className="fitos-control"
              id="password"
              type="password"
              {...register("password", { required: "Enter your password." })}
            />
          </FormField>
          <ErrorNotice error={error} />
          <Button fullWidth loading={isSubmitting || isLoading} type="submit">
            Sign in
          </Button>
        </form>
        <p className="login-help">Demo: owner@gym.fitos.test / ChangeMe123!</p>
      </section>
      <aside className="login-art" aria-hidden="true">
        <div className="login-art__mark">F</div>
        <p>
          Bookings. Members. Payments. Growth.
          <br />
          <strong>One FITOS.</strong>
        </p>
      </aside>
    </main>
  );
}

export function OverviewPage() {
  const { auth } = useAuth();
  const members = useQuery({
    queryKey: queryKeys.members(""),
    queryFn: () => api.members(new URLSearchParams())
  });
  const branches = useQuery({ queryKey: queryKeys.branches, queryFn: api.branches });
  const staff = useQuery({
    queryKey: queryKeys.staff,
    queryFn: api.staff,
    enabled: can(auth, "staff:read")
  });
  if (members.isLoading || branches.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader
        eyebrow="Today at FITOS"
        title="Overview"
        description="A clear starting point for your people, branches, and setup progress."
        actions={
          <Link className="fitos-button fitos-button--primary" to="/app/members/new">
            <Icon name="plus" size={16} />
            Add member
          </Link>
        }
      />
      <ErrorNotice error={members.error ?? branches.error ?? staff.error} />
      <section className="kpi-grid">
        <Kpi label="Total members" value={members.data?.data.length ?? 0} tone="energy" />
        <Kpi
          label="Active members"
          value={members.data?.data.filter((member) => member.status === "active").length ?? 0}
        />
        <Kpi label="Branches" value={branches.data?.length ?? 0} />
        <Kpi label="Staff" value={staff.data?.length ?? "—"} />
      </section>
      <section className="dashboard-grid">
        <Card>
          <h2>Recent members</h2>
          {members.data?.data.length ? (
            <ul className="activity-list">
              {members.data.data.slice(0, 5).map((member) => (
                <li key={member.id}>
                  <Link to={`/app/members/${member.id}`}>
                    <strong>
                      {member.firstName} {member.lastName}
                    </strong>
                    <span>{member.phone ?? "No phone"}</span>
                  </Link>
                  <StatusBadge status={member.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              action={
                <Link className="fitos-button fitos-button--primary" to="/app/members/new">
                  Add first member
                </Link>
              }
              description="Start with the people you serve."
              title="No members yet"
            />
          )}
        </Card>
        <Card>
          <h2>Setup progress</h2>
          <ul className="setup-list">
            <li className={branches.data?.length ? "is-done" : ""}>
              <Icon name="building" size={18} />
              Add your branch
            </li>
            <li className={members.data?.data.length ? "is-done" : ""}>
              <Icon name="users" size={18} />
              Create your first member
            </li>
            <li>
              <Icon name="calendar" size={18} />
              Configure services and schedules
            </li>
          </ul>
          <Link className="text-link" to="/onboarding">
            Continue setup <Icon name="chevron-right" size={16} />
          </Link>
        </Card>
      </section>
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "energy" }) {
  return (
    <Card className={`kpi ${tone ? "kpi--energy" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}

const leadStages = [
  "new",
  "contacted",
  "trial_booked",
  "trial_completed",
  "offer",
  "joined",
  "lost"
] as const;

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const query = params.get("query") ?? "";
  const stage = params.get("stage") ?? "";
  const requestParams = useMemo(() => {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (stage) next.set("stage", stage);
    return next;
  }, [query, stage]);
  const leads = useQuery({
    queryKey: queryKeys.leads(requestParams.toString()),
    queryFn: () => api.leads(requestParams)
  });
  const updateStage = useMutation({
    mutationFn: ({
      id,
      nextStage,
      lostReason
    }: {
      id: string;
      nextStage: (typeof leadStages)[number];
      lostReason?: string;
    }) => api.updateLeadStage(id, { stage: nextStage, ...(lostReason ? { lostReason } : {}) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["leads"] })
  });
  const convert = useMutation({
    mutationFn: api.convertLead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["leads"] })
  });
  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };
  const changeStage = (lead: LeadResponse, nextStage: (typeof leadStages)[number]) => {
    const lostReason =
      nextStage === "lost" ? window.prompt("Why was this lead lost?")?.trim() : undefined;
    if (nextStage === "lost" && !lostReason) return;
    updateStage.mutate({ id: lead.id, nextStage, lostReason });
  };
  const columns: DataTableColumn<LeadResponse>[] = [
    {
      id: "lead",
      header: "Lead",
      cell: (lead) => (
        <div>
          <strong className="fitos-data-table__primary">
            {lead.contact.firstName} {lead.contact.lastName}
          </strong>
          <span className="fitos-data-table__muted">
            {lead.contact.phone ?? lead.contact.email ?? "No contact method"}
          </span>
        </div>
      )
    },
    { id: "interest", header: "Interest", cell: (lead) => lead.interest ?? "â€”" },
    { id: "source", header: "Source", cell: (lead) => lead.source ?? "â€”" },
    {
      id: "stage",
      header: "Stage",
      cell: (lead) => (
        <select
          aria-label={`Change stage for ${lead.contact.firstName}`}
          className="fitos-control fitos-control--compact"
          disabled={updateStage.isPending}
          onChange={(event) =>
            changeStage(lead, event.currentTarget.value as (typeof leadStages)[number])
          }
          value={lead.stage}
        >
          {leadStages.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      )
    },
    { id: "followup", header: "Follow-up", cell: (lead) => formatDate(lead.nextFollowUpAt) },
    {
      id: "convert",
      header: "",
      cell: (lead) =>
        lead.convertedMemberId ? (
          <Link className="text-link" to={`/app/members/${lead.convertedMemberId}`}>
            Member
          </Link>
        ) : (
          <Button
            disabled={convert.isPending}
            onClick={() => {
              if (window.confirm(`Convert ${lead.contact.firstName} to a member?`))
                convert.mutate(lead.id);
            }}
            size="small"
            variant="ghost"
          >
            Convert
          </Button>
        )
    }
  ];
  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Leads"
        description="Capture interest, track follow-up, and move every prospect toward a clear outcome."
        actions={
          <Link className="fitos-button fitos-button--primary" to="/app/leads/new">
            <Icon name="plus" size={16} />
            Add lead
          </Link>
        }
      />
      <ErrorNotice error={leads.error ?? updateStage.error ?? convert.error} />
      <section className="filter-row">
        <SearchBar
          aria-label="Search leads"
          onChange={(event) => set("query", event.currentTarget.value)}
          placeholder="Search name, phone, email or interest"
          value={query}
        />
        <select
          aria-label="Filter leads by stage"
          className="fitos-control"
          onChange={(event) => set("stage", event.currentTarget.value)}
          value={stage}
        >
          <option value="">All stages</option>
          {leadStages.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </section>
      {leads.isLoading ? (
        <PageLoading />
      ) : !leads.data?.data.length ? (
        <EmptyState
          action={
            <Link className="fitos-button fitos-button--primary" to="/app/leads/new">
              Add first lead
            </Link>
          }
          description="Prospects will appear here with their source, interest, and follow-up status."
          title="No matching leads"
        />
      ) : (
        <DataTable columns={columns} data={leads.data.data} label="Leads" />
      )}
    </>
  );
}

type LeadFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  branchId: string;
  interest: string;
  source: string;
  nextFollowUpAt: string;
};

export function NewLeadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const branches = useQuery({ queryKey: queryKeys.branches, queryFn: api.branches });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LeadFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      branchId: "",
      interest: "",
      source: "",
      nextFollowUpAt: ""
    }
  });
  const [submissionError, setSubmissionError] = useState<unknown>(null);
  if (branches.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader
        eyebrow="Leads"
        title="Add lead"
        description="Record the prospect and the next action while the conversation is still fresh."
        actions={
          <Link className="fitos-button fitos-button--ghost" to="/app/leads">
            Cancel
          </Link>
        }
      />
      <form
        className="form-card form-stack"
        onSubmit={handleSubmit(async (values) => {
          setSubmissionError(null);
          try {
            await api.createLead({
              contact: {
                firstName: values.firstName.trim(),
                lastName: values.lastName.trim() || null,
                phone: values.phone.trim() || null,
                email: values.email.trim() || null
              },
              branchId: values.branchId || null,
              interest: values.interest.trim() || null,
              source: values.source.trim() || null,
              nextFollowUpAt: values.nextFollowUpAt
                ? new Date(values.nextFollowUpAt).toISOString()
                : null
            });
            await queryClient.invalidateQueries({ queryKey: ["leads"] });
            navigate("/app/leads");
          } catch (error) {
            setSubmissionError(error);
          }
        })}
      >
        <div className="form-grid">
          <FormField error={errors.firstName?.message} htmlFor="leadFirstName" label="First name">
            <input
              className="fitos-control"
              id="leadFirstName"
              {...register("firstName", { required: "First name is required." })}
            />
          </FormField>
          <FormField htmlFor="leadLastName" label="Last name" optional>
            <input className="fitos-control" id="leadLastName" {...register("lastName")} />
          </FormField>
          <FormField htmlFor="leadPhone" label="Phone" optional>
            <input
              className="fitos-control"
              id="leadPhone"
              placeholder="+254 7â€¦"
              {...register("phone")}
            />
          </FormField>
          <FormField htmlFor="leadEmail" label="Email" optional>
            <input className="fitos-control" id="leadEmail" type="email" {...register("email")} />
          </FormField>
          <FormField htmlFor="leadBranch" label="Branch" optional>
            <select className="fitos-control" id="leadBranch" {...register("branchId")}>
              <option value="">Organization-wide</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="leadInterest" label="Interest" optional>
            <input
              className="fitos-control"
              id="leadInterest"
              placeholder="e.g. Pilates trial"
              {...register("interest")}
            />
          </FormField>
          <FormField htmlFor="leadSource" label="Source" optional>
            <input
              className="fitos-control"
              id="leadSource"
              placeholder="e.g. Instagram, referral, walk-in"
              {...register("source")}
            />
          </FormField>
          <FormField htmlFor="leadFollowUp" label="Next follow-up" optional>
            <input
              className="fitos-control"
              id="leadFollowUp"
              type="datetime-local"
              {...register("nextFollowUpAt")}
            />
          </FormField>
        </div>
        <ErrorNotice error={submissionError} />
        <div className="form-actions">
          <Button loading={isSubmitting} type="submit">
            Create lead
          </Button>
        </div>
      </form>
    </>
  );
}

export function MembersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get("query") ?? "";
  const status = params.get("status") ?? "";
  const branches = useQuery({ queryKey: queryKeys.branches, queryFn: api.branches });
  const requestParams = useMemo(() => {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (status) next.set("status", status);
    const branch = params.get("branchId");
    if (branch) next.set("branchId", branch);
    return next;
  }, [params, query, status]);
  const members = useQuery({
    queryKey: queryKeys.members(requestParams.toString()),
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

const memberColumns = [
  {
    id: "member",
    header: "Member",
    cell: (member: MemberListItem) => (
      <div>
        <strong className="fitos-data-table__primary">
          {member.firstName} {member.lastName}
        </strong>
        <span className="fitos-data-table__muted">{member.email ?? "No email"}</span>
      </div>
    )
  },
  { id: "phone", header: "Phone", cell: (member: MemberListItem) => member.phone ?? "—" },
  {
    id: "status",
    header: "Status",
    cell: (member: MemberListItem) => <StatusBadge status={member.status} />
  },
  { id: "joined", header: "Joined", cell: (member: MemberListItem) => formatDate(member.joinedAt) }
];

type MemberFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  homeBranchId: string;
};
function toMemberPayload(values: MemberFormValues) {
  return {
    contact: {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      dateOfBirth: values.dateOfBirth || null
    },
    homeBranchId: values.homeBranchId
  };
}

export function NewMemberPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const branches = useQuery({ queryKey: queryKeys.branches, queryFn: api.branches });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<MemberFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      dateOfBirth: "",
      homeBranchId: ""
    }
  });
  const [submissionError, setSubmissionError] = useState<unknown>(null);
  if (branches.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader
        eyebrow="Members"
        title="Add member"
        description="Create a member record with the information reception needs most."
        actions={
          <Link className="fitos-button fitos-button--ghost" to="/app/members">
            Cancel
          </Link>
        }
      />
      <form
        className="form-card form-stack"
        onSubmit={handleSubmit(async (values) => {
          setSubmissionError(null);
          try {
            const member = await api.createMember(toMemberPayload(values));
            await queryClient.invalidateQueries({ queryKey: ["members"] });
            navigate(`/app/members/${member.id}`);
          } catch (error) {
            setSubmissionError(error);
            if (error instanceof ApiClientError)
              Object.entries(error.fields ?? {}).forEach(([name, messages]) => {
                const field = name.replace("contact.", "") as keyof MemberFormValues;
                setError(field, { message: messages[0] });
              });
          }
        })}
      >
        <div className="form-grid">
          <FormField error={errors.firstName?.message} htmlFor="firstName" label="First name">
            <input
              className="fitos-control"
              id="firstName"
              {...register("firstName", { required: "First name is required." })}
            />
          </FormField>
          <FormField error={errors.lastName?.message} htmlFor="lastName" label="Last name" optional>
            <input className="fitos-control" id="lastName" {...register("lastName")} />
          </FormField>
          <FormField error={errors.phone?.message} htmlFor="phone" label="Phone" optional>
            <input
              className="fitos-control"
              id="phone"
              placeholder="+254 7…"
              {...register("phone")}
            />
          </FormField>
          <FormField error={errors.email?.message} htmlFor="email" label="Email" optional>
            <input className="fitos-control" id="email" type="email" {...register("email")} />
          </FormField>
          <FormField htmlFor="dateOfBirth" label="Date of birth" optional>
            <input
              className="fitos-control"
              id="dateOfBirth"
              type="date"
              {...register("dateOfBirth")}
            />
          </FormField>
          <FormField
            error={errors.homeBranchId?.message}
            htmlFor="homeBranchId"
            label="Home branch"
          >
            <select
              className="fitos-control"
              id="homeBranchId"
              {...register("homeBranchId", { required: "Select a home branch." })}
            >
              <option value="">Select branch</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <ErrorNotice error={submissionError} />
        <div className="form-actions">
          <Button type="submit" loading={isSubmitting}>
            Create member
          </Button>
        </div>
      </form>
    </>
  );
}

export function MemberDetailPage() {
  const { memberId } = useParams();
  const queryClient = useQueryClient();
  const branches = useQuery({ queryKey: queryKeys.branches, queryFn: api.branches });
  const member = useQuery({
    queryKey: queryKeys.member(memberId ?? ""),
    queryFn: () => api.member(memberId!),
    enabled: Boolean(memberId)
  });
  const timeline = useQuery({
    queryKey: queryKeys.memberTimeline(memberId ?? ""),
    queryFn: () => api.memberTimeline(memberId!),
    enabled: Boolean(memberId)
  });
  const [editing, setEditing] = useState(false);
  if (!memberId) return <Navigate to="/app/members" replace />;
  if (member.isLoading || branches.isLoading) return <PageLoading />;
  if (member.error || !member.data) return <ErrorNotice error={member.error} />;
  return (
    <>
      <PageHeader
        eyebrow="Member profile"
        title={`${member.data.contact.firstName} ${member.data.contact.lastName ?? ""}`.trim()}
        description={`Joined ${formatDate(member.data.joinedAt)}`}
        actions={
          <>
            <StatusBadge status={member.data.status} />
            <Button icon="edit" onClick={() => setEditing((open) => !open)} variant="secondary">
              {editing ? "Close edit" : "Edit"}
            </Button>
          </>
        }
      />
      <section className="detail-grid">
        <Card>
          <h2>Overview</h2>
          <dl className="detail-list">
            <div>
              <dt>Phone</dt>
              <dd>{member.data.contact.phone ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{member.data.contact.email ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Home branch</dt>
              <dd>
                {branches.data?.find((branch) => branch.id === member.data?.homeBranchId)?.name ??
                  "Not assigned"}
              </dd>
            </div>
            <div>
              <dt>Member number</dt>
              <dd>{member.data.memberNumber ?? "Assigned later"}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2>Timeline</h2>
          {timeline.isLoading ? (
            <Skeleton height="8rem" />
          ) : timeline.data?.length ? (
            <ul className="timeline">
              {timeline.data.map((event) => (
                <li key={event.id}>
                  <span />
                  <div>
                    <strong>{event.action.replaceAll(".", " ")}</strong>
                    <p>{formatDate(event.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No activity has been recorded yet.</p>
          )}
        </Card>
      </section>
      {editing ? (
        <MemberEditor
          branches={branches.data ?? []}
          member={member.data}
          onSaved={(updated) => {
            queryClient.setQueryData(queryKeys.member(memberId), updated);
            void queryClient.invalidateQueries({ queryKey: ["members"] });
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}

function MemberEditor({
  branches,
  member,
  onSaved
}: {
  branches: BranchResponse[];
  member: MemberResponse;
  onSaved(updated: MemberResponse): void;
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<MemberFormValues>({
    defaultValues: {
      firstName: member.contact.firstName,
      lastName: member.contact.lastName ?? "",
      phone: member.contact.phone ?? "",
      email: member.contact.email ?? "",
      dateOfBirth: member.contact.dateOfBirth ?? "",
      homeBranchId: member.homeBranchId ?? ""
    }
  });
  const [error, setError] = useState<unknown>(null);
  return (
    <form
      className="form-card form-stack detail-editor"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        try {
          onSaved(await api.updateMember(member.id, toMemberPayload(values)));
        } catch (cause) {
          setError(cause);
        }
      })}
    >
      <h2>Edit member</h2>
      <div className="form-grid">
        <FormField htmlFor="editFirstName" label="First name">
          <input
            className="fitos-control"
            id="editFirstName"
            {...register("firstName", { required: true })}
          />
        </FormField>
        <FormField htmlFor="editLastName" label="Last name" optional>
          <input className="fitos-control" id="editLastName" {...register("lastName")} />
        </FormField>
        <FormField htmlFor="editPhone" label="Phone" optional>
          <input className="fitos-control" id="editPhone" {...register("phone")} />
        </FormField>
        <FormField htmlFor="editEmail" label="Email" optional>
          <input className="fitos-control" id="editEmail" type="email" {...register("email")} />
        </FormField>
        <FormField htmlFor="editHomeBranch" label="Home branch">
          <select
            className="fitos-control"
            id="editHomeBranch"
            {...register("homeBranchId", { required: true })}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <ErrorNotice error={error} />
      <Button loading={isSubmitting} type="submit">
        Save changes
      </Button>
    </form>
  );
}

export function StaffPage() {
  const { auth } = useAuth();
  const staff = useQuery({ queryKey: queryKeys.staff, queryFn: api.staff });
  if (staff.isLoading) return <PageLoading />;
  const rows: StaffRow[] = (staff.data ?? []).map((record) => ({ ...record, id: record.user.id }));
  return (
    <>
      <PageHeader
        eyebrow="Access"
        title="Staff"
        description="View the people who can operate this organization and the access they hold."
      />
      {staff.error ? (
        <ErrorNotice error={staff.error} />
      ) : !rows.length ? (
        <EmptyState
          description="Invite people after your first branch is ready."
          title="No staff access yet"
        />
      ) : (
        <DataTable columns={staffColumns} data={rows} label="Staff" />
      )}
      {can(auth, "staff:manage") ? (
        <Alert title="Staff invitations" tone="info">
          The invitation and branch-access API is active. The acceptance flow will ship with secure
          email delivery in the automation slice.
        </Alert>
      ) : null}
    </>
  );
}

type StaffRow = StaffUserResponse & { id: string };
const staffColumns: Array<DataTableColumn<StaffRow>> = [
  {
    id: "staff",
    header: "Staff member",
    cell: (staff) => (
      <div>
        <strong className="fitos-data-table__primary">{staff.user.displayName}</strong>
        <span className="fitos-data-table__muted">{staff.user.email}</span>
      </div>
    )
  },
  { id: "role", header: "Role", cell: (staff) => staff.role.name },
  {
    id: "branches",
    header: "Branches",
    cell: (staff) => staff.branches.map((branch) => branch.name).join(", ") || "No branch access"
  },
  { id: "status", header: "Status", cell: (staff) => <StatusBadge status={staff.user.status} /> }
];

export function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Control center"
        title="Settings"
        description="Configure the organization, branches, people, and security rules behind your daily operations."
      />
      <section className="settings-grid">
        <SettingsLink
          icon="building"
          title="Organization"
          description="Name, timezone, and currency"
          to="/app/settings/organization"
        />
        <SettingsLink
          icon="building"
          title="Branches"
          description="Locations and operational context"
          to="/app/settings/branches"
        />
        <SettingsLink
          icon="team"
          title="Team & permissions"
          description="Roles and branch access"
          to="/app/settings/team"
        />
        <SettingsLink
          icon="shield"
          title="Security"
          description="Sessions and safe operation"
          to="/app/settings/security"
        />
      </section>
    </>
  );
}

function SettingsLink({
  icon,
  title,
  description,
  to
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link className="settings-link" to={to}>
      <Icon name={icon} size={22} />
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

export function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const organization = useQuery({ queryKey: queryKeys.organization, queryFn: api.organization });
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<{ name: string; timezone: string; currency: string }>();
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (organization.data)
      reset({
        name: organization.data.name,
        timezone: organization.data.timezone,
        currency: organization.data.currency
      });
  }, [organization.data, reset]);
  if (organization.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Organization"
        description="Keep the business identity, timezone, and currency unambiguous in every workflow."
      />
      <form
        className="form-card form-stack"
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          try {
            const updated = await api.updateOrganization(values);
            queryClient.setQueryData(queryKeys.organization, updated);
          } catch (cause) {
            setError(cause);
          }
        })}
      >
        <div className="form-grid">
          <FormField htmlFor="organizationName" label="Business name">
            <input
              className="fitos-control"
              id="organizationName"
              {...register("name", { required: true })}
            />
          </FormField>
          <FormField htmlFor="timezone" label="Default timezone">
            <input
              className="fitos-control"
              id="timezone"
              {...register("timezone", { required: true })}
            />
          </FormField>
          <FormField htmlFor="currency" label="Default currency">
            <input
              className="fitos-control"
              id="currency"
              maxLength={3}
              {...register("currency", { required: true })}
            />
          </FormField>
        </div>
        <ErrorNotice error={error} />
        <Button loading={isSubmitting} type="submit">
          Save organization
        </Button>
      </form>
    </>
  );
}

export function BranchesSettingsPage() {
  const queryClient = useQueryClient();
  const branches = useQuery({ queryKey: queryKeys.branches, queryFn: api.branches });
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<{ name: string; city: string; timezone: string }>({
    defaultValues: { name: "", city: "Nairobi", timezone: "Africa/Nairobi" }
  });
  const [error, setError] = useState<unknown>(null);
  if (branches.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Branches"
        description="Locations anchor schedules, memberships, attendance, and branch-level reporting."
      />
      <section className="detail-grid">
        <Card>
          <h2>Accessible branches</h2>
          {branches.data?.length ? (
            <ul className="branch-list">
              {branches.data.map((branch) => (
                <li key={branch.id}>
                  <div>
                    <strong>{branch.name}</strong>
                    <span>
                      {branch.city ?? "No city"} · {branch.timezone ?? "Organization timezone"}
                    </span>
                  </div>
                  <StatusBadge status={branch.isActive ? "active" : "inactive"} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No branch access.</p>
          )}
        </Card>
        <form
          className="form-card form-stack"
          onSubmit={handleSubmit(async (values) => {
            setError(null);
            try {
              await api.createBranch({
                name: values.name,
                city: values.city || null,
                timezone: values.timezone || null
              });
              await queryClient.invalidateQueries({ queryKey: queryKeys.branches });
              reset();
            } catch (cause) {
              setError(cause);
            }
          })}
        >
          <h2>Add branch</h2>
          <FormField htmlFor="branchName" label="Branch name">
            <input
              className="fitos-control"
              id="branchName"
              {...register("name", { required: true })}
            />
          </FormField>
          <FormField htmlFor="branchCity" label="City" optional>
            <input className="fitos-control" id="branchCity" {...register("city")} />
          </FormField>
          <FormField htmlFor="branchTimezone" label="Timezone">
            <input
              className="fitos-control"
              id="branchTimezone"
              {...register("timezone", { required: true })}
            />
          </FormField>
          <ErrorNotice error={error} />
          <Button loading={isSubmitting} type="submit">
            Create branch
          </Button>
        </form>
      </section>
    </>
  );
}

export function SecuritySettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Security"
        description="FITOS uses secure, server-revocable sessions and server-side capabilities."
      />
      <section className="settings-grid">
        <Card>
          <Icon name="key" size={24} />
          <h2>Sessions</h2>
          <p>
            Authentication uses opaque HttpOnly session cookies. Sign out revokes the active session
            on the server.
          </p>
        </Card>
        <Card>
          <Icon name="shield" size={24} />
          <h2>Tenant isolation</h2>
          <p>
            Every API request resolves tenant and branch scope from the authenticated session—never
            from a browser-supplied tenant ID.
          </p>
        </Card>
        <Card>
          <Icon name="warning" size={24} />
          <h2>Operational safety</h2>
          <p>
            Privileged changes are written to an append-only audit log. Financial and booking
            controls are added in their domain slices.
          </p>
        </Card>
      </section>
    </>
  );
}

export function OnboardingPage() {
  const { auth } = useAuth();
  return (
    <>
      <PageHeader
        eyebrow="Get ready"
        title="Set up FITOS"
        description="Complete the essentials, then build services and schedules when the next operational slice is enabled."
      />
      <section className="onboarding-steps">
        <OnboardingStep
          complete={Boolean(auth?.tenant.name)}
          number="01"
          title="Business"
          description="Organization profile, timezone and currency."
          to="/app/settings/organization"
        />
        <OnboardingStep
          complete={Boolean(auth?.branches.length)}
          number="02"
          title="First branch"
          description="Create the operating location for members and staff."
          to="/app/settings/branches"
        />
        <OnboardingStep
          number="03"
          title="Team"
          description="Review access and branch assignments."
          to="/app/settings/team"
        />
        <OnboardingStep
          number="04"
          title="Services"
          description="Available in the services and scheduling release."
        />
      </section>
    </>
  );
}

function OnboardingStep({
  complete,
  number,
  title,
  description,
  to
}: {
  complete?: boolean;
  number: string;
  title: string;
  description: string;
  to?: string;
}) {
  const content = (
    <>
      <span className="onboarding-step__number">
        {complete ? <Icon name="check" size={18} /> : number}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {to ? <Icon name="chevron-right" size={20} /> : <span className="muted">Coming next</span>}
    </>
  );
  return to ? (
    <Link className="onboarding-step" to={to}>
      {content}
    </Link>
  ) : (
    <div className="onboarding-step">{content}</div>
  );
}
