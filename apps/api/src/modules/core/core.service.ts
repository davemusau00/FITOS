import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { normalizePhone } from "@fitos/shared";
import {
  ATTENDANCE_TRANSITIONS,
  ACTIVE_MEMBERSHIP_STATUSES,
  BOOKING_ACTIVE_STATUS
} from "@fitos/contracts";
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
  UpdateOrganizationRequest,
  UpdateUserProfileRequest,
  CreateRoomRequest,
  UpdateRoomRequest,
  CreateScheduleOccurrenceRequest,
  CreateScheduleTemplateRequest,
  MaterializeScheduleTemplateRequest,
  OverrideScheduleOccurrenceRequest,
  CreateServiceRequest,
  RoomResponse,
  ScheduleOccurrenceFilters,
  ScheduleOccurrenceResponse,
  ScheduleTemplateResponse,
  ScheduleTemplateMutationResponse,
  ServiceResponse,
  UpdateServiceRequest,
  BookingListFilters,
  BookingResponse,
  CreateBookingRequest,
  MembershipPlanResponse,
  CreateMembershipPlanRequest,
  MemberMembershipResponse,
  ActivateMembershipRequest,
  CreditLedgerEntryResponse,
  ManualCreditAdjustmentRequest,
  PaymentTransactionResponse,
  CreatePaymentRequest,
  PaymentListFilters,
  PaymentAllocationType,
  ReconcilePaymentRequest,
  AttendanceRecordResponse,
  CheckInRequest,
  UpdateRosterStatusRequest,
  AttendanceListFilters
} from "@fitos/contracts";
import { DomainError } from "../../common/errors/domain-error.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type {
  FitosRepository,
  InviteStaffInput,
  StaffAccessInput,
  TenantScope
} from "../../ports/fitos-repository.js";
import {
  assertBoundedWindow,
  assertIanaTimezone,
  assertLocalDate,
  clampMaterializationDate,
  defaultMaterializationDate,
  generateWeeklyOccurrences,
  nextDate
} from "../schedule/recurrence.js";

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

  async completeLeadTask(
    actor: RequestActor,
    requestId: string,
    leadId: string,
    taskId: string
  ): Promise<LeadTaskResponse> {
    const lead = await this.getLead(actor, leadId);
    const task = await this.repository.completeLeadTask(scopeOf(actor), leadId, taskId);
    if (!task) throw new DomainError("RESOURCE_NOT_FOUND", "Lead task not found.", 404);
    await this.audit(actor, requestId, "lead.task_completed", "lead", leadId, lead.branchId, {
      taskId
    });
    return task;
  }

  async listServices(actor: RequestActor): Promise<ServiceResponse[]> {
    return this.repository.listServices(scopeOf(actor));
  }

  async getService(actor: RequestActor, serviceId: string): Promise<ServiceResponse> {
    const service = await this.repository.findServiceById(scopeOf(actor), serviceId);
    if (!service) throw new DomainError("RESOURCE_NOT_FOUND", "Service not found.", 404);
    return service;
  }

  async createService(
    actor: RequestActor,
    requestId: string,
    input: CreateServiceRequest
  ): Promise<ServiceResponse> {
    if (input.branchId && !actor.branchIds.includes(input.branchId)) {
      throw new DomainError("BRANCH_ACCESS_DENIED", "Branch is unavailable.", 404);
    }
    try {
      const service = await this.repository.createService(scopeOf(actor), input);
      await this.audit(
        actor,
        requestId,
        "service.created",
        "service",
        service.id,
        service.branchId,
        {
          name: service.name,
          type: service.serviceType
        }
      );
      await this.publish(eventOf(actor, "service.created", { serviceId: service.id }));
      return service;
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("slug")) {
        throw new DomainError("VALIDATION_FAILED", "A service with that slug already exists.", 409);
      }
      throw error;
    }
  }

  async updateService(
    actor: RequestActor,
    requestId: string,
    serviceId: string,
    input: UpdateServiceRequest
  ): Promise<ServiceResponse> {
    await this.getService(actor, serviceId);
    try {
      const service = await this.repository.updateService(scopeOf(actor), serviceId, input);
      if (!service) throw new DomainError("RESOURCE_NOT_FOUND", "Service not found.", 404);
      await this.audit(
        actor,
        requestId,
        "service.updated",
        "service",
        service.id,
        service.branchId,
        {
          changed: Object.keys(input)
        }
      );
      await this.publish(eventOf(actor, "service.updated", { serviceId: service.id }));
      return service;
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("slug")) {
        throw new DomainError("VALIDATION_FAILED", "A service with that slug already exists.", 409);
      }
      throw error;
    }
  }

  async listRooms(actor: RequestActor, branchId?: string): Promise<RoomResponse[]> {
    if (branchId && !actor.branchIds.includes(branchId)) return [];
    return this.repository.listRooms(scopeOf(actor), branchId);
  }

  async getRoom(actor: RequestActor, roomId: string): Promise<RoomResponse> {
    const room = await this.repository.findRoomById(scopeOf(actor), roomId);
    if (!room) throw new DomainError("RESOURCE_NOT_FOUND", "Room not found.", 404);
    return room;
  }

  async createRoom(
    actor: RequestActor,
    requestId: string,
    input: CreateRoomRequest
  ): Promise<RoomResponse> {
    if (!actor.branchIds.includes(input.branchId)) {
      throw new DomainError("BRANCH_ACCESS_DENIED", "Branch is unavailable.", 404);
    }
    try {
      const room = await this.repository.createRoom(scopeOf(actor), input);
      await this.audit(actor, requestId, "room.created", "room", room.id, room.branchId, {
        name: room.name
      });
      return room;
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("room")) {
        throw new DomainError("VALIDATION_FAILED", "A room with that name already exists.", 409);
      }
      throw error;
    }
  }

  async updateRoom(
    actor: RequestActor,
    requestId: string,
    roomId: string,
    input: UpdateRoomRequest
  ): Promise<RoomResponse> {
    const current = await this.getRoom(actor, roomId);
    try {
      const room = await this.repository.updateRoom(scopeOf(actor), roomId, input);
      if (!room) throw new DomainError("RESOURCE_NOT_FOUND", "Room not found.", 404);
      await this.audit(actor, requestId, "room.updated", "room", room.id, room.branchId, {
        changed: Object.keys(input),
        previousName: current.name
      });
      return room;
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("room")) {
        throw new DomainError("VALIDATION_FAILED", "A room with that name already exists.", 409);
      }
      throw error;
    }
  }

  async listScheduleTemplates(actor: RequestActor, branchId?: string) {
    if (branchId && !actor.branchIds.includes(branchId)) return [];
    return this.repository.listScheduleTemplates(scopeOf(actor), branchId);
  }

  async getScheduleTemplate(
    actor: RequestActor,
    templateId: string
  ): Promise<ScheduleTemplateResponse> {
    const template = await this.repository.findScheduleTemplateById(scopeOf(actor), templateId);
    if (!template) throw new DomainError("RESOURCE_NOT_FOUND", "Schedule template not found.", 404);
    return template;
  }

  async createScheduleTemplate(
    actor: RequestActor,
    requestId: string,
    input: CreateScheduleTemplateRequest
  ): Promise<ScheduleTemplateMutationResponse> {
    await this.assertScheduleResourceAccess(actor, input);
    try {
      assertIanaTimezone(input.timezone);
      assertLocalDate(input.effectiveStartDate);
      if (input.effectiveEndDate) {
        assertLocalDate(input.effectiveEndDate);
        if (input.effectiveEndDate < input.effectiveStartDate) {
          throw new Error("Effective end must not precede effective start.");
        }
      }
      const requestedThrough =
        input.materializeThroughDate ?? defaultMaterializationDate(input.effectiveStartDate);
      assertLocalDate(requestedThrough);
      const throughDate = clampMaterializationDate(requestedThrough, input.effectiveEndDate);
      assertBoundedWindow(input.effectiveStartDate, throughDate);
      const occurrences = generateWeeklyOccurrences(input, input.effectiveStartDate, throughDate);
      const result = await this.repository.createScheduleTemplate(
        scopeOf(actor),
        input,
        occurrences,
        throughDate
      );
      await this.audit(
        actor,
        requestId,
        "schedule.template_created",
        "schedule_template",
        result.template.id,
        result.template.branchId,
        {
          serviceId: result.template.serviceId,
          daysOfWeek: result.template.daysOfWeek,
          timezone: result.template.timezone,
          materializedThrough: result.template.materializedThrough,
          occurrencesCreated: result.occurrences.length
        }
      );
      await this.publish(
        eventOf(actor, "schedule.template_created", {
          templateId: result.template.id,
          occurrencesCreated: result.occurrences.length
        })
      );
      return result;
    } catch (error) {
      throw this.scheduleError(error);
    }
  }

  async materializeScheduleTemplate(
    actor: RequestActor,
    requestId: string,
    templateId: string,
    input: MaterializeScheduleTemplateRequest
  ): Promise<ScheduleTemplateMutationResponse> {
    const template = await this.getScheduleTemplate(actor, templateId);
    if (!template.isActive) {
      throw new DomainError("VALIDATION_FAILED", "Schedule template is inactive.", 409);
    }
    try {
      assertLocalDate(input.throughDate);
      const throughDate = clampMaterializationDate(input.throughDate, template.effectiveEndDate);
      const fromDate = template.materializedThrough
        ? nextDate(template.materializedThrough)
        : template.effectiveStartDate;
      if (throughDate < fromDate) return { template, occurrences: [] };
      assertBoundedWindow(fromDate, throughDate);
      const occurrences = generateWeeklyOccurrences(template, fromDate, throughDate);
      const result = await this.repository.materializeScheduleTemplate(
        scopeOf(actor),
        template.id,
        occurrences,
        throughDate
      );
      if (!result) throw new DomainError("RESOURCE_NOT_FOUND", "Schedule template not found.", 404);
      await this.audit(
        actor,
        requestId,
        "schedule.template_materialized",
        "schedule_template",
        template.id,
        template.branchId,
        { throughDate, occurrencesCreated: result.occurrences.length }
      );
      return result;
    } catch (error) {
      throw this.scheduleError(error);
    }
  }

  async listScheduleOccurrences(actor: RequestActor, filters: ScheduleOccurrenceFilters) {
    if (filters.branchId && !actor.branchIds.includes(filters.branchId)) {
      return { data: [], page: { hasMore: false, nextCursor: null } };
    }
    return this.repository.listScheduleOccurrences(scopeOf(actor), filters);
  }

  async getScheduleOccurrence(
    actor: RequestActor,
    occurrenceId: string
  ): Promise<ScheduleOccurrenceResponse> {
    const occurrence = await this.repository.findScheduleOccurrenceById(
      scopeOf(actor),
      occurrenceId
    );
    if (!occurrence)
      throw new DomainError("RESOURCE_NOT_FOUND", "Schedule occurrence not found.", 404);
    return occurrence;
  }

  async createScheduleOccurrence(
    actor: RequestActor,
    requestId: string,
    input: CreateScheduleOccurrenceRequest
  ): Promise<ScheduleOccurrenceResponse> {
    if (!actor.branchIds.includes(input.branchId)) {
      throw new DomainError("BRANCH_ACCESS_DENIED", "Branch is unavailable.", 404);
    }
    const service = await this.getService(actor, input.serviceId);
    if (service.branchId && service.branchId !== input.branchId) {
      throw new DomainError("VALIDATION_FAILED", "Service is not offered by this branch.", 400);
    }
    if (input.roomId) {
      const room = await this.repository.findRoomById(scopeOf(actor), input.roomId);
      if (!room || room.branchId !== input.branchId || !room.isActive) {
        throw new DomainError("VALIDATION_FAILED", "Room is unavailable.", 400);
      }
    }
    if (input.trainerUserId) {
      const trainer = await this.repository.findStaffByUserId(scopeOf(actor), input.trainerUserId);
      if (!trainer || !trainer.branches.some((branch) => branch.id === input.branchId)) {
        throw new DomainError("VALIDATION_FAILED", "Trainer is unavailable for this branch.", 400);
      }
    }
    try {
      const occurrence = await this.repository.createScheduleOccurrence(scopeOf(actor), input);
      await this.audit(
        actor,
        requestId,
        "schedule.occurrence_created",
        "schedule_occurrence",
        occurrence.id,
        occurrence.branchId,
        {
          serviceId: occurrence.serviceId,
          startsAt: occurrence.startsAt,
          roomId: occurrence.roomId,
          trainerUserId: occurrence.trainerUserId
        }
      );
      await this.publish(
        eventOf(actor, "schedule.occurrence_created", { occurrenceId: occurrence.id })
      );
      return occurrence;
    } catch (error) {
      if (error instanceof Error && /conflict|exclusion|collision/i.test(error.message)) {
        throw new DomainError(
          "VALIDATION_FAILED",
          "Trainer or room has a conflicting occurrence.",
          409
        );
      }
      throw error;
    }
  }

  async cancelScheduleOccurrence(
    actor: RequestActor,
    requestId: string,
    occurrenceId: string,
    reason: string
  ): Promise<ScheduleOccurrenceResponse> {
    const existing = await this.getScheduleOccurrence(actor, occurrenceId);
    if (existing.status === "cancelled") return existing;
    if (new Date(existing.startsAt).getTime() <= Date.now()) {
      throw new DomainError(
        "VALIDATION_FAILED",
        "Historical schedule occurrences cannot be cancelled.",
        409
      );
    }
    const occurrence = await this.repository.cancelScheduleOccurrence(
      scopeOf(actor),
      occurrenceId,
      reason,
      actor.userId
    );
    if (!occurrence)
      throw new DomainError("RESOURCE_NOT_FOUND", "Schedule occurrence not found.", 404);
    await this.audit(
      actor,
      requestId,
      "schedule.occurrence_cancelled",
      "schedule_occurrence",
      occurrence.id,
      occurrence.branchId,
      {
        reason
      }
    );
    await this.publish(
      eventOf(actor, "schedule.occurrence_cancelled", { occurrenceId: occurrence.id })
    );
    return occurrence;
  }

  async overrideScheduleOccurrence(
    actor: RequestActor,
    requestId: string,
    occurrenceId: string,
    input: OverrideScheduleOccurrenceRequest
  ): Promise<ScheduleOccurrenceResponse> {
    const existing = await this.getScheduleOccurrence(actor, occurrenceId);
    if (!existing.templateId) {
      throw new DomainError(
        "VALIDATION_FAILED",
        "Only an occurrence from a recurring template can have a one-off override.",
        409
      );
    }
    if (existing.status !== "scheduled" || new Date(existing.startsAt).getTime() <= Date.now()) {
      throw new DomainError(
        "VALIDATION_FAILED",
        "Only a future scheduled occurrence can be overridden.",
        409
      );
    }
    await this.assertScheduleResourceAccess(actor, {
      branchId: existing.branchId,
      serviceId: existing.serviceId,
      trainerUserId:
        input.trainerUserId === undefined ? existing.trainerUserId : input.trainerUserId,
      roomId: input.roomId === undefined ? existing.roomId : input.roomId
    });
    const startsAt = input.startsAt ?? existing.startsAt;
    const endsAt = input.endsAt ?? existing.endsAt;
    if (new Date(startsAt).getTime() <= Date.now() || new Date(endsAt) <= new Date(startsAt)) {
      throw new DomainError(
        "VALIDATION_FAILED",
        "The override must retain a valid future time range.",
        400
      );
    }
    try {
      const occurrence = await this.repository.overrideScheduleOccurrence(
        scopeOf(actor),
        occurrenceId,
        input,
        actor.userId
      );
      if (!occurrence)
        throw new DomainError("RESOURCE_NOT_FOUND", "Schedule occurrence not found.", 404);
      await this.audit(
        actor,
        requestId,
        "schedule.occurrence_overridden",
        "schedule_occurrence",
        occurrence.id,
        occurrence.branchId,
        {
          reason: input.reason,
          previousStartsAt: existing.startsAt,
          startsAt: occurrence.startsAt,
          roomId: occurrence.roomId,
          trainerUserId: occurrence.trainerUserId,
          capacity: occurrence.capacity
        }
      );
      return occurrence;
    } catch (error) {
      throw this.scheduleError(error);
    }
  }

  async listBookings(actor: RequestActor, filters: BookingListFilters) {
    return this.repository.listBookings(scopeOf(actor), filters);
  }

  async getBooking(actor: RequestActor, bookingId: string): Promise<BookingResponse> {
    const booking = await this.repository.findBookingById(scopeOf(actor), bookingId);
    if (!booking) throw new DomainError("RESOURCE_NOT_FOUND", "Booking not found.", 404);
    return booking;
  }

  async createBooking(
    actor: RequestActor,
    requestId: string,
    input: CreateBookingRequest
  ): Promise<BookingResponse> {
    const occurrence = await this.getScheduleOccurrence(actor, input.occurrenceId);
    if (occurrence.status !== "scheduled") {
      throw new DomainError(
        "VALIDATION_FAILED",
        "This occurrence is not available for booking.",
        409
      );
    }
    await this.getMember(actor, input.memberId);
    const allowEntitlementOverride = Boolean(input.overrideReason);
    if (allowEntitlementOverride && !actor.permissions.includes("booking:override")) {
      throw new DomainError("FORBIDDEN", "You cannot override booking entitlement rules.", 403);
    }
    try {
      const booking = await this.repository.createBooking(
        scopeOf(actor),
        input,
        actor.userId,
        allowEntitlementOverride
      );
      await this.audit(
        actor,
        requestId,
        "booking.created",
        "booking",
        booking.id,
        booking.branchId,
        {
          occurrenceId: booking.occurrenceId,
          memberId: booking.memberId,
          source: booking.source,
          creditsDebited: booking.creditsDebited,
          entitlementOverridden: Boolean(booking.entitlementOverrideReason)
        }
      );
      await this.publish(eventOf(actor, "booking.created", { bookingId: booking.id }));
      return booking;
    } catch (error) {
      if (
        error instanceof Error &&
        /full|already has a booking|insufficient credits/i.test(error.message)
      ) {
        throw new DomainError("VALIDATION_FAILED", error.message, 409);
      }
      if (error instanceof Error && /unavailable/i.test(error.message)) {
        throw new DomainError("VALIDATION_FAILED", error.message, 400);
      }
      throw error;
    }
  }

  async cancelBooking(
    actor: RequestActor,
    requestId: string,
    bookingId: string,
    reason: string
  ): Promise<BookingResponse> {
    const existing = await this.getBooking(actor, bookingId);
    if (existing.status === "cancelled") return existing;
    const booking = await this.repository.cancelBooking(scopeOf(actor), bookingId, reason);
    if (!booking) throw new DomainError("RESOURCE_NOT_FOUND", "Booking not found.", 404);
    await this.audit(
      actor,
      requestId,
      "booking.cancelled",
      "booking",
      booking.id,
      booking.branchId,
      {
        occurrenceId: booking.occurrenceId,
        reason
      }
    );
    await this.publish(eventOf(actor, "booking.cancelled", { bookingId: booking.id }));
    return booking;
  }

  async listMembershipPlans(
    actor: RequestActor,
    branchId?: string
  ): Promise<MembershipPlanResponse[]> {
    if (branchId) this.assertBranchesAccessible(actor, [branchId]);
    return this.repository.listMembershipPlans(scopeOf(actor), branchId);
  }

  async getMembershipPlan(actor: RequestActor, planId: string): Promise<MembershipPlanResponse> {
    const plan = await this.repository.findMembershipPlanById(scopeOf(actor), planId);
    if (!plan) throw new DomainError("RESOURCE_NOT_FOUND", "Membership plan not found.", 404);
    return plan;
  }

  async createMembershipPlan(
    actor: RequestActor,
    requestId: string,
    input: CreateMembershipPlanRequest
  ): Promise<MembershipPlanResponse> {
    if (input.branchId) this.assertBranchesAccessible(actor, [input.branchId]);
    const plan = await this.repository.createMembershipPlan(scopeOf(actor), input);
    await this.audit(
      actor,
      requestId,
      "membership_plan.created",
      "membership_plan",
      plan.id,
      plan.branchId,
      {
        name: plan.name,
        includedCredits: plan.includedCredits
      }
    );
    await this.publish(eventOf(actor, "membership_plan.created", { planId: plan.id }));
    return plan;
  }

  async updateMembershipPlan(
    actor: RequestActor,
    requestId: string,
    planId: string,
    input: Partial<CreateMembershipPlanRequest> & { isActive?: boolean }
  ): Promise<MembershipPlanResponse> {
    await this.getMembershipPlan(actor, planId);
    if (input.branchId) this.assertBranchesAccessible(actor, [input.branchId]);
    const updated = await this.repository.updateMembershipPlan(scopeOf(actor), planId, input);
    if (!updated) throw new DomainError("RESOURCE_NOT_FOUND", "Membership plan not found.", 404);
    await this.audit(
      actor,
      requestId,
      "membership_plan.updated",
      "membership_plan",
      updated.id,
      updated.branchId,
      { name: updated.name }
    );
    await this.publish(eventOf(actor, "membership_plan.updated", { planId: updated.id }));
    return updated;
  }

  async listMemberMemberships(
    actor: RequestActor,
    memberId: string
  ): Promise<MemberMembershipResponse[]> {
    await this.getMember(actor, memberId);
    return this.repository.listMemberMemberships(scopeOf(actor), memberId);
  }

  async activateMembership(
    actor: RequestActor,
    requestId: string,
    input: ActivateMembershipRequest
  ): Promise<{ membership: MemberMembershipResponse; ledgerEntry: CreditLedgerEntryResponse }> {
    await this.getMember(actor, input.memberId);
    const plan = await this.getMembershipPlan(actor, input.planId);
    const result = await this.repository.activateMembership(scopeOf(actor), input, actor.userId);
    await this.audit(
      actor,
      requestId,
      "membership.activated",
      "member_membership",
      result.membership.id,
      plan.branchId,
      {
        memberId: input.memberId,
        planName: plan.name,
        includedCredits: plan.includedCredits
      }
    );
    await this.publish(
      eventOf(actor, "membership.activated", {
        membershipId: result.membership.id,
        memberId: input.memberId
      })
    );
    return result;
  }

  async cancelMembership(
    actor: RequestActor,
    requestId: string,
    membershipId: string,
    reason?: string
  ): Promise<MemberMembershipResponse> {
    const membership = await this.repository.cancelMembership(scopeOf(actor), membershipId, reason);
    if (!membership) throw new DomainError("RESOURCE_NOT_FOUND", "Membership not found.", 404);
    await this.audit(
      actor,
      requestId,
      "membership.cancelled",
      "member_membership",
      membership.id,
      null,
      {
        memberId: membership.memberId,
        reason
      }
    );
    await this.publish(
      eventOf(actor, "membership.cancelled", {
        membershipId: membership.id,
        memberId: membership.memberId
      })
    );
    return membership;
  }

  async holdMembership(
    actor: RequestActor,
    requestId: string,
    membershipId: string
  ): Promise<MemberMembershipResponse> {
    const membership = await this.repository.holdMembership(scopeOf(actor), membershipId);
    if (!membership)
      throw new DomainError("RESOURCE_NOT_FOUND", "Active membership not found.", 404);
    await this.audit(
      actor,
      requestId,
      "membership.paused",
      "member_membership",
      membership.id,
      null,
      { memberId: membership.memberId }
    );
    return membership;
  }

  async resumeMembership(
    actor: RequestActor,
    requestId: string,
    membershipId: string
  ): Promise<MemberMembershipResponse> {
    const membership = await this.repository.resumeMembership(scopeOf(actor), membershipId);
    if (!membership)
      throw new DomainError("RESOURCE_NOT_FOUND", "Paused membership not found.", 404);
    await this.audit(
      actor,
      requestId,
      "membership.resumed",
      "member_membership",
      membership.id,
      null,
      { memberId: membership.memberId }
    );
    return membership;
  }

  async renewMembership(actor: RequestActor, requestId: string, membershipId: string) {
    const result = await this.repository.renewMembership(
      scopeOf(actor),
      membershipId,
      actor.userId
    );
    if (!result) throw new DomainError("RESOURCE_NOT_FOUND", "Membership cannot be renewed.", 404);
    await this.audit(
      actor,
      requestId,
      "membership.renewed",
      "member_membership",
      result.membership.id,
      null,
      {
        memberId: result.membership.memberId,
        credits: result.ledgerEntry.delta
      }
    );
    await this.publish(
      eventOf(actor, "membership.renewed", {
        membershipId: result.membership.id,
        memberId: result.membership.memberId
      })
    );
    return result;
  }

  async listCreditLedger(
    actor: RequestActor,
    memberId: string
  ): Promise<CreditLedgerEntryResponse[]> {
    await this.getMember(actor, memberId);
    return this.repository.listCreditLedger(scopeOf(actor), memberId);
  }

  async getCreditBalance(actor: RequestActor, memberId: string): Promise<{ balance: number }> {
    await this.getMember(actor, memberId);
    const balance = await this.repository.getCreditBalance(scopeOf(actor), memberId);
    return { balance };
  }

  async adjustCredit(
    actor: RequestActor,
    requestId: string,
    memberId: string,
    input: ManualCreditAdjustmentRequest
  ): Promise<CreditLedgerEntryResponse> {
    await this.getMember(actor, memberId);
    const membership = await this.repository.findMemberMembershipById(
      scopeOf(actor),
      input.membershipId
    );
    if (!membership || membership.memberId !== memberId) {
      throw new DomainError("RESOURCE_NOT_FOUND", "Membership not found.", 404);
    }
    let entry: CreditLedgerEntryResponse;
    try {
      entry = await this.repository.adjustCredit(scopeOf(actor), memberId, input, actor.userId);
    } catch (error) {
      if (error instanceof Error && /balance|membership|adjustment/i.test(error.message)) {
        throw new DomainError("VALIDATION_FAILED", error.message, 409);
      }
      throw error;
    }
    await this.audit(
      actor,
      requestId,
      "credit.adjusted",
      "member_membership",
      membership.id,
      membership.planSnapshot.branchId,
      { memberId, delta: entry.delta, reason: input.reason }
    );
    await this.publish(
      eventOf(actor, "credit.adjusted", {
        membershipId: membership.id,
        memberId,
        delta: entry.delta
      })
    );
    return entry;
  }

  async listPayments(
    actor: RequestActor,
    filters: PaymentListFilters
  ): Promise<CursorPage<PaymentTransactionResponse>> {
    if (filters.branchId) this.assertBranchesAccessible(actor, [filters.branchId]);
    return this.repository.listPayments(scopeOf(actor), filters);
  }

  async getPayment(actor: RequestActor, paymentId: string): Promise<PaymentTransactionResponse> {
    const payment = await this.repository.findPaymentById(scopeOf(actor), paymentId);
    if (!payment) throw new DomainError("RESOURCE_NOT_FOUND", "Payment not found.", 404);
    return payment;
  }

  async createPayment(
    actor: RequestActor,
    requestId: string,
    input: CreatePaymentRequest
  ): Promise<PaymentTransactionResponse> {
    this.assertBranchesAccessible(actor, [input.branchId]);
    await this.assertPaymentAllocation(
      actor,
      input.branchId,
      input.memberId ?? null,
      input.allocationType ?? null,
      input.allocationId ?? null
    );
    let payment: PaymentTransactionResponse;
    try {
      payment = await this.repository.createPayment(scopeOf(actor), input, actor.userId);
    } catch (error) {
      if (
        error instanceof Error &&
        /amount|currency|allocation|member|booking|membership/i.test(error.message)
      ) {
        throw new DomainError("VALIDATION_FAILED", error.message, 400);
      }
      throw error;
    }
    await this.audit(
      actor,
      requestId,
      "payment.recorded",
      "payment_transaction",
      payment.id,
      payment.branchId,
      {
        amountMinor: payment.amount.amountMinor,
        currency: payment.amount.currency,
        method: payment.method,
        memberId: payment.memberId,
        allocationType: payment.allocationType
      }
    );
    await this.publish(eventOf(actor, "payment.recorded", { paymentId: payment.id }));
    return payment;
  }

  async voidPayment(
    actor: RequestActor,
    requestId: string,
    paymentId: string,
    reason: string
  ): Promise<PaymentTransactionResponse> {
    const existing = await this.getPayment(actor, paymentId);
    if (existing.status === "voided") return existing;
    if (existing.status !== "completed") {
      throw new DomainError(
        "VALIDATION_FAILED",
        `A ${existing.status} payment cannot be voided.`,
        409
      );
    }
    const payment = await this.repository.voidPayment(scopeOf(actor), paymentId, reason);
    if (!payment) {
      throw new DomainError("VALIDATION_FAILED", "Payment status changed; refresh and retry.", 409);
    }
    await this.audit(
      actor,
      requestId,
      "payment.voided",
      "payment_transaction",
      payment.id,
      payment.branchId,
      { reason }
    );
    await this.publish(eventOf(actor, "payment.voided", { paymentId: payment.id }));
    return payment;
  }

  async reconcilePayment(
    actor: RequestActor,
    requestId: string,
    paymentId: string,
    input: ReconcilePaymentRequest
  ): Promise<PaymentTransactionResponse> {
    const existing = await this.getPayment(actor, paymentId);
    if (existing.status !== "completed") {
      throw new DomainError(
        "VALIDATION_FAILED",
        `A ${existing.status} payment cannot be reconciled.`,
        409
      );
    }
    await this.assertPaymentAllocation(
      actor,
      existing.branchId,
      input.memberId,
      input.allocationType,
      input.allocationId ?? null
    );
    let payment: PaymentTransactionResponse | null;
    try {
      payment = await this.repository.reconcilePayment(scopeOf(actor), paymentId, input);
    } catch (error) {
      if (
        error instanceof Error &&
        /already|allocation|member|booking|membership/i.test(error.message)
      ) {
        throw new DomainError("VALIDATION_FAILED", error.message, 409);
      }
      throw error;
    }
    if (!payment) throw new DomainError("RESOURCE_NOT_FOUND", "Payment not found.", 404);
    await this.audit(
      actor,
      requestId,
      "payment.reconciled",
      "payment_transaction",
      payment.id,
      payment.branchId,
      {
        memberId: payment.memberId,
        allocationType: payment.allocationType,
        allocationId: payment.allocationId,
        reason: input.reason
      }
    );
    await this.publish(eventOf(actor, "payment.reconciled", { paymentId: payment.id }));
    return payment;
  }

  async refundPayment(
    actor: RequestActor,
    requestId: string,
    paymentId: string,
    reason: string
  ): Promise<PaymentTransactionResponse> {
    const existing = await this.getPayment(actor, paymentId);
    if (existing.status === "refunded") return existing;
    if (existing.status !== "completed") {
      throw new DomainError(
        "VALIDATION_FAILED",
        `A ${existing.status} payment cannot be refunded.`,
        409
      );
    }
    const payment = await this.repository.refundPayment(scopeOf(actor), paymentId, reason);
    if (!payment) {
      throw new DomainError("VALIDATION_FAILED", "Payment status changed; refresh and retry.", 409);
    }
    await this.audit(
      actor,
      requestId,
      "payment.refunded",
      "payment_transaction",
      payment.id,
      payment.branchId,
      {
        amountMinor: payment.amount.amountMinor,
        currency: payment.amount.currency,
        reason
      }
    );
    await this.publish(eventOf(actor, "payment.refunded", { paymentId: payment.id }));
    return payment;
  }

  async listAttendanceRecords(
    actor: RequestActor,
    filters: AttendanceListFilters
  ): Promise<CursorPage<AttendanceRecordResponse>> {
    if (filters.branchId) this.assertBranchesAccessible(actor, [filters.branchId]);
    return this.repository.listAttendanceRecords(scopeOf(actor), filters);
  }

  async getAttendanceRecord(
    actor: RequestActor,
    recordId: string
  ): Promise<AttendanceRecordResponse> {
    const record = await this.repository.findAttendanceRecord(scopeOf(actor), recordId);
    if (!record) throw new DomainError("RESOURCE_NOT_FOUND", "Attendance record not found.", 404);
    return record;
  }

  async checkIn(
    actor: RequestActor,
    requestId: string,
    branchId: string,
    input: CheckInRequest
  ): Promise<AttendanceRecordResponse> {
    this.assertBranchesAccessible(actor, [branchId]);
    await this.getMember(actor, input.memberId);
    const allowOverride = Boolean(input.overrideReason);
    if (allowOverride && !actor.permissions.includes("attendance:override")) {
      throw new DomainError("FORBIDDEN", "You cannot override attendance policy.", 403);
    }
    let record: AttendanceRecordResponse;
    try {
      record = await this.repository.checkIn(
        scopeOf(actor),
        input,
        actor.userId,
        branchId,
        allowOverride
      );
    } catch (error) {
      if (
        error instanceof Error &&
        /booking|membership|entitlement|occurrence|already/i.test(error.message)
      ) {
        throw new DomainError("VALIDATION_FAILED", error.message, 409);
      }
      throw error;
    }
    await this.audit(
      actor,
      requestId,
      "attendance.checked_in",
      "attendance_record",
      record.id,
      record.branchId,
      {
        memberId: record.memberId,
        occurrenceId: record.occurrenceId,
        status: record.status,
        overridden: allowOverride,
        overrideReason: record.overrideReason
      }
    );
    await this.publish(eventOf(actor, "attendance.checked_in", { attendanceId: record.id }));
    return record;
  }

  async updateAttendanceStatus(
    actor: RequestActor,
    requestId: string,
    recordId: string,
    input: UpdateRosterStatusRequest
  ): Promise<AttendanceRecordResponse> {
    const existing = await this.getAttendanceRecord(actor, recordId);
    if (existing.status === input.status) return existing;
    const normalTransition = ATTENDANCE_TRANSITIONS[existing.status].includes(input.status);
    const allowOverride = !normalTransition && Boolean(input.overrideReason);
    if (!normalTransition && !allowOverride) {
      throw new DomainError(
        "VALIDATION_FAILED",
        `Attendance cannot move from ${existing.status} to ${input.status} without an override reason.`,
        409
      );
    }
    if (allowOverride && !actor.permissions.includes("attendance:override")) {
      throw new DomainError("FORBIDDEN", "You cannot override attendance status rules.", 403);
    }
    const record = await this.repository.updateAttendanceStatus(
      scopeOf(actor),
      recordId,
      input,
      allowOverride
    );
    if (!record) throw new DomainError("RESOURCE_NOT_FOUND", "Attendance record not found.", 404);
    await this.audit(
      actor,
      requestId,
      "attendance.status_updated",
      "attendance_record",
      record.id,
      record.branchId,
      {
        status: record.status,
        previousStatus: existing.status,
        overridden: allowOverride,
        overrideReason: record.overrideReason
      }
    );
    await this.publish(eventOf(actor, "attendance.status_updated", { attendanceId: record.id }));
    return record;
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
    const roleIds = input.roleIds ?? (input.roleId ? [input.roleId] : []);
    if (!roleIds.length)
      throw new DomainError("VALIDATION_FAILED", "At least one role is required.", 400);
    const assignedRoles = await Promise.all(
      roleIds.map((roleId) => this.requireAssignableRole(actor, roleId))
    );
    const newRole = assignedRoles[0]!;
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
      roleId: newRole.id,
      roleIds,
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

  async listRoles(actor: RequestActor): Promise<RoleResponse[]> {
    return this.repository.listRoles(scopeOf(actor));
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

  async updateUserProfile(actor: RequestActor, requestId: string, input: UpdateUserProfileRequest) {
    const before = (await this.repository.findUserById(actor.userId))?.displayName ?? null;
    const updated = await this.repository.updateUserProfile(actor.userId, {
      ...input,
      ...(input.phone !== undefined
        ? { phone: input.phone ? normalizePhone(input.phone) : null }
        : {})
    });
    if (!updated) throw new DomainError("RESOURCE_NOT_FOUND", "User profile not found.", 404);
    await this.audit(actor, requestId, "user.profile_updated", "user", actor.userId, null, {
      previousDisplayName: before,
      displayName: updated.displayName
    });
    return updated;
  }

  async notificationPreferences(actor: RequestActor) {
    return this.repository.getNotificationPreferences(actor.userId);
  }

  async updateNotificationPreferences(
    actor: RequestActor,
    requestId: string,
    input: import("@fitos/contracts").UpdateNotificationPreferencesRequest
  ) {
    const updated = await this.repository.updateNotificationPreferences(actor.userId, input);
    if (!updated) throw new DomainError("RESOURCE_NOT_FOUND", "User not found.", 404);
    await this.audit(
      actor,
      requestId,
      "user.notification_preferences_updated",
      "user",
      actor.userId,
      null,
      updated as unknown as Record<string, unknown>
    );
    return updated;
  }

  async createAccountExportRequest(actor: RequestActor, requestId: string) {
    const request = await this.repository.createAccountExportRequest(scopeOf(actor), actor.userId);
    await this.audit(
      actor,
      requestId,
      "account.export_requested",
      "account_export_request",
      request.id,
      null,
      { status: request.status, format: request.format }
    );
    return request;
  }

  async listAccountExportRequests(actor: RequestActor) {
    return this.repository.listAccountExportRequests(scopeOf(actor));
  }

  async createPlanChangeRequest(
    actor: RequestActor,
    requestId: string,
    requestedPlan: import("@fitos/contracts").SaaSPlan
  ) {
    const request = await this.repository.createPlanChangeRequest(
      scopeOf(actor),
      actor.userId,
      requestedPlan
    );
    await this.audit(
      actor,
      requestId,
      "account.plan_change_requested",
      "plan_change_request",
      request.id,
      null,
      {
        requestedPlan: request.requestedPlan,
        status: request.status
      }
    );
    return request;
  }

  async listPlanChangeRequests(actor: RequestActor) {
    return this.repository.listPlanChangeRequests(scopeOf(actor));
  }

  async createAccountCancellationRequest(actor: RequestActor, requestId: string, reason?: string) {
    const request = await this.repository.createAccountCancellationRequest(
      scopeOf(actor),
      actor.userId,
      reason
    );
    await this.audit(
      actor,
      requestId,
      "account.cancellation_requested",
      "account_cancellation_request",
      request.id,
      null,
      { status: request.status, reason: request.reason }
    );
    return request;
  }

  async listAccountCancellationRequests(actor: RequestActor) {
    return this.repository.listAccountCancellationRequests(scopeOf(actor));
  }
  async createAccountDeletionRequest(
    actor: RequestActor,
    requestId: string,
    confirmation: string,
    reason?: string
  ) {
    const request = await this.repository.createAccountDeletionRequest(
      scopeOf(actor),
      actor.userId,
      confirmation,
      reason
    );
    await this.audit(
      actor,
      requestId,
      "account.deletion_requested",
      "account_deletion_request",
      request.id,
      null,
      { status: request.status }
    );
    return request;
  }
  async listAccountDeletionRequests(actor: RequestActor) {
    return this.repository.listAccountDeletionRequests(scopeOf(actor));
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

  private async assertPaymentAllocation(
    actor: RequestActor,
    branchId: string,
    memberId: string | null,
    allocationType: PaymentAllocationType | null,
    allocationId: string | null
  ): Promise<void> {
    if (!memberId) {
      if (allocationType || allocationId) {
        throw new DomainError(
          "VALIDATION_FAILED",
          "A payment cannot be allocated until a member is selected.",
          400
        );
      }
      return;
    }

    await this.getMember(actor, memberId);
    if (!allocationType) {
      if (allocationId) {
        throw new DomainError(
          "VALIDATION_FAILED",
          "An allocation type is required for the target.",
          400
        );
      }
      return;
    }

    if (allocationType === "booking") {
      if (!allocationId) {
        throw new DomainError("VALIDATION_FAILED", "A booking target is required.", 400);
      }
      const booking = await this.getBooking(actor, allocationId);
      if (
        booking.memberId !== memberId ||
        booking.branchId !== branchId ||
        booking.status !== BOOKING_ACTIVE_STATUS
      ) {
        throw new DomainError(
          "VALIDATION_FAILED",
          "The booking is not an active booking for this member and branch.",
          400
        );
      }
      return;
    }

    if (allocationType === "membership") {
      if (!allocationId) {
        throw new DomainError("VALIDATION_FAILED", "A membership target is required.", 400);
      }
      const membership = await this.repository.findMemberMembershipById(
        scopeOf(actor),
        allocationId
      );
      if (
        !membership ||
        membership.memberId !== memberId ||
        !(ACTIVE_MEMBERSHIP_STATUSES as readonly string[]).includes(membership.status) ||
        (membership.planSnapshot.branchId !== null && membership.planSnapshot.branchId !== branchId)
      ) {
        throw new DomainError(
          "VALIDATION_FAILED",
          "The membership is not eligible for this member and branch.",
          400
        );
      }
      return;
    }

    if (allocationId) {
      throw new DomainError(
        "VALIDATION_FAILED",
        "Walk-in and other allocations cannot have a target ID.",
        400
      );
    }
  }

  private async assertScheduleResourceAccess(
    actor: RequestActor,
    input: Pick<
      CreateScheduleOccurrenceRequest,
      "branchId" | "serviceId" | "trainerUserId" | "roomId"
    >
  ): Promise<void> {
    if (!actor.branchIds.includes(input.branchId)) {
      throw new DomainError("BRANCH_ACCESS_DENIED", "Branch is unavailable.", 404);
    }
    const service = await this.getService(actor, input.serviceId);
    if (!service.isActive || (service.branchId && service.branchId !== input.branchId)) {
      throw new DomainError("VALIDATION_FAILED", "Service is not offered by this branch.", 400);
    }
    if (input.roomId) {
      const room = await this.repository.findRoomById(scopeOf(actor), input.roomId);
      if (!room || room.branchId !== input.branchId || !room.isActive) {
        throw new DomainError("VALIDATION_FAILED", "Room is unavailable.", 400);
      }
    }
    if (input.trainerUserId) {
      const trainer = await this.repository.findStaffByUserId(scopeOf(actor), input.trainerUserId);
      if (!trainer || !trainer.branches.some((branch) => branch.id === input.branchId)) {
        throw new DomainError("VALIDATION_FAILED", "Trainer is unavailable for this branch.", 400);
      }
    }
  }

  private scheduleError(error: unknown): Error {
    if (error instanceof DomainError) return error;
    if (error instanceof Error && /conflict|exclusion|collision/i.test(error.message)) {
      return new DomainError(
        "VALIDATION_FAILED",
        "Trainer or room has a conflicting occurrence.",
        409
      );
    }
    if (error instanceof Error && /already overridden/i.test(error.message)) {
      return new DomainError(
        "VALIDATION_FAILED",
        "This occurrence already has a one-off override.",
        409
      );
    }
    if (error instanceof Error && /capacity.*confirmed booking/i.test(error.message)) {
      return new DomainError("VALIDATION_FAILED", error.message, 409);
    }
    if (error instanceof Error) {
      return new DomainError("VALIDATION_FAILED", error.message, 400);
    }
    return new DomainError("VALIDATION_FAILED", "The schedule change is invalid.", 400);
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
