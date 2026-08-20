import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, FormField, PageHeader } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { PageLoading, ErrorNotice } from "../shared";

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
  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
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
              placeholder="+254 7…"
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
