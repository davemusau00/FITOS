export type AutomationTriggerType =
  | "booking_created"
  | "booking_cancelled"
  | "member_joined"
  | "membership_expiring_soon"
  | "member_inactive"
  | "trial_completed"
  | "payment_failed";

export type AutomationActionType =
  "send_email" | "send_sms" | "send_whatsapp" | "create_staff_task" | "update_crm_stage";

export interface AutomationRuleResponse {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, unknown>;
  conditions: Array<{
    field: string;
    operator: "equals" | "greater_than" | "less_than" | "contains";
    value: string | number | boolean;
  }>;
  actionType: AutomationActionType;
  actionConfig: {
    template?: string;
    recipient?: string;
    recipientType?: "member" | "staff" | "lead";
    subject?: string;
    body?: string;
    targetStage?: string;
  };
  isActive: boolean;
  totalExecutions: number;
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationRuleRequest {
  name: string;
  description?: string;
  triggerType: AutomationTriggerType;
  triggerConfig?: Record<string, unknown>;
  conditions?: Array<{
    field: string;
    operator: "equals" | "greater_than" | "less_than" | "contains";
    value: string | number | boolean;
  }>;
  actionType: AutomationActionType;
  actionConfig: {
    template?: string;
    recipient?: string;
    recipientType?: "member" | "staff" | "lead";
    subject?: string;
    body?: string;
    targetStage?: string;
  };
  isActive?: boolean;
}

export interface UpdateAutomationRuleRequest {
  name?: string;
  description?: string;
  triggerType?: AutomationTriggerType;
  triggerConfig?: Record<string, unknown>;
  conditions?: Array<{
    field: string;
    operator: "equals" | "greater_than" | "less_than" | "contains";
    value: string | number | boolean;
  }>;
  actionType?: AutomationActionType;
  actionConfig?: {
    template?: string;
    recipient?: string;
    recipientType?: "member" | "staff" | "lead";
    subject?: string;
    body?: string;
    targetStage?: string;
  };
  isActive?: boolean;
}

export interface AutomationExecutionLogResponse {
  id: string;
  ruleId: string;
  ruleName: string;
  tenantId: string;
  status: "success" | "failed" | "skipped";
  triggerEvent: string;
  targetEntityId: string | null;
  targetEntityName: string | null;
  message: string;
  executedAt: string;
  actionId?: string | null;
  actionType?: AutomationActionType | null;
  provider?: string | null;
  externalId?: string | null;
  actionConfig?: Record<string, unknown>;
}

export type AutomationActionStatus = "delivered" | "simulated" | "skipped" | "failed";

export interface AutomationActionResult {
  actionId: string;
  actionType: AutomationActionType;
  status: AutomationActionStatus;
  provider: string;
  message: string;
  externalId?: string;
  completedAt: string;
}
