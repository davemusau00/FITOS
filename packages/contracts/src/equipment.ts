export type EquipmentStatus =
  | "available"
  | "in_use"
  | "maintenance"
  | "calibration_due"
  | "out_of_service"
  | "retired";

export interface EquipmentAssetResponse {
  id: string;
  tenantId: string;
  branchId: string;
  roomId: string | null;
  branchName?: string | null;
  roomName?: string | null;
  name: string;
  assetCode: string;
  serialNumber: string | null;
  modelName: string;
  category: string;
  status: EquipmentStatus;
  purchaseDate: string | null;
  warrantyEndsAt: string | null;
  lastServicedAt: string | null;
  nextServiceDueAt: string | null;
  lastCalibratedAt: string | null;
  nextCalibrationDueAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEquipmentAssetRequest {
  branchId: string;
  roomId?: string | null;
  name: string;
  assetCode: string;
  serialNumber?: string | null;
  modelName: string;
  category: string;
  status?: EquipmentStatus;
  purchaseDate?: string | null;
  warrantyEndsAt?: string | null;
  nextServiceDueAt?: string | null;
  nextCalibrationDueAt?: string | null;
  notes?: string | null;
}

export interface UpdateEquipmentAssetRequest {
  branchId?: string;
  roomId?: string | null;
  name?: string;
  assetCode?: string;
  serialNumber?: string | null;
  modelName?: string;
  category?: string;
  status?: EquipmentStatus;
  purchaseDate?: string | null;
  warrantyEndsAt?: string | null;
  nextServiceDueAt?: string | null;
  nextCalibrationDueAt?: string | null;
  notes?: string | null;
}

export interface EquipmentPoolResponse {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string | null;
  name: string;
  category: string;
  totalQuantity: number;
  availableQuantity: number;
  assetIds: string[];
}

export interface CreateEquipmentPoolRequest {
  branchId: string;
  name: string;
  category: string;
  assetIds: string[];
}

export interface EquipmentMaintenanceRecordResponse {
  id: string;
  tenantId: string;
  assetId: string;
  assetName: string;
  type: "maintenance" | "calibration" | "inspection" | "repair";
  performedAt: string;
  performedBy: string;
  costMinor: number | null;
  notes: string;
  nextDueAt: string | null;
  createdAt: string;
}

export interface CreateMaintenanceRecordRequest {
  assetId: string;
  type: "maintenance" | "calibration" | "inspection" | "repair";
  performedBy: string;
  costMinor?: number | null;
  notes: string;
  nextDueAt?: string | null;
}

export interface EquipmentAllocationResponse { id: string; tenantId: string; occurrenceId: string; assetId: string; status: "reserved" | "released"; createdAt: string; }
