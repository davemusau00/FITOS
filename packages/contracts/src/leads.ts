import type { CursorPage } from "./common.js";
import type { BookingResponse } from "./bookings.js";
import type { ContactInput, MemberResponse } from "./members.js";

export const LEAD_STAGES = [
  "new",
  "contacted",
  "trial_booked",
  "trial_completed",
  "offer",
  "joined",
  "lost"
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export interface LeadContact {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
}

export interface LeadResponse {
  id: string;
  tenantId: string;
  contact: LeadContact;
  branchId: string | null;
  ownerUserId: string | null;
  interest: string | null;
  source: string | null;
  stage: LeadStage;
  lostReason: string | null;
  nextFollowUpAt: string | null;
  convertedMemberId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListFilters {
  query?: string;
  stage?: LeadStage;
  branchId?: string;
  cursor?: string;
  limit?: number;
}

export type LeadListResponse = CursorPage<LeadResponse>;

export interface LeadWorkloadItem {
  ownerUserId: string | null;
  leadCount: number;
  overdueFollowUps: number;
  openTasks: number;
  overdueTasks: number;
}

export interface LeadWorkloadResponse {
  branchId: string | null;
  totalLeads: number;
  unassignedLeads: number;
  overdueFollowUps: number;
  overdueTasks: number;
  items: LeadWorkloadItem[];
}

export interface CreateLeadRequest {
  contact: ContactInput;
  branchId?: string | null;
  interest?: string | null;
  source?: string | null;
  ownerUserId?: string | null;
  nextFollowUpAt?: string | null;
}

export interface UpdateLeadRequest {
  interest?: string | null;
  source?: string | null;
  ownerUserId?: string | null;
  branchId?: string | null;
  nextFollowUpAt?: string | null;
}

export interface UpdateLeadStageRequest {
  stage: LeadStage;
  lostReason?: string | null;
}

export interface LeadNoteResponse {
  id: string;
  body: string;
  createdByUserId: string | null;
  createdAt: string;
}

export interface CreateLeadTaskRequest {
  body: string;
  dueAt?: string | null;
  assigneeUserId?: string | null;
}

export interface LeadTaskResponse {
  id: string;
  body: string;
  dueAt: string | null;
  assigneeUserId: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface LeadConversionResponse {
  lead: LeadResponse;
  member: MemberResponse;
  alreadyConverted: boolean;
}

export interface CreateLeadTrialBookingRequest {
  occurrenceId: string;
}

export interface LeadTrialBookingResponse {
  lead: LeadResponse;
  booking: BookingResponse;
}
