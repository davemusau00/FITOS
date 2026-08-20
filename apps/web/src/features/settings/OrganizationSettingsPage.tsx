import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, FormField, PageHeader } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { PageLoading, ErrorNotice } from "../shared";

export function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const organization = useQuery({ queryKey: ["organization"], queryFn: api.organization });
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
            queryClient.setQueryData(["organization"], updated);
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
