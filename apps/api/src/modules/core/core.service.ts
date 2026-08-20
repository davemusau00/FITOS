import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { normalizePhone } from "@fitos/shared";
import type {
  AuditEventResponse,
  BranchResponse,
  CreateBranchRequest,
  CreateMemberRequest,
  CreateLeadRequest,
  CursorPage,
  DomainEvent,
  MemberListFilters,
  MemberListItem,
  MemberResponse,
  LeadListFilters,
  LeadConversionResponse,
  LeadNoteResponse,
  LeadResponse,
  LeadTaskResponse,
  CreateLeadTaskRequest,
  RequestActor,
  RoleResponse,
  StaffUserResponse,
  TenantSummary,
  UpdateBranchRequest,
  UpdateMemberRequest,
  UpdateLeadStageRequest,
  UpdateOrganizationRequest
} from "@fitos/contracts";
import { DomainError } from "../../common/errors/domain-error.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type {
  FitosRepository,
  InviteStaffInput,
  StaffAccessInput,
  TenantScope
} from "../../ports/fitos-repository.js";

const scopeOf = (actor: RequestActor): TenantScope => ({
  tenantId: actor.tenantId,
  tenantUserId: actor.tenantUserId,
  userId: actor.userId,
  branchIds: actor.branchIds
});

const eventOf = <T>(actor: RequestActor, type: string, payload: T): DomainEvent<T> => ({
  eventId: randomUUID(),
  type,
  version: 1,
  tenantId: actor.tenantId,
  occurredAt: new Date().toISOString(),
  payload
});

@Injectable()
export class CoreService {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  async getOrganization(actor: RequestActor): Promise<TenantSummary> {
    const tenant = await this.repository.findTenant(scopeOf(actor));
    if (!tenant) throw new DomainError("RESOURCE_NOT_FOUND", "Organization not found.", 404);
    return tenant;
  }

  async updateOrganization(
    actor: RequestActor,
    requestId: string,
    input: UpdateOrganizationRequest
  ): Promise<TenantSummary> {
    await this.getOrganization(actor);
    const updated = await this.repository.updateTenant(scopeOf(actor), input);
    await this.audit(actor, requestId, "tenant.updated", "tenant", updated.id, null, {
      changed: Object.keys(input)
    });
    await this.publish(eventOf(actor, "tenant.updated", { tenantId: updated.id }));
    return updated;
  }

  async listBranches(actor: RequestActor): Promise<BranchResponse[]> {
    return this.repository.listBranches(scopeOf(actor));
  }

  async getBranch(actor: RequestActor, branchId: string): Promise<BranchResponse> {
    const branch = await this.repository.findBranchById(scopeOf(actor), branchId);
    if (!branch) throw new DomainError("RESOURCE_NOT_FOUND", "Branch not found.", 404);
    return branch;
  }

  async createBranch(
    actor: RequestActor,
    requestId: string,
    input: CreateBranchRequest
  ): Promise<BranchResponse> {
    try {
      const branch = await this.repository.createBranch(scopeOf(actor), input);
      await this.audit(actor, requestId, "branch.created", "branch", branch.id, branch.id, {
        name: branch.name,
        slug: branch.slug
      });
      await this.publish(eventOf(actor, "branch.created", { branchId: branch.id }));
      return branch;
    } catch (error) {
      if (error instanceof Error && error.message.includes("slug")) {
        throw new DomainError("VALIDATION_FAILED", "A branch with that slug already exists.", 409, {
          slug: ["Must be unique within this organization."]
        });
      }
      throw error;
    }
  }

  async updateBranch(
    actor: RequestActor,
    requestId: string,
    branchId: string,
    input: UpdateBranchRequest
  ): Promise<BranchResponse> {
    const before = await this.getBranch(actor, branchId);
    try {
      const updated = await this.repository.updateBranch(scopeOf(actor), branchId, input);
      if (!updated) throw new DomainError("RESOURCE_NOT_FOUND", "Branch not found.", 404);
      await this.audit(
        actor,
        requestId,
        updated.isActive ? "branch.updated" : "branch.deactivated",
        "branch",
        updated.id,
        updated.id,
        {
          changed: Object.keys(input),
          beforeActive: before.isActive,
          afterActive: updated.isActive
        }
      );
      await this.publish(
        eventOf(actor, updated.isActive ? "branch.updated" : "branch.deactivated", {
          branchId: updated.id
        })
      );
      return updated;
    } catch (error) {
      if (error instanceof Error && error.message.includes("slug")) {
        throw new DomainError("VALIDATION_FAILED", "A branch with that slug already exists.", 409, {
          slug: ["Must be unique within this organization."]
        });
      }
      throw error;
    }
  }

  async listMembers(
    actor: RequestActor,
    filters: MemberListFilters
  ): Promise<CursorPage<MemberListItem>> {
    return this.repository.searchMembers(scopeOf(actor), filters);
  }

  async getMember(actor: RequestActor, memberId: string): Promise<MemberResponse> {
    const member = await this.repository.findMemberById(scopeOf(actor), memberId);
    if (!member) throw new DomainError("MEMBER_NOT_FOUND", "Member not found.", 404);
    return member;
  }

  async createMember(
    actor: RequestActor,
    requestId: string,
    input: CreateMemberRequest
  ): Promise<MemberResponse> {
    if (!actor.branchIds.includes(input.homeBranchId)) {
      throw new DomainError(
        "BRANCH_ACCESS_DENIED",
        "You cannot create a member for this branch.",
        404
      );
    }
    const phone = this.normalizePhoneInput(input.contact.phone);
    try {
      const member = await this.repository.createMember(scopeOf(actor), input, phone);
      await this.audit(
        actor,
        requestId,
        "member.created",
        "member",
        member.id,
        member.homeBranchId,
        {
          name: `${member.contact.firstName} ${member.contact.lastName ?? ""}`.trim(),
          status: member.status
        }
      );
      await this.publish(eventOf(actor, "member.created", { memberId: member.id }));
      return member;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Branch")) {
        throw new DomainError(
          "BRANCH_ACCESS_DENIED",
          "You cannot create a member for this branch.",
          404
        );
      }
      throw error;
    }
  }

  async updateMember(
    actor: RequestActor,
    requestId: string,
    memberId: string,
    input: UpdateMemberRequest
  ): Promise<MemberResponse> {
    const before = await this.getMember(actor, memberId);
    if (input.homeBranchId && !actor.branchIds.includes(input.homeBranchId)) {
      throw new DomainError(
        "BRANCH_ACCESS_DENIED",
        "You cannot move a member to this branch.",
        404
      );
    }
    const phone =
      input.contact && Object.prototype.hasOwnProperty.call(input.contact, "phone")
        ? this.normalizePhoneInput(input.contact.phone)
        : undefined;
    const updated = await this.repository.updateMember(scopeOf(actor), memberId, input, phone);
    if (!updated) throw new DomainError("MEMBER_NOT_FOUND", "Member not found.", 404);
    await this.audit(
      actor,
      requestId,
      input.status === "archived" ? "member.deactivated" : "member.updated",
      "member",
      updated.id,
      updated.homeBranchId,
      {
        changed: Object.keys(input),
        previousStatus: before.status,
        status: updated.status
      }
    );
    await this.publish(
      eventOf(actor, input.status === "archived" ? "member.deactivated" : "member.updated", {
        memberId: updated.id
      })
    );
    return updated;
  }

  async memberTimeline(actor: RequestActor, memberId: string): Promise<AuditEventResponse[]> {
    await this.getMember(actor, memberId);
    return this.repository.listAuditEvents(scopeOf(actor), memberId);
  }

  async listLeads(actor: RequestActor, filters: LeadListFilters) {
    return this.repository.searchLeads(scopeOf(actor), filters);
  }

  async getLead(actor: RequestActor, leadId: string): Promise<LeadResponse> {
    const lead = await this.repository.findLeadById(scopeOf(actor), leadId);
    if (!lead) throw new DomainError("RESOURCE_NOT_FOUND", "Lead not found.", 404);
    return lead;
  }

  async createLead(
    actor: RequestActor,
    requestId: string,
    input: CreateLeadRequest
  ): Promise<LeadResponse> {
    if (input.branchId && !actor.branchIds.includes(input.branchId)) {
      throw new DomainError(
        "BRANCH_ACCESS_DENIED",
        "You cannot create a lead for this branch.",
        404
      );
    }
    if (
      input.ownerUserId &&
      !(await this.repository.findStaffByUserId(scopeOf(actor), input.ownerUserId))
    ) {
      throw new DomainError("VALIDATION_FAILED", "Lead owner is unavailable.", 400, {
        ownerUserId: ["Unknown tenant staff member."]
      });
    }
    const lead = await this.repository.createLead(
      scopeOf(actor),
      input,
      this.normalizePhoneInput(input.contact.phone)
    );
    await this.audit(actor, requestId, "lead.created", "lead", lead.id, lead.branchId, {
      stage: lead.stage,
      source: lead.source
    });
    await this.publish(eventOf(actor, "lead.created", { leadId: lead.id }));
    return lead;
  }

  async updateLeadStage(
    actor: RequestActor,
    requestId: string,
    leadId: string,
    input: UpdateLeadStageRequest
  ): Promise<LeadResponse> {
    if (input.stage === "lost" && !input.lostReason?.trim()) {
      throw new DomainError("VALIDATION_FAILED", "A lost reason is required.", 400, {
        lostReason: ["Required when marking a lead lost."]
      });
    }
    const existing = await this.getLead(actor, leadId);
    const lead = await this.repository.updateLeadStage(scopeOf(actor), leadId, input, actor.userId);
    if (!lead) throw new DomainError("RESOURCE_NOT_FOUND", "Lead not found.", 404);
    await this.audit(actor, requestId, "lead.stage_changed", "lead", lead.id, lead.branchId, {
      previousStage: existing.stage,
      stage: lead.stage,
      lostReason: lead.lostReason
    });
    await this.publish(
      eventOf(actor, "lead.stage_changed", {
        leadId: lead.id,
        previousStage: existing.stage,
        stage: lead.stage
      })
    );
    return lead;
  }

  async convertLead(
    actor: RequestActor,
    requestId: string,
    leadId: string
  ): Promise<LeadConversionResponse> {
    const result = await this.repository.convertLead(scopeOf(actor), leadId, actor.userId);
    if (!result) throw new DomainError("RESOURCE_NOT_FOUND", "Lead not found.", 404);
    await this.audit(actor, requestId, "lead.converted", "lead", leadId, result.lead.branchId, {
      memberId: result.member.id,
      alreadyConverted: result.alreadyConverted
    });
    await this.publish(eventOf(actor, "lead.converted", { leadId, memberId: result.member.id }));
    return result;
  }

  async addLeadNote(
    actor: RequestActor,
    requestId: string,
    leadId: string,
    body: string
  ): Promise<LeadNoteResponse> {
    const lead = await this.getLead(actor, leadId);
    const note = await this.repository.addLeadNote(scopeOf(actor), leadId, body, actor.userId);
    if (!note) throw new DomainError("RESOURCE_NOT_FOUND", "Lead not found.", 404);
    await this.audit(actor, requestId, "lead.note_added", "lead", leadId, lead.branchId, {
      noteId: note.id
    });
    return note;
  }

  async leadNotes(actor: RequestActor, leadId: string): Promise<LeadNoteResponse[]> {
    await this.getLead(actor, leadId);
    return this.repository.listLeadNotes(scopeOf(actor), leadId);
  }

  async createLeadTask(
    actor: RequestActor,
    requestId: string,
    leadId: string,
    input: CreateLeadTaskRequest
  ): Promise<LeadTaskResponse> {
    const lead = await this.getLead(actor, leadId);
    if (
      input.assigneeUserId &&
      !(await this.repository.findStaffByUserId(scopeOf(actor), input.assigneeUserId))
    ) {
      throw new DomainError("VALIDATION_FAILED", "Task assignee is unavailable.", 400, {
        assigneeUserId: ["Unknown tenant staff member."]
      });
    }
    const task = await this.repository.createLeadTask(scopeOf(actor), leadId, input);
    if (!task) throw new DomainError("RESOURCE_NOT_FOUND", "Lead not found.", 404);
    await this.audit(actor, requestId, "lead.task_created", "lead", leadId, lead.branchId, {
      taskId: task.id,
      dueAt: task.dueAt
    });
    return task;
  }

  async leadTasks(actor: RequestActor, leadId: string): Promise<LeadTaskResponse[]> {
    await this.getLead(actor, leadId);
    return this.repository.listLeadTasks(scopeOf(actor), leadId);
  }

  async listStaff(actor: RequestActor): Promise<StaffUserResponse[]> {
    return this.repository.listStaff(scopeOf(actor));
  }

  async inviteStaff(
    actor: RequestActor,
    requestId: string,
    input: InviteStaffInput
  ): Promise<StaffUserResponse> {
    const role = await this.requireAssignableRole(actor, input.roleId);
    this.assertBranchesAccessible(actor, input.branchIds);
    try {
      const staff = await this.repository.inviteStaff(scopeOf(actor), input);
      await this.audit(actor, requestId, "user.invited", "user", staff.user.id, null, {
        role: role.name,
        branches: input.branchIds
      });
      await this.publish(eventOf(actor, "user.invited", { userId: staff.user.id }));
      return staff;
    } catch (error) {
      if (error instanceof Error && error.message.includes("already")) {
        throw new DomainError("VALIDATION_FAILED", "This person already has staff access.", 409, {
          email: ["Already invited or active."]
        });
      }
      throw error;
    }
  }

  async updateStaffAccess(
    actor: RequestActor,
    requestId: string,
    userId: string,
    input: StaffAccessInput
  ): Promise<StaffUserResponse> {
    const current = await this.repository.findStaffByUserId(scopeOf(actor), userId);
    if (!current) throw new DomainError("RESOURCE_NOT_FOUND", "Staff user not found.", 404);
    const newRole = await this.requireAssignableRole(actor, input.roleId);
    this.assertBranchesAccessible(actor, input.branchIds);
    if (
      current.role.key === "owner" &&
      newRole.key !== "owner" &&
      (await this.repository.countActiveOwners(scopeOf(actor))) <= 1
    ) {
      throw new DomainError(
        "FINAL_ACTIVE_OWNER_REQUIRED",
        "At least one active owner must remain.",
        409
      );
    }
    const updated = await this.repository.updateStaffAccess(scopeOf(actor), userId, {
      roleId: input.roleId,
      branchIds: input.branchIds
    });
    if (!updated) throw new DomainError("RESOURCE_NOT_FOUND", "Staff user not found.", 404);
    await this.audit(actor, requestId, "user.access_changed", "user", userId, null, {
      fromRole: current.role.name,
      toRole: updated.role.name,
      branches: input.branchIds
    });
    await this.publish(eventOf(actor, "user.access_changed", { userId }));
    return updated;
  }

  async deactivateStaff(
    actor: RequestActor,
    requestId: string,
    userId: string
  ): Promise<StaffUserResponse> {
    const current = await this.repository.findStaffByUserId(scopeOf(actor), userId);
    if (!current) throw new DomainError("RESOURCE_NOT_FOUND", "Staff user not found.", 404);
    if (
      current.role.key === "owner" &&
      (await this.repository.countActiveOwners(scopeOf(actor))) <= 1
    ) {
      throw new DomainError(
        "FINAL_ACTIVE_OWNER_REQUIRED",
        "At least one active owner must remain.",
        409
      );
    }
    const updated = await this.repository.deactivateStaff(scopeOf(actor), userId);
    if (!updated) throw new DomainError("RESOURCE_NOT_FOUND", "Staff user not found.", 404);
    await this.audit(actor, requestId, "user.deactivated", "user", userId, null, {
      role: current.role.name
    });
    await this.publish(eventOf(actor, "user.deactivated", { userId }));
    return updated;
  }

  async auditEvents(actor: RequestActor): Promise<AuditEventResponse[]> {
    return this.repository.listAuditEvents(scopeOf(actor));
  }

  private async requireAssignableRole(actor: RequestActor, roleId: string): Promise<RoleResponse> {
    const role = await this.repository.findRoleById(scopeOf(actor), roleId);
    if (!role)
      throw new DomainError("VALIDATION_FAILED", "Role is unavailable.", 400, {
        roleId: ["Unknown role."]
      });
    if (!role.permissions.every((permission) => actor.permissions.includes(permission))) {
      throw new DomainError(
        "FORBIDDEN",
        "You cannot grant a permission that you do not hold.",
        403
      );
    }
    return role;
  }

  private assertBranchesAccessible(actor: RequestActor, branchIds: string[]): void {
    if (!branchIds.length || branchIds.some((branchId) => !actor.branchIds.includes(branchId))) {
      throw new DomainError("BRANCH_ACCESS_DENIED", "One or more branches are unavailable.", 404);
    }
  }

  private normalizePhoneInput(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const normalized = normalizePhone(phone);
    if (!normalized)
      throw new DomainError("VALIDATION_FAILED", "Phone number is invalid.", 400, {
        "contact.phone": ["Enter an E.164 or Kenyan mobile number."]
      });
    return normalized;
  }

  private async audit(
    actor: RequestActor,
    requestId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    branchId: string | null,
    afterSummary: Record<string, unknown>
  ): Promise<void> {
    await this.repository.recordAudit({
      tenantId: actor.tenantId,
      branchId,
      actorUserId: actor.userId,
      action,
      resourceType,
      resourceId,
      afterSummary,
      requestId
    });
  }

  private async publish(event: DomainEvent): Promise<void> {
    await this.repository.publishEvent(event);
  }
}
