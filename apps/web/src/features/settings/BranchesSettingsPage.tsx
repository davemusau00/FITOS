import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, FormField, PageHeader, StatusBadge } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { PageLoading, ErrorNotice } from "../shared";

export function BranchesSettingsPage() {
  const queryClient = useQueryClient();
  const branches = useQuery({ queryKey: ["branches"], queryFn: api.branches });
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
              await queryClient.invalidateQueries({ queryKey: ["branches"] });
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
