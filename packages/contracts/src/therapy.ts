export type ModalityCode =
  | "neubie_direct_current"
  | "alterg_anti_gravity"
  | "normatec_compression"
  | "hyperbaric_oxygen"
  | "cryotherapy"
  | "infrared_sauna";

export type ModalityCategory =
  "neuromuscular" | "unweighted_gait" | "pneumatic_compression" | "thermal_cryo";

export type TherapySessionStatus = "in_progress" | "completed" | "interrupted";

export interface TherapyModalityResponse {
  id: string;
  tenantId: string;
  code: ModalityCode;
  name: string;
  category: ModalityCategory;
  defaultDurationMinutes: number;
  contraindications: string[];
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTherapyModalityRequest {
  code: ModalityCode;
  name: string;
  category: ModalityCategory;
  defaultDurationMinutes: number;
  contraindications: string[];
  description: string;
}

export interface TherapyProtocolResponse {
  id: string;
  tenantId: string;
  modalityCode: ModalityCode;
  modalityName: string;
  name: string;
  indication: string;
  targetArea: string;
  parameters: Record<string, string | number>;
  safetyChecklist: string[];
  clinicalNotes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTherapyProtocolRequest {
  modalityCode: ModalityCode;
  modalityName: string;
  name: string;
  indication: string;
  targetArea: string;
  parameters: Record<string, string | number>;
  safetyChecklist: string[];
  clinicalNotes: string;
}

export interface TherapySessionResponse {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string | null;
  memberId: string;
  memberName: string;
  staffUserId: string;
  staffName: string;
  protocolId: string;
  protocolName: string;
  modalityCode: ModalityCode;
  assetId?: string | null;
  assetName?: string | null;
  status: TherapySessionStatus;
  startedAt: string;
  completedAt: string | null;
  prePainScore: number | null;
  postPainScore: number | null;
  actualDosage: Record<string, string | number>;
  adverseReaction: boolean;
  sessionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTherapySessionRequest {
  branchId: string;
  memberId: string;
  protocolId: string;
  assetId?: string;
  prePainScore?: number;
  postPainScore?: number;
  actualDosage: Record<string, string | number>;
  adverseReaction?: boolean;
  sessionNotes?: string;
  status?: TherapySessionStatus;
}
