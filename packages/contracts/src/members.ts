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
  tagId?: string;
  membershipStatus?: string;
  cursor?: string;
  limit?: number;
}

export type MemberListResponse = CursorPage<MemberListItem>;

export interface MemberTagResponse {
  id: string;
  tenantId: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberTagRequest {
  name: string;
  color?: string | null;
}

export interface UpdateMemberTagRequest {
  name?: string;
  color?: string | null;
}

export interface MemberSegmentFilters {
  status?: MemberStatus;
  branchId?: string;
  tagId?: string;
}

export interface MemberSegmentResponse {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  filters: MemberSegmentFilters;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberSegmentRequest {
  name: string;
  description?: string | null;
  filters: MemberSegmentFilters;
}

export interface UpdateMemberSegmentRequest {
  name?: string;
  description?: string | null;
  filters?: MemberSegmentFilters;
}

export interface MemberSavedViewFilters {
  query?: string;
  status?: MemberStatus;
  branchId?: string;
  tagId?: string;
  membershipStatus?: string;
}

export interface MemberSavedViewResponse {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  filters: MemberSavedViewFilters;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberSavedViewRequest {
  name: string;
  filters: MemberSavedViewFilters;
}

export interface UpdateMemberSavedViewRequest {
  name?: string;
  filters?: MemberSavedViewFilters;
}

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
