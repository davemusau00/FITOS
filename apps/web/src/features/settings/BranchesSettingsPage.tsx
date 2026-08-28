import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, FormField, Icon, PageHeader, StatusBadge } from "@fitos/ui";
import { api } from "../../lib/api/client";
import { PageLoading, ErrorNotice, useToast } from "../shared";

export function BranchesSettingsPage() {
  const queryClient = useQueryClient();
  const { success } = useToast();
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
      <div className="settings-back-link">
        <Link className="text-link" to="/app/settings">
          <Icon name="arrow-left" size={14} /> Back to Settings
        </Link>
      </div>

      <PageHeader
        eyebrow="Settings • Facilities"
        title="Branch Locations"
        description="Locations anchor schedules, memberships, attendance, and branch-level reporting across your fitness system."
      />

      <section className="detail-grid">
        {/* Left: Branch List */}
        <Card>
          <div className="card-header">
            <h2>Active Branches ({branches.data?.length ?? 0})</h2>
          </div>

          {branches.data?.length ? (
            <ul className="branch-list">
              {branches.data.map((branch) => (
                <li key={branch.id}>
                  <div className="branch-list__identity">
                    <div className="branch-list__icon">
                      <Icon name="building" size={16} />
                    </div>
                    <div>
                      <strong className="branch-list__name">{branch.name}</strong>
                      <span className="branch-list__meta">
                        {branch.city ?? "Primary"} · {branch.timezone ?? "Default Timezone"}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={branch.isActive ? "active" : "inactive"} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No branches configured yet.</p>
          )}
        </Card>

        {/* Right: Add Branch Form */}
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
              success("Branch added", `Successfully added "${values.name}" to your locations.`);
              reset();
            } catch (cause) {
              setError(cause);
            }
          })}
        >
          <div className="card-header">
            <h2>Add New Branch</h2>
          </div>

          <FormField
            hint="Location or facility title (e.g. Downtown Studio, Westlands Hub)."
            htmlFor="branchName"
            label="Branch Name"
          >
            <input
              className="fitos-control"
              id="branchName"
              placeholder="e.g. Kilimani Branch"
              {...register("name", { required: true })}
            />
          </FormField>

          <FormField
            hint="City or locality where this facility is based."
            htmlFor="branchCity"
            label="City"
            optional
          >
            <input
              className="fitos-control"
              id="branchCity"
              placeholder="e.g. Nairobi"
              {...register("city")}
            />
          </FormField>

          <FormField hint="Local operational timezone." htmlFor="branchTimezone" label="Timezone">
            <input
              className="fitos-control"
              id="branchTimezone"
              placeholder="Africa/Nairobi"
              {...register("timezone", { required: true })}
            />
          </FormField>

          <ErrorNotice error={error} />

          <div className="form-actions">
            <Button loading={isSubmitting} type="submit">
              <Icon name="plus" size={16} />
              Create Branch
            </Button>
          </div>
        </form>
      </section>
    </>
  );
}
