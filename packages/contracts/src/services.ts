import type { CursorPage, Money } from "./common.js";

export const SERVICE_TYPES = ["class", "appointment", "facility", "access"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const OCCURRENCE_STATUSES = ["scheduled", "cancelled"] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export const SCHEDULE_EXCEPTION_TYPES = ["cancelled", "overridden"] as const;
export type ScheduleExceptionType = (typeof SCHEDULE_EXCEPTION_TYPES)[number];

export interface ServiceResponse {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  slug: string;
  serviceType: ServiceType;
  durationMinutes: number;
  defaultCapacity: number | null;
  /** Credits debited atomically when this service is booked. Zero means no entitlement is required. */
  creditsRequired: number;
  /** A cancellation at or inside this window is late. */
  cancellationCutoffMinutes: number;
  restoreCreditOnLateCancel: boolean;
  price: Money | null;
  publicVisible: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceRequest {
  branchId?: string | null;
  name: string;
  slug?: string;
  serviceType: ServiceType;
  durationMinutes: number;
  defaultCapacity?: number | null;
  creditsRequired?: number;
  cancellationCutoffMinutes?: number;
  restoreCreditOnLateCancel?: boolean;
  price?: Money | null;
  publicVisible?: boolean;
}

export interface UpdateServiceRequest {
  name?: string;
  slug?: string;
  durationMinutes?: number;
  defaultCapacity?: number | null;
  creditsRequired?: number;
  cancellationCutoffMinutes?: number;
  restoreCreditOnLateCancel?: boolean;
  price?: Money | null;
  publicVisible?: boolean;
  isActive?: boolean;
}

export interface RoomResponse {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomRequest {
  branchId: string;
  name: string;
  capacity?: number | null;
}

export interface UpdateRoomRequest {
  name?: string;
  capacity?: number | null;
  isActive?: boolean;
}

export interface ScheduleOccurrenceResponse {
  id: string;
  tenantId: string;
  branchId: string;
  templateId: string | null;
  serviceId: string;
  trainerUserId: string | null;
  roomId: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: OccurrenceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleTemplateResponse {
  id: string;
  tenantId: string;
  branchId: string;
  serviceId: string;
  trainerUserId: string | null;
  roomId: string | null;
  timezone: string;
  /** Sunday = 0 through Saturday = 6. */
  daysOfWeek: number[];
  /** Local wall-clock time in HH:mm form. */
  localStartTime: string;
  durationMinutes: number;
  capacity: number;
  effectiveStartDate: string;
  effectiveEndDate: string | null;
  materializedThrough: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleTemplateRequest {
  branchId: string;
  serviceId: string;
  trainerUserId?: string | null;
  roomId?: string | null;
  timezone: string;
  daysOfWeek: number[];
  localStartTime: string;
  durationMinutes: number;
  capacity: number;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  /** Inclusive and bounded; defaults to twelve weeks after the effective start. */
  materializeThroughDate?: string;
}

export interface MaterializeScheduleTemplateRequest {
  throughDate: string;
}

export interface ScheduleTemplateMutationResponse {
  template: ScheduleTemplateResponse;
  occurrences: ScheduleOccurrenceResponse[];
}

export interface OverrideScheduleOccurrenceRequest {
  trainerUserId?: string | null;
  roomId?: string | null;
  startsAt?: string;
  endsAt?: string;
  capacity?: number;
  reason: string;
}

export interface ScheduleExceptionResponse {
  id: string;
  tenantId: string;
  templateId: string;
  occurrenceId: string;
  exceptionType: ScheduleExceptionType;
  reason: string;
  originalStartsAt: string;
  createdByUserId: string;
  createdAt: string;
}

export interface CreateScheduleOccurrenceRequest {
  branchId: string;
  serviceId: string;
  trainerUserId?: string | null;
  roomId?: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
}

export interface CancelScheduleOccurrenceRequest {
  reason: string;
}

export interface ScheduleOccurrenceFilters {
  branchId?: string;
  serviceId?: string;
  trainerUserId?: string;
  roomId?: string;
  startsAfter?: string;
  endsBefore?: string;
  status?: OccurrenceStatus;
  cursor?: string;
  limit?: number;
}

export type ServiceListResponse = CursorPage<ServiceResponse>;
export type ScheduleOccurrenceListResponse = CursorPage<ScheduleOccurrenceResponse>;
export type ScheduleTemplateListResponse = CursorPage<ScheduleTemplateResponse>;
