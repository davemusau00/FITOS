import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, FormField, Icon, PageHeader } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { PageLoading, ErrorNotice, useToast } from "../shared";

export function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const { success } = useToast();
  const organization = useQuery({ queryKey: ["organization"], queryFn: api.organization });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<{ name: string; timezone: string; currency: string }>();

  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (organization.data) {
      reset({
        name: organization.data.name,
        timezone: organization.data.timezone,
        currency: organization.data.currency
      });
    }
  }, [organization.data, reset]);

  if (organization.isLoading) return <PageLoading />;

  return (
    <>
      <div className="settings-back-link">
        <Link className="text-link" to="/app/settings">
          <Icon name="arrow-left" size={14} /> Back to Settings
        </Link>
      </div>

      <PageHeader
        eyebrow="Settings • Identity"
        title="Organization Profile"
        description="Configure your business name, operational timezone, and default billing currency."
      />

      <form
        className="form-card form-stack"
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          try {
            const updated = await api.updateOrganization(values);
            queryClient.setQueryData(["organization"], updated);
            success("Organization updated", "Your organization profile changes have been saved.");
          } catch (cause) {
            setError(cause);
          }
        })}
      >
        <div className="form-grid">
          <FormField
            hint="The public operating name of your gym, studio, or enterprise."
            htmlFor="organizationName"
            label="Business Name"
          >
            <input
              className="fitos-control"
              id="organizationName"
              placeholder="e.g. FITOS Performance Gym"
              {...register("name", { required: true })}
            />
          </FormField>

          <FormField
            hint="Timezone used for classes, sessions, and reminder triggers."
            htmlFor="timezone"
            label="Default Timezone"
          >
            <input
              className="fitos-control"
              id="timezone"
              placeholder="e.g. Africa/Nairobi"
              {...register("timezone", { required: true })}
            />
          </FormField>

          <FormField
            hint="3-letter ISO currency code (e.g. KES, USD, EUR, GBP)."
            htmlFor="currency"
            label="Default Currency"
          >
            <input
              className="fitos-control"
              id="currency"
              maxLength={3}
              placeholder="KES"
              {...register("currency", { required: true })}
            />
          </FormField>
        </div>

        <ErrorNotice error={error} />

        <div className="form-actions">
          <Button loading={isSubmitting} type="submit">
            Save Changes
          </Button>
        </div>
      </form>
    </>
  );
}
