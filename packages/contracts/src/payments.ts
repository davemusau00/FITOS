import type { Money } from "./common.js";

export const PAYMENT_METHODS = ["cash", "bank_transfer", "mpesa", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["pending", "completed", "refunded", "voided"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_ALLOCATION_TYPES = ["membership", "booking", "walkIn", "other"] as const;
export type PaymentAllocationType = (typeof PAYMENT_ALLOCATION_TYPES)[number];

// ---- Payment Transactions ----

export interface PaymentTransactionResponse {
  id: string;
  tenantId: string;
  branchId: string;
  memberId: string | null;
  amount: Money;
  method: PaymentMethod;
  reference: string | null;
  providerRef: string | null;
  status: PaymentStatus;
  note: string | null;
  allocationType: PaymentAllocationType | null;
  allocationId: string | null;
  recordedByUserId: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  branchId: string;
  memberId?: string | null;
  amount: Money;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
  allocationType?: PaymentAllocationType | null;
  allocationId?: string | null;
}

export interface PaymentListFilters {
  branchId?: string;
  memberId?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  unmatched?: boolean;
  cursor?: string;
  limit?: number;
}
