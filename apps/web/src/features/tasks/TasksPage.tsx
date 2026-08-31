import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, EmptyState, PageHeader } from "@fitos/ui";
import type { TaskPriority, TaskStatus } from "@fitos/contracts";
import { api } from "../../lib/api/client";
import { can, useAuth } from "../../app/auth";
import { useBranch } from "../../app/branch-context";
import { ErrorNotice, PageLoading, formatDate } from "../shared";

const priorities: Array<{ value: TaskPriority; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
  { value: "low", label: "Low" }
];

export function TasksPage() {
  const { auth } = useAuth();
  const { activeBranchId } = useBranch();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueAt, setDueAt] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");

  const tasks = useQuery({
    queryKey: ["tasks", activeBranchId, status],
    queryFn: () =>
      api.tasks({
        ...(activeBranchId ? { branchId: activeBranchId } : {}),
        ...(status !== "all" ? { status } : {})
      }),
    enabled: Boolean(activeBranchId && can(auth, "task:read"))
  });
  const staff = useQuery({
    queryKey: ["staff", "task-assignees"],
    queryFn: api.staff,
    enabled: can(auth, "task:manage") && can(auth, "staff:read")
  });
  const create = useMutation({
    mutationFn: () =>
      api.createTask({
        title: title.trim(),
        description: description.trim() || null,
        branchId: activeBranchId,
        assigneeUserId: assigneeUserId || null,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setDueAt("");
      setAssigneeUserId("");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }
  });
  const complete = useMutation({
    mutationFn: (taskId: string) => api.completeTask(taskId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] })
  });

  if (!can(auth, "task:read")) {
    return (
      <EmptyState
        title="Tasks are unavailable"
        description="Your role does not include task access."
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Productivity"
        title="Tasks"
        description="Keep cross-domain follow-ups visible, assigned, and recoverable from one queue."
      />
      <ErrorNotice error={tasks.error ?? staff.error ?? create.error ?? complete.error} />
      {can(auth, "task:manage") ? (
        <Card className="task-create-card">
          <div className="task-create-card__header">
            <div>
              <h2>Create a task</h2>
              <p>Link the next action to the active branch context.</p>
            </div>
          </div>
          <div className="task-create-card__grid">
            <label className="form-field">
              <span className="form-field__label">Title</span>
              <input
                className="fitos-control"
                maxLength={180}
                onChange={(event) => setTitle(event.currentTarget.value)}
                placeholder="Call member about renewal"
                value={title}
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">Priority</span>
              <select
                className="fitos-control"
                onChange={(event) => setPriority(event.currentTarget.value as TaskPriority)}
                value={priority}
              >
                {priorities.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-field__label">Due</span>
              <input
                className="fitos-control"
                onChange={(event) => setDueAt(event.currentTarget.value)}
                type="datetime-local"
                value={dueAt}
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">Assignee</span>
              <select
                className="fitos-control"
                onChange={(event) => setAssigneeUserId(event.currentTarget.value)}
                value={assigneeUserId}
              >
                <option value="">Unassigned</option>
                {staff.data?.map((member) => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.user.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field task-create-card__description">
              <span className="form-field__label">Notes</span>
              <textarea
                className="fitos-control"
                maxLength={4000}
                onChange={(event) => setDescription(event.currentTarget.value)}
                placeholder="Add context for the person picking this up"
                rows={2}
                value={description}
              />
            </label>
          </div>
          <Button
            disabled={!title.trim() || !activeBranchId}
            loading={create.isPending}
            onClick={() => create.mutate()}
            variant="primary"
          >
            Create task
          </Button>
        </Card>
      ) : null}

      <div className="task-queue-header">
        <div>
          <h2>Task queue</h2>
          <p className="muted">Branch-scoped tasks are filtered by the active context.</p>
        </div>
        <select
          aria-label="Filter tasks by status"
          className="fitos-control"
          onChange={(event) => setStatus(event.currentTarget.value as TaskStatus | "all")}
          value={status}
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {tasks.isLoading ? <PageLoading /> : null}
      {!tasks.isLoading && !tasks.data?.length ? (
        <EmptyState
          description="Create a task when a follow-up needs a clear owner and due date."
          title="No tasks in this view"
        />
      ) : (
        <div className="task-list">
          {tasks.data?.map((task) => (
            <Card className={`task-list__item task-list__item--${task.priority}`} key={task.id}>
              <div className="task-list__main">
                <div className="task-list__title-row">
                  <h3>{task.title}</h3>
                  <span className={`task-status task-status--${task.status}`}>
                    {task.status.replace("_", " ")}
                  </span>
                </div>
                {task.description ? <p>{task.description}</p> : null}
                <div className="task-list__meta">
                  <span>{task.priority} priority</span>
                  <span>{task.dueAt ? `Due ${formatDate(task.dueAt)}` : "No due date"}</span>
                  <span>{task.assigneeUserId ? "Assigned" : "Unassigned"}</span>
                </div>
              </div>
              {can(auth, "task:manage") &&
              task.status !== "completed" &&
              task.status !== "cancelled" ? (
                <Button
                  loading={complete.isPending && complete.variables === task.id}
                  onClick={() => complete.mutate(task.id)}
                  size="small"
                  variant="secondary"
                >
                  Complete
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
