import type { CursorPage } from "./common.js";

export const BOOKING_STATUSES = ["confirmed", "waitlisted", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_SOURCES = ["staff", "public", "member_portal"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export interface BookingResponse {
  id: string;
  tenantId: string;
  branchId: string;
  occurrenceId: string;
  memberId: string;
  status: BookingStatus;
  source: BookingSource;
  /** One-based queue position for active waitlisted bookings. */
  waitlistPosition?: number | null;
  bookedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  creditMembershipId: string | null;
  creditsDebited: number;
  entitlementOverrideReason: string | null;
  lateCancelled: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Denormalized display context; authorization still comes from the booking scope. */
  serviceName?: string;
}

export interface CreateBookingRequest {
  occurrenceId: string;
  memberId: string;
  source?: BookingSource;
  /** When true, create a waitlisted booking if the occurrence is full. */
  waitlist?: boolean;
  /** Required when an authorized staff member bypasses insufficient entitlement. */
  overrideReason?: string;
}

export interface ReorderWaitlistedBookingRequest {
  position: number;
}

export interface CancelBookingRequest {
  reason: string;
}

export interface BookingListFilters {
  occurrenceId?: string;
  memberId?: string;
  status?: BookingStatus;
  cursor?: string;
  limit?: number;
}

export type BookingListResponse = CursorPage<BookingResponse>;
