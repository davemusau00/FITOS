import type { Money } from "./common.js";

export const MEMBERSHIP_STATUSES = [
  "scheduled",
  "active",
  "paused",
  "expired",
  "cancelled",
  "exhausted"
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const CREDIT_REASONS = [
  "purchase",
  "booking",
  "cancellation",
  "manual_adjustment",
  "expiry"
] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

export interface MembershipPlanResponse {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  slug: string;
  price: Money | null;
  durationDays: number | null;
  includedCredits: number;
  publicVisible: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMembershipPlanRequest {
  branchId?: string | null;
  name: string;
  slug?: string;
  price?: Money | null;
  durationDays?: number | null;
  includedCredits: number;
  publicVisible?: boolean;
}

export interface MemberMembershipResponse {
  id: string;
  tenantId: string;
  memberId: string;
  planId: string | null;
  planSnapshot: MembershipPlanResponse;
  status: MembershipStatus;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivateMembershipRequest {
  memberId: string;
  planId: string;
  startsAt?: string;
}

export interface CreditLedgerEntryResponse {
  id: string;
  membershipId: string;
  memberId: string;
  delta: number;
  reason: CreditReason;
  bookingId: string | null;
  note: string | null;
  createdAt: string;
}

export interface ManualCreditAdjustmentRequest {
  membershipId: string;
  delta: number;
  reason: string;
}
