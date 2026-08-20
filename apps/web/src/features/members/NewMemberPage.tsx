import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, FormField, PageHeader } from "@fitos/ui";
import { api, ApiClientError } from "../../lib/api/client";
import { PageLoading, ErrorNotice } from "../shared";

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
  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
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
