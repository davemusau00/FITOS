export type AssessmentCategory =
  | "body_composition"
  | "cardiovascular_vo2"
  | "neuromuscular_force"
  | "mobility_rom"
  | "metabolic";

export type DeviceVendor =
  | "lookinbody_inbody"
  | "vald_forcedecks"
  | "cosmed_k5"
  | "pnoe"
  | "manual";

export interface MetricDefinition {
  key: string;
  name: string;
  unit: string;
  description?: string;
  optimalMin?: number;
  optimalMax?: number;
}

export interface AssessmentDefinitionResponse {
  id: string;
  tenantId: string;
  name: string;
  category: AssessmentCategory;
  description: string;
  deviceVendor: DeviceVendor;
  metrics: MetricDefinition[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssessmentDefinitionRequest {
  name: string;
  category: AssessmentCategory;
  description: string;
  deviceVendor: DeviceVendor;
  metrics: MetricDefinition[];
}

export interface AssessmentSessionResponse {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string | null;
  memberId: string;
  memberName: string;
  assessorStaffId: string;
  assessorName: string;
  definitionId: string;
  definitionName: string;
  category: AssessmentCategory;
  status: "draft" | "completed";
  conductedAt: string;
  summary: string;
  metrics: Record<string, number | string>;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssessmentSessionRequest {
  branchId: string;
  memberId: string;
  definitionId: string;
  conductedAt?: string;
  summary: string;
  metrics: Record<string, number | string>;
  notes?: string;
}

export interface MemberPerformanceProfileResponse {
  memberId: string;
  memberName: string;
  totalAssessments: number;
  lastAssessedAt: string | null;
  latestMetrics: Record<string, number | string>;
  timeline: AssessmentSessionResponse[];
}
