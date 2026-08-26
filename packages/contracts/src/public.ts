import type { Money } from "./common.js";
import type { ServiceType } from "./services.js";

export interface PublicTenantInfoResponse {
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  currency: string;
  timezone: string;
  branches: Array<{
    id: string;
    name: string;
    slug: string;
    city: string | null;
    addressLine1: string | null;
    phone: string | null;
    email: string | null;
  }>;
}

export interface PublicServiceResponse {
  id: string;
  name: string;
  slug: string;
  serviceType: ServiceType;
  durationMinutes: number;
  creditsRequired: number;
  price: Money | null;
  branchName: string | null;
}

export interface PublicCoachResponse {
  id: string;
  displayName: string;
  roleName: string;
  specialties: string[];
  bio: string;
}

export interface PublicScheduleOccurrenceResponse {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceType: ServiceType;
  trainerName: string | null;
  roomName: string | null;
  branchName: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  availableSpots: number;
  price: Money | null;
}

export interface CreatePublicLeadRequest {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  branchId?: string | null;
  interest?: string | null;
  notes?: string | null;
}

export type PublicReservationType =
  "class" | "assessment" | "therapy" | "recovery" | "consultation" | "facility";
export interface CreatePublicReservationRequest {
  branchId?: string;
  occurrenceId?: string;
  serviceId?: string;
  reservationType: PublicReservationType;
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}
export interface PublicReservationResponse extends CreatePublicReservationRequest {
  id: string;
  tenantId: string;
  status: "requested" | "confirmed" | "waitlisted" | "cancelled";
  createdAt: string;
}
