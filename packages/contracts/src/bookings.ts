import type { CursorPage } from "./common.js";

export const BOOKING_STATUSES = ["confirmed", "cancelled"] as const;
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
  bookedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingRequest {
  occurrenceId: string;
  memberId: string;
  source?: BookingSource;
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
