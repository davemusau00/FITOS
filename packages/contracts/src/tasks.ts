import type { MemberStatus } from "./members.js";

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskResponse {
  id: string;
  tenantId: string;
  branchId: string | null;
  title: string;
  description: string | null;
  assigneeUserId: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  resourceType: string | null;
  resourceId: string | null;
  createdByUserId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  branchId?: string | null;
  assigneeUserId?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  branchId?: string | null;
  assigneeUserId?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueAt?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
}

export interface TaskListFilters {
  status?: TaskStatus;
  assigneeUserId?: string;
  branchId?: string;
  dueBefore?: string;
  limit?: number;
}

export interface TaskSummary {
  open: number;
  due: number;
  overdue: number;
  completed: number;
}

export interface TaskCommentResponse {
  id: string;
  taskId: string;
  authorUserId: string | null;
  body: string;
  createdAt: string;
}

export interface CreateTaskCommentRequest {
  body: string;
}

// Kept as a narrow alias for consumers that link task records from member workflows.
export type TaskLinkedMemberStatus = MemberStatus;
