export type InventoryMovementType =
  | "purchase_in"
  | "sale_out"
  | "session_usage"
  | "adjustment"
  | "transfer"
  | "waste";

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";

export interface InventoryItemResponse {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string | null;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitCostMinor: number;
  retailPriceMinor: number;
  stockOnHand: number;
  reorderPoint: number;
  reorderQuantity: number;
  isRetail: boolean;
  isConsumable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemRequest {
  branchId: string;
  sku: string;
  name: string;
  category: string;
  unit?: string;
  unitCostMinor: number;
  retailPriceMinor?: number;
  initialStock?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  isRetail?: boolean;
  isConsumable?: boolean;
}

export interface UpdateInventoryItemRequest {
  name?: string;
  category?: string;
  unit?: string;
  unitCostMinor?: number;
  retailPriceMinor?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  isRetail?: boolean;
  isConsumable?: boolean;
}

export interface InventoryMovementResponse {
  id: string;
  tenantId: string;
  branchId: string;
  itemId: string;
  itemName: string;
  movementType: InventoryMovementType;
  quantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  costMinor?: number | null;
  notes?: string | null;
  recordedByUserId: string;
  recordedByName?: string | null;
  recordedAt: string;
}

export interface CreateInventoryMovementRequest {
  branchId: string;
  itemId: string;
  movementType: InventoryMovementType;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  costMinor?: number;
  notes?: string;
}
export interface ServiceInventoryRequirement { itemId: string; quantityPerSession: number; }
export interface InventoryConsumptionResponse { id: string; tenantId: string; branchId: string; itemId: string; serviceId: string | null; referenceType: string; referenceId: string | null; quantity: number; createdAt: string; }
export interface InventoryLotResponse {
  id: string;
  tenantId: string;
  branchId: string | null;
  itemId: string;
  lotCode: string | null;
  purchaseOrderId: string | null;
  quantityReceived: number;
  quantityOnHand: number;
  unitCostMinor: number;
  expiresOn: string | null;
  receivedAt: string;
  notes: string | null;
  createdAt: string;
}
export interface CreateInventoryLotRequest {
  branchId?: string;
  itemId: string;
  lotCode?: string;
  purchaseOrderId?: string;
  quantityReceived: number;
  unitCostMinor?: number;
  expiresOn?: string;
  notes?: string;
}

export interface StocktakeLineResponse {
  id: string;
  stocktakeId: string;
  itemId: string;
  itemName?: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
}

export interface StocktakeResponse {
  id: string;
  tenantId: string;
  branchId: string | null;
  status: "draft" | "completed";
  notes: string | null;
  lines: StocktakeLineResponse[];
  createdByUserId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateStocktakeRequest {
  branchId?: string;
  notes?: string;
}

export interface RecordStocktakeCountRequest {
  itemId: string;
  countedQuantity: number;
}


export interface PurchaseOrderItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitCostMinor: number;
  totalMinor: number;
}

export interface PurchaseOrderResponse {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string | null;
  poNumber: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  totalMinor: number;
  orderedAt: string | null;
  receivedAt: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderRequest {
  branchId: string;
  supplierName: string;
  items: Array<{
    itemId: string;
    quantity: number;
    unitCostMinor: number;
  }>;
  notes?: string;
}
