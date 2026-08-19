import type { CursorPage } from "./common.js";

export const MEMBER_STATUSES = ["active", "inactive", "suspended", "archived"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export interface ContactInput {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
}

export interface CreateMemberRequest {
  contact: ContactInput;
  homeBranchId: string;
}

export interface UpdateMemberRequest {
  contact?: Partial<ContactInput>;
  homeBranchId?: string | null;
  status?: MemberStatus;
}

export interface MemberResponse {
  id: string;
  tenantId: string;
  homeBranchId: string | null;
  memberNumber: string | null;
  status: MemberStatus;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    dateOfBirth: string | null;
  };
}

export interface MemberListItem {
  id: string;
  homeBranchId: string | null;
  status: MemberStatus;
  memberNumber: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  joinedAt: string;
  updatedAt: string;
}

export interface MemberListFilters {
  query?: string;
  status?: MemberStatus;
  branchId?: string;
  membershipStatus?: string;
  cursor?: string;
  limit?: number;
}

export type MemberListResponse = CursorPage<MemberListItem>;

export interface MemberTimelineItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorUserId: string | null;
  branchId: string | null;
  beforeSummary: Record<string, unknown> | null;
  afterSummary: Record<string, unknown> | null;
  createdAt: string;
}
