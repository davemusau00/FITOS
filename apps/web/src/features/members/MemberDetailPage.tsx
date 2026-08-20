import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, FormField, PageHeader, Skeleton, StatusBadge } from "@fitos/ui";
import type { BranchResponse, MemberResponse } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { PageLoading, ErrorNotice, formatDate } from "../shared";

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

export function MemberDetailPage() {
  const { memberId } = useParams();
  const queryClient = useQueryClient();
  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const member = useQuery({
    queryKey: ["member", memberId ?? ""],
    queryFn: () => api.member(memberId!),
    enabled: Boolean(memberId)
  });
  const timeline = useQuery({
    queryKey: ["member", memberId ?? "", "timeline"],
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
            queryClient.setQueryData(["member", memberId], updated);
            void queryClient.invalidateQueries({ queryKey: ["members"] });
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
