import { randomUUID } from "node:crypto";
import type {
  AuditEventResponse,
  AuditRecordInput,
  BranchResponse,
  CreateBranchRequest,
  CreateMemberRequest,
  CursorPage,
  DomainEvent,
  MemberListFilters,
  MemberListItem,
  MemberResponse,
  CreateLeadRequest,
  LeadListFilters,
  LeadConversionResponse,
  LeadNoteResponse,
  LeadResponse,
  LeadStage,
  LeadTaskResponse,
  CreateLeadTaskRequest,
  UpdateLeadStageRequest,
  PermissionKey,
  RoleKey,
  RoleResponse,
  StaffUserResponse,
  TenantSummary,
  UpdateBranchRequest,
  UpdateMemberRequest,
  UpdateOrganizationRequest,
  UserSummary,
  CreateRoomRequest,
  UpdateRoomRequest,
  CreateScheduleOccurrenceRequest,
  CreateScheduleTemplateRequest,
  CreateServiceRequest,
  RoomResponse,
  ScheduleOccurrenceFilters,
  ScheduleOccurrenceResponse,
  ScheduleTemplateResponse,
  ScheduleTemplateMutationResponse,
  OverrideScheduleOccurrenceRequest,
  ServiceResponse,
  ServiceType,
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
  ReconcilePaymentRequest,
  AttendanceRecordResponse,
  CheckInRequest,
  UpdateRosterStatusRequest,
  AttendanceListFilters,
  PublicTenantInfoResponse,
  PublicServiceResponse,
  PublicCoachResponse,
  PublicScheduleOccurrenceResponse,
  CreatePublicLeadRequest,
  MemberProfileResponse,
  MemberPortalOverviewResponse,
  InsightsOverviewResponse,
  WeeklyAttendancePoint,
  OccupancyHeatmapPoint,
  RetentionCohortRow,
  AtRiskMemberItem,
  LeadFunnelStageCount,
  AutomationRuleResponse,
  CreateAutomationRuleRequest,
  UpdateAutomationRuleRequest,
  AutomationExecutionLogResponse,
  SaaSTenantSignupRequest,
  SaaSTenantSignupResponse,
  TenantSubscriptionResponse,
  UsageQuotaMetricsResponse,
  FeatureFlagResponse,
  EquipmentAssetResponse,
  CreateEquipmentAssetRequest,
  UpdateEquipmentAssetRequest,
  EquipmentPoolResponse,
  CreateEquipmentPoolRequest,
  EquipmentMaintenanceRecordResponse,
  CreateMaintenanceRecordRequest,
  InventoryItemResponse,
  CreateInventoryItemRequest,
  UpdateInventoryItemRequest,
  InventoryMovementResponse,
  CreateInventoryMovementRequest,
  PurchaseOrderResponse,
  CreatePurchaseOrderRequest,
  AssessmentDefinitionResponse,
  CreateAssessmentDefinitionRequest,
  AssessmentSessionResponse,
  CreateAssessmentSessionRequest,
  MemberPerformanceProfileResponse,
  TherapyModalityResponse,
  TherapyProtocolResponse,
  CreateTherapyProtocolRequest,
  TherapySessionResponse,
  CreateTherapySessionRequest
} from "@fitos/contracts";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PLATFORM_FEATURE_REGISTRY,
  SaaS_PLAN_QUOTAS
} from "@fitos/contracts";
import { decodeCursor, encodeCursor, normalizePhone } from "@fitos/shared";
import type {
  CreateSessionInput,
  FitosRepository,
  IdempotencyAcquireResult,
  IdempotencyRecord,
  InviteStaffInput,
  LoginIdentity,
  ResolvedSession,
  StaffAccessInput,
  TenantScope
} from "../ports/fitos-repository.js";

type StoredTenant = TenantSummary;
type StoredBranch = BranchResponse & { tenantId: string };
type StoredUser = UserSummary & { passwordHash: string };
type StoredRole = RoleResponse & { tenantId: string };
type StoredTenantUser = {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  status: "active" | "invited" | "deactivated";
};
type StoredSession = CreateSessionInput & { id: string; revokedAt: string | null };
type StoredMemberSession = {
  id: string;
  memberId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
};
type StoredContact = MemberResponse["contact"] & { tenantId: string };
type StoredMember = Omit<MemberResponse, "contact"> & { contactId: string };
type StoredLead = Omit<LeadResponse, "contact"> & { contactId: string };
type StoredLeadNote = LeadNoteResponse & { tenantId: string; leadId: string };
type StoredLeadTask = LeadTaskResponse & { tenantId: string; leadId: string };
type StoredService = ServiceResponse;
type StoredRoom = RoomResponse;
type StoredOccurrence = ScheduleOccurrenceResponse & { cancellationReason: string | null };
type StoredScheduleTemplate = ScheduleTemplateResponse;
type StoredScheduleException = {
  id: string;
  tenantId: string;
  templateId: string;
  occurrenceId: string;
  exceptionType: "cancelled" | "overridden";
  reason: string;
  originalStartsAt: string;
  createdByUserId: string;
  createdAt: string;
};
type StoredBooking = BookingResponse;
type StoredMembershipPlan = MembershipPlanResponse;
type StoredMemberMembership = MemberMembershipResponse;
type StoredCreditLedgerEntry = CreditLedgerEntryResponse & { tenantId: string };
type StoredPaymentTransaction = PaymentTransactionResponse;
type StoredAttendanceRecord = AttendanceRecordResponse;
type StoredIdempotency = IdempotencyRecord;
type StoredPlatformAdminToken = {
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
};

const now = () => new Date().toISOString();
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);

export class InMemoryFitosRepository implements FitosRepository {
  private readonly tenants = new Map<string, StoredTenant>();
  private readonly branches = new Map<string, StoredBranch>();
  private readonly users = new Map<string, StoredUser>();
  private readonly platformAdminTokens = new Map<string, StoredPlatformAdminToken>();
  private readonly roles = new Map<string, StoredRole>();
  private readonly tenantUsers = new Map<string, StoredTenantUser>();
  private readonly workspacePreferences = new Map<
    string,
    import("@fitos/contracts").WorkspaceKey
  >();
  private readonly staffRoleAssignments = new Map<string, Set<string>>();
  private readonly branchAccess = new Map<string, Set<string>>();
  private readonly sessions = new Map<string, StoredSession>();
  private readonly memberSessions = new Map<string, StoredMemberSession>();
  private readonly contacts = new Map<string, StoredContact>();
  private readonly members = new Map<string, StoredMember>();
  private readonly leads = new Map<string, StoredLead>();
  private readonly leadNotes = new Map<string, StoredLeadNote>();
  private readonly leadTasks = new Map<string, StoredLeadTask>();
  private readonly services = new Map<string, StoredService>();
  private readonly rooms = new Map<string, StoredRoom>();
  private readonly scheduleTemplates = new Map<string, StoredScheduleTemplate>();
  private readonly occurrences = new Map<string, StoredOccurrence>();
  private readonly scheduleExceptions = new Map<string, StoredScheduleException>();
  private readonly bookings = new Map<string, StoredBooking>();
  private readonly membershipPlans = new Map<string, StoredMembershipPlan>();
  private readonly memberMemberships = new Map<string, StoredMemberMembership>();
  private readonly creditLedger = new Map<string, StoredCreditLedgerEntry>();
  private readonly accountExportRequests = new Map<
    string,
    import("@fitos/contracts").AccountExportRequestResponse
  >();
  private readonly planChangeRequests = new Map<
    string,
    import("@fitos/contracts").PlanChangeRequestResponse
  >();
  private readonly accountCancellationRequests = new Map<
    string,
    import("@fitos/contracts").AccountCancellationRequestResponse
  >();
  private readonly accountDeletionRequests = new Map<
    string,
    import("@fitos/contracts").AccountDeletionRequestResponse
  >();
  private readonly payments = new Map<string, StoredPaymentTransaction>();
  private readonly attendance = new Map<string, StoredAttendanceRecord>();
  private readonly automations = new Map<string, AutomationRuleResponse>();
  private readonly automationLogs: AutomationExecutionLogResponse[] = [];
  private readonly equipmentAssets = new Map<string, EquipmentAssetResponse>();
  private readonly equipmentPools = new Map<string, EquipmentPoolResponse>();
  private readonly equipmentMaintenance = new Map<string, EquipmentMaintenanceRecordResponse>();
  private readonly serviceEquipmentRequirements = new Map<
    string,
    import("@fitos/contracts").ServiceEquipmentRequirement[]
  >();
  private readonly inventoryItems = new Map<string, InventoryItemResponse>();
  private readonly inventoryMovements: InventoryMovementResponse[] = [];
  private readonly purchaseOrders = new Map<string, PurchaseOrderResponse>();
  private readonly assessmentDefinitions = new Map<string, AssessmentDefinitionResponse>();
  private readonly assessmentSessions = new Map<string, AssessmentSessionResponse>();
  private readonly therapyModalities = new Map<string, TherapyModalityResponse>();
  private readonly therapyProtocols = new Map<string, TherapyProtocolResponse>();
  private readonly therapySessions = new Map<string, TherapySessionResponse>();
  private readonly tenantSubscriptions = new Map<string, TenantSubscriptionResponse>();
  private readonly featureFlags = new Map<string, FeatureFlagResponse[]>();
  private readonly notificationPreferences = new Map<
    string,
    import("@fitos/contracts").NotificationPreferences
  >();
  private readonly notifications = new Map<
    string,
    import("@fitos/contracts").NotificationResponse
  >();
  private readonly platformPlanDefinitions = new Map<
    string,
    import("@fitos/contracts").SaaSPlanDefinition
  >();
  private readonly platformFeatureFlagOverrides = new Map<
    string,
    import("@fitos/contracts").FeatureFlagOverrideResponse
  >();
  private readonly auditEvents: AuditEventResponse[] = [];
  private readonly idempotency = new Map<string, StoredIdempotency>();
  private readonly memberPasswords = new Map<string, string>();
  private readonly publicReservations: import("@fitos/contracts").PublicReservationResponse[] = [];
  private readonly implementationInquiries = new Map<
    string,
    import("@fitos/contracts").ImplementationInquiryResponse
  >();
  private readonly sitePages = new Map<string, import("@fitos/contracts").SitePageResponse>();
  private readonly equipmentAllocations = new Map<
    string,
    import("@fitos/contracts").EquipmentAllocationResponse
  >();
  private readonly serviceInventoryRequirements = new Map<
    string,
    import("@fitos/contracts").ServiceInventoryRequirement[]
  >();
  private readonly inventoryConsumptions = new Map<
    string,
    import("@fitos/contracts").InventoryConsumptionResponse
  >();
  private readonly domainEvents: DomainEvent[] = [];

  async ping(): Promise<boolean> {
    return true;
  }

  async seedDevelopmentData(passwordHash: string): Promise<void> {
    if (this.tenants.size) return;
    const gymIds = await this.createDemoTenant({
      tenant: { name: "FITOS Demo Gym", slug: "fitos-demo-gym" },
      branch: { name: "Kilimani", slug: "kilimani" },
      owner: { email: "owner@gym.fitos.test", displayName: "Gym Owner", passwordHash },
      staff: [
        {
          email: "reception@gym.fitos.test",
          displayName: "Gym Reception",
          roleKey: "reception",
          passwordHash
        },
        {
          email: "finance@gym.fitos.test",
          displayName: "Gym Finance",
          roleKey: "finance",
          passwordHash
        },
        {
          email: "trainer@gym.fitos.test",
          displayName: "Gym Trainer",
          roleKey: "trainer",
          passwordHash
        }
      ]
    });
    await this.createDemoTenant({
      tenant: { name: "FITOS Demo Pilates", slug: "fitos-demo-pilates" },
      branch: { name: "Westlands", slug: "westlands" },
      owner: { email: "owner@pilates.fitos.test", displayName: "Pilates Owner", passwordHash }
    });
    if (gymIds) await this.seedGymData(gymIds);
  }

  private async seedGymData(ids: {
    tenantId: string;
    branchId: string;
    ownerTenantUserId: string;
    trainerUserId: string | null;
  }): Promise<void> {
    const { tenantId, branchId, ownerTenantUserId, trainerUserId } = ids;
    const ts = now();
    // ── Helper: offset ISO timestamps ──
    const daysAgo = (n: number, hour = 9, min = 0) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      d.setHours(hour, min, 0, 0);
      return d.toISOString();
    };
    const daysFrom = (n: number, hour = 9, min = 0) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      d.setHours(hour, min, 0, 0);
      return d.toISOString();
    };

    // ── Rooms ──
    const roomMain: StoredRoom = {
      id: randomUUID(),
      tenantId,
      branchId,
      name: "Main Studio",
      capacity: 20,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    };
    const roomSpin: StoredRoom = {
      id: randomUUID(),
      tenantId,
      branchId,
      name: "Spin Studio",
      capacity: 15,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    };
    this.rooms.set(roomMain.id, roomMain);
    this.rooms.set(roomSpin.id, roomSpin);

    // ── Services ──
    const makeService = (
      name: string,
      slug: string,
      type: ServiceType,
      duration: number,
      capacity: number,
      credits: number,
      priceKes: number,
      publicVisible: boolean
    ): StoredService => ({
      id: randomUUID(),
      tenantId,
      branchId: null,
      name,
      slug,
      serviceType: type,
      durationMinutes: duration,
      defaultCapacity: capacity,
      creditsRequired: credits,
      cancellationCutoffMinutes: 60,
      restoreCreditOnLateCancel: false,
      price: { amountMinor: String(priceKes * 100), currency: "KES" },
      publicVisible,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    });

    const svcHiit = makeService("HIIT Bootcamp", "hiit-bootcamp", "class", 45, 20, 1, 800, true);
    const svcYoga = makeService("Morning Yoga Flow", "morning-yoga", "class", 60, 20, 1, 600, true);
    const svcSpin = makeService("Indoor Cycling", "indoor-cycling", "class", 45, 15, 1, 700, true);
    const svcPT = makeService(
      "Personal Training",
      "personal-training",
      "appointment",
      60,
      1,
      2,
      3500,
      false
    );
    const svcStrength = makeService(
      "Strength & Conditioning",
      "strength-conditioning",
      "class",
      60,
      20,
      1,
      750,
      true
    );
    const svcPilates = makeService("Pilates Mat", "pilates-mat", "class", 50, 15, 1, 650, true);
    for (const s of [svcHiit, svcYoga, svcSpin, svcPT, svcStrength, svcPilates]) {
      this.services.set(s.id, s);
    }

    // ── Membership Plans ──
    const planMonthly: StoredMembershipPlan = {
      id: randomUUID(),
      tenantId,
      branchId: null,
      name: "Monthly Unlimited",
      slug: "monthly-unlimited",
      price: { amountMinor: "500000", currency: "KES" },
      durationDays: 30,
      includedCredits: 30,
      publicVisible: true,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    };
    const planPunch10: StoredMembershipPlan = {
      id: randomUUID(),
      tenantId,
      branchId: null,
      name: "10-Class Punch Pass",
      slug: "punch-10",
      price: { amountMinor: "600000", currency: "KES" },
      durationDays: 60,
      includedCredits: 10,
      publicVisible: true,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    };
    const planPunch5: StoredMembershipPlan = {
      id: randomUUID(),
      tenantId,
      branchId: null,
      name: "5-Class Starter Pack",
      slug: "starter-5",
      price: { amountMinor: "280000", currency: "KES" },
      durationDays: 30,
      includedCredits: 5,
      publicVisible: true,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    };
    const planTrial: StoredMembershipPlan = {
      id: randomUUID(),
      tenantId,
      branchId: null,
      name: "Free Trial Pass",
      slug: "free-trial",
      price: null,
      durationDays: 7,
      includedCredits: 2,
      publicVisible: false,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    };
    for (const p of [planMonthly, planPunch10, planPunch5, planTrial]) {
      this.membershipPlans.set(p.id, p);
    }

    // ── Members ──
    type MemberSeed = {
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      status: "active" | "inactive";
      joinedDaysAgo: number;
      plan: StoredMembershipPlan;
      memberNumber: string;
    };
    const memberSeeds: MemberSeed[] = [
      {
        firstName: "Amina",
        lastName: "Otieno",
        phone: "+254712345678",
        email: "amina.otieno@gmail.com",
        status: "active",
        joinedDaysAgo: 90,
        plan: planMonthly,
        memberNumber: "GYM-0001"
      },
      {
        firstName: "Brian",
        lastName: "Kamau",
        phone: "+254723456789",
        email: "bkamau@outlook.com",
        status: "active",
        joinedDaysAgo: 60,
        plan: planPunch10,
        memberNumber: "GYM-0002"
      },
      {
        firstName: "Christine",
        lastName: "Wanjiku",
        phone: "+254734567890",
        email: "christine.w@gmail.com",
        status: "active",
        joinedDaysAgo: 45,
        plan: planMonthly,
        memberNumber: "GYM-0003"
      },
      {
        firstName: "David",
        lastName: "Muthoni",
        phone: "+254745678901",
        status: "active",
        joinedDaysAgo: 30,
        plan: planPunch10,
        memberNumber: "GYM-0004"
      },
      {
        firstName: "Esther",
        lastName: "Njoroge",
        phone: "+254756789012",
        email: "esther.njoroge@gmail.com",
        status: "active",
        joinedDaysAgo: 120,
        plan: planMonthly,
        memberNumber: "GYM-0005"
      },
      {
        firstName: "Felix",
        lastName: "Ochieng",
        phone: "+254767890123",
        status: "active",
        joinedDaysAgo: 20,
        plan: planPunch5,
        memberNumber: "GYM-0006"
      },
      {
        firstName: "Grace",
        lastName: "Achieng",
        phone: "+254778901234",
        email: "grace.a@yahoo.com",
        status: "active",
        joinedDaysAgo: 75,
        plan: planMonthly,
        memberNumber: "GYM-0007"
      },
      {
        firstName: "Hassan",
        lastName: "Omar",
        phone: "+254789012345",
        status: "active",
        joinedDaysAgo: 15,
        plan: planTrial,
        memberNumber: "GYM-0008"
      },
      {
        firstName: "Irene",
        lastName: "Mwangi",
        phone: "+254790123456",
        email: "irene.mwangi@gmail.com",
        status: "active",
        joinedDaysAgo: 50,
        plan: planPunch10,
        memberNumber: "GYM-0009"
      },
      {
        firstName: "James",
        lastName: "Kariuki",
        phone: "+254701234567",
        email: "jkariuki@company.co.ke",
        status: "active",
        joinedDaysAgo: 180,
        plan: planMonthly,
        memberNumber: "GYM-0010"
      },
      {
        firstName: "Karen",
        lastName: "Waweru",
        phone: "+254711111111",
        status: "active",
        joinedDaysAgo: 10,
        plan: planPunch5,
        memberNumber: "GYM-0011"
      },
      {
        firstName: "Liam",
        lastName: "Gitau",
        phone: "+254722222222",
        email: "liam.g@gmail.com",
        status: "active",
        joinedDaysAgo: 65,
        plan: planMonthly,
        memberNumber: "GYM-0012"
      },
      {
        firstName: "Mary",
        lastName: "Nyambura",
        phone: "+254733333333",
        status: "active",
        joinedDaysAgo: 40,
        plan: planPunch10,
        memberNumber: "GYM-0013"
      },
      {
        firstName: "Nathan",
        lastName: "Ouma",
        phone: "+254744444444",
        email: "nouma@gmail.com",
        status: "active",
        joinedDaysAgo: 5,
        plan: planTrial,
        memberNumber: "GYM-0014"
      },
      {
        firstName: "Olivia",
        lastName: "Wangari",
        phone: "+254755555555",
        status: "active",
        joinedDaysAgo: 100,
        plan: planMonthly,
        memberNumber: "GYM-0015"
      },
      {
        firstName: "Peter",
        lastName: "Kimani",
        phone: "+254766666666",
        email: "peter.kimani@gmail.com",
        status: "inactive",
        joinedDaysAgo: 200,
        plan: planPunch10,
        memberNumber: "GYM-0016"
      },
      {
        firstName: "Queen",
        lastName: "Adhiambo",
        phone: "+254777777777",
        status: "inactive",
        joinedDaysAgo: 150,
        plan: planMonthly,
        memberNumber: "GYM-0017"
      },
      {
        firstName: "Robert",
        lastName: "Kiprotich",
        phone: "+254788888888",
        email: "r.kiprotich@gmail.com",
        status: "inactive",
        joinedDaysAgo: 250,
        plan: planPunch10,
        memberNumber: "GYM-0018"
      },
      {
        firstName: "Sharon",
        lastName: "Mutua",
        phone: "+254799999999",
        status: "inactive",
        joinedDaysAgo: 300,
        plan: planMonthly,
        memberNumber: "GYM-0019"
      },
      {
        firstName: "Thomas",
        lastName: "Ndirangu",
        phone: "+254700000001",
        email: "t.ndirangu@gmail.com",
        status: "active",
        joinedDaysAgo: 25,
        plan: planPunch5,
        memberNumber: "GYM-0020"
      }
    ];

    const storedMembers: StoredMember[] = [];
    const storedContacts: StoredContact[] = [];

    for (const seed of memberSeeds) {
      const contactId = randomUUID();
      const memberId = randomUUID();
      const joinedAt = daysAgo(seed.joinedDaysAgo);
      const contact: StoredContact = {
        id: contactId,
        tenantId,
        firstName: seed.firstName,
        lastName: seed.lastName,
        phone: seed.phone,
        email: seed.email ?? null,
        dateOfBirth: null
      };
      const member: StoredMember = {
        id: memberId,
        tenantId,
        contactId,
        homeBranchId: branchId,
        memberNumber: seed.memberNumber,
        status: seed.status,
        joinedAt,
        createdAt: joinedAt,
        updatedAt: joinedAt
      };
      this.contacts.set(contactId, contact);
      this.members.set(memberId, member);
      storedMembers.push(member);
      storedContacts.push(contact);
    }

    // ── Leads ──
    type LeadSeed = {
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      interest: string;
      source: string;
      stage: LeadStage;
      daysAgo: number;
    };
    const leadSeeds: LeadSeed[] = [
      {
        firstName: "Aisha",
        lastName: "Maina",
        phone: "+254712000001",
        email: "aisha.maina@gmail.com",
        interest: "Weight loss + group classes",
        source: "instagram",
        stage: "new",
        daysAgo: 1
      },
      {
        firstName: "Bernard",
        lastName: "Oloo",
        phone: "+254723000002",
        interest: "Strength training",
        source: "walk_in",
        stage: "contacted",
        daysAgo: 3
      },
      {
        firstName: "Carol",
        lastName: "Mbugua",
        phone: "+254734000003",
        email: "carol.mbugua@outlook.com",
        interest: "Yoga & stress relief",
        source: "referral",
        stage: "trial_booked",
        daysAgo: 5
      },
      {
        firstName: "Daniel",
        lastName: "Wekesa",
        phone: "+254745000004",
        interest: "Spin & cardio",
        source: "facebook",
        stage: "trial_completed",
        daysAgo: 8
      },
      {
        firstName: "Eva",
        lastName: "Chebet",
        phone: "+254756000005",
        email: "eva.chebet@gmail.com",
        interest: "HIIT bootcamp",
        source: "instagram",
        stage: "offer",
        daysAgo: 12
      },
      {
        firstName: "Frank",
        lastName: "Odero",
        phone: "+254767000006",
        interest: "Personal training",
        source: "google",
        stage: "new",
        daysAgo: 2
      },
      {
        firstName: "Gloria",
        lastName: "Ndungu",
        phone: "+254778000007",
        email: "gloria.n@gmail.com",
        interest: "Morning yoga",
        source: "referral",
        stage: "contacted",
        daysAgo: 6
      },
      {
        firstName: "Henry",
        lastName: "Chesang",
        phone: "+254789000008",
        interest: "General fitness",
        source: "walk_in",
        stage: "lost",
        daysAgo: 20
      }
    ];

    for (const seed of leadSeeds) {
      const contactId = randomUUID();
      const leadId = randomUUID();
      const createdAt = daysAgo(seed.daysAgo);
      const contact: StoredContact = {
        id: contactId,
        tenantId,
        firstName: seed.firstName,
        lastName: seed.lastName,
        phone: seed.phone,
        email: seed.email ?? null,
        dateOfBirth: null
      };
      const lead: StoredLead = {
        id: leadId,
        tenantId,
        contactId,
        branchId,
        ownerUserId: null,
        interest: seed.interest,
        source: seed.source,
        stage: seed.stage,
        lostReason: seed.stage === "lost" ? "Price too high" : null,
        nextFollowUpAt: seed.stage === "new" || seed.stage === "contacted" ? daysFrom(2) : null,
        convertedMemberId: null,
        createdAt,
        updatedAt: createdAt
      };
      this.contacts.set(contactId, contact);
      this.leads.set(leadId, lead);
    }

    // ── Schedule Occurrences ──
    // We create 3 occurrences per service across the past 2 weeks + this week + 2 weeks ahead
    const slotMatrix: Array<{
      svc: StoredService;
      room: StoredRoom;
      hourOffset: number;
      dayOffset: number;
    }> = [
      { svc: svcHiit, room: roomMain, hourOffset: 6, dayOffset: -14 },
      { svc: svcHiit, room: roomMain, hourOffset: 6, dayOffset: -7 },
      { svc: svcHiit, room: roomMain, hourOffset: 6, dayOffset: 0 },
      { svc: svcHiit, room: roomMain, hourOffset: 6, dayOffset: 7 },
      { svc: svcYoga, room: roomMain, hourOffset: 7, dayOffset: -13 },
      { svc: svcYoga, room: roomMain, hourOffset: 7, dayOffset: -6 },
      { svc: svcYoga, room: roomMain, hourOffset: 7, dayOffset: 1 },
      { svc: svcYoga, room: roomMain, hourOffset: 7, dayOffset: 8 },
      { svc: svcSpin, room: roomSpin, hourOffset: 9, dayOffset: -12 },
      { svc: svcSpin, room: roomSpin, hourOffset: 9, dayOffset: -5 },
      { svc: svcSpin, room: roomSpin, hourOffset: 9, dayOffset: 2 },
      { svc: svcSpin, room: roomSpin, hourOffset: 9, dayOffset: 9 },
      { svc: svcStrength, room: roomMain, hourOffset: 17, dayOffset: -11 },
      { svc: svcStrength, room: roomMain, hourOffset: 17, dayOffset: -4 },
      { svc: svcStrength, room: roomMain, hourOffset: 17, dayOffset: 3 },
      { svc: svcStrength, room: roomMain, hourOffset: 17, dayOffset: 10 },
      { svc: svcPilates, room: roomMain, hourOffset: 10, dayOffset: -10 },
      { svc: svcPilates, room: roomMain, hourOffset: 10, dayOffset: -3 },
      { svc: svcPilates, room: roomMain, hourOffset: 10, dayOffset: 4 },
      { svc: svcPilates, room: roomMain, hourOffset: 10, dayOffset: 11 }
    ];

    const storedOccurrences: StoredOccurrence[] = [];
    for (const slot of slotMatrix) {
      const startsAt = daysFrom(slot.dayOffset, slot.hourOffset, 0);
      const endsAt = (() => {
        const d = new Date(startsAt);
        d.setMinutes(d.getMinutes() + slot.svc.durationMinutes);
        return d.toISOString();
      })();
      const occ: StoredOccurrence = {
        id: randomUUID(),
        tenantId,
        branchId,
        templateId: null,
        serviceId: slot.svc.id,
        trainerUserId: trainerUserId ?? null,
        roomId: slot.room.id,
        startsAt,
        endsAt,
        capacity: slot.room.capacity!,
        status: new Date(startsAt) < new Date() ? "scheduled" : "scheduled",
        cancellationReason: null,
        createdAt: ts,
        updatedAt: ts
      };
      this.occurrences.set(occ.id, occ);
      storedOccurrences.push(occ);
    }

    // ── Memberships, Credit Ledger, Bookings & Attendance ──
    // Assign every member a membership and give active members credits + bookings
    for (let i = 0; i < storedMembers.length; i++) {
      const member = storedMembers[i]!;
      const seed = memberSeeds[i]!;

      // Create membership
      const membershipId = randomUUID();
      const planSnapshot = { ...seed.plan };
      const startsAt = daysAgo(seed.joinedDaysAgo);
      const endsAt = seed.plan.durationDays
        ? (() => {
            const d = new Date(startsAt);
            d.setDate(d.getDate() + seed.plan.durationDays!);
            return d.toISOString();
          })()
        : null;

      const isExpired = endsAt && new Date(endsAt) < new Date();
      const membershipStatus: MemberMembershipResponse["status"] = isExpired
        ? "expired"
        : seed.status === "inactive"
          ? "cancelled"
          : "active";

      const membership: StoredMemberMembership = {
        id: membershipId,
        tenantId,
        memberId: member.id,
        planId: seed.plan.id,
        planSnapshot,
        status: membershipStatus,
        startsAt,
        endsAt,
        createdAt: startsAt,
        updatedAt: startsAt
      };
      this.memberMemberships.set(membershipId, membership);

      // Credit grant ledger entry
      const grantEntry: StoredCreditLedgerEntry = {
        id: randomUUID(),
        tenantId,
        membershipId,
        memberId: member.id,
        delta: seed.plan.includedCredits,
        reason: "purchase",
        bookingId: null,
        note: `${seed.plan.name} activation`,
        createdAt: startsAt
      };
      this.creditLedger.set(grantEntry.id, grantEntry);

      // Payment transaction for membership purchase (skip trial and inactive)
      if (seed.plan.price && seed.status === "active") {
        const payment: StoredPaymentTransaction = {
          id: randomUUID(),
          tenantId,
          branchId,
          memberId: member.id,
          amount: seed.plan.price,
          method: i % 3 === 0 ? "mpesa" : i % 3 === 1 ? "card" : "cash",
          reference: `TXN-${member.memberNumber}`,
          providerRef: null,
          status: "completed",
          note: `${seed.plan.name} payment`,
          allocationType: "membership",
          allocationId: membershipId,
          recordedByUserId: ownerTenantUserId,
          recordedAt: startsAt,
          createdAt: startsAt,
          updatedAt: startsAt
        };
        this.payments.set(payment.id, payment);
      }

      // Bookings: give each active member 2-4 past bookings
      if (seed.status === "active" && storedOccurrences.length > 0) {
        const pastOccurrences = storedOccurrences.filter((o) => new Date(o.startsAt) < new Date());
        const count = 2 + (i % 3);
        for (let b = 0; b < Math.min(count, pastOccurrences.length); b++) {
          const occ = pastOccurrences[b % pastOccurrences.length]!;
          const occService = this.services.get(occ.serviceId);
          const creditsForOcc = occService?.creditsRequired ?? 1;
          const bookedAt = daysAgo(seed.joinedDaysAgo - 3 - b);
          const booking: StoredBooking = {
            id: randomUUID(),
            tenantId,
            branchId,
            occurrenceId: occ.id,
            memberId: member.id,
            status: "confirmed",
            source: "staff",
            bookedAt,
            cancelledAt: null,
            cancellationReason: null,
            creditMembershipId: membershipId,
            creditsDebited: creditsForOcc,
            entitlementOverrideReason: null,
            lateCancelled: false,
            createdByUserId: ownerTenantUserId,
            createdAt: bookedAt,
            updatedAt: bookedAt
          };
          this.bookings.set(booking.id, booking);

          // Debit credit ledger for each booking
          const debitEntry: StoredCreditLedgerEntry = {
            id: randomUUID(),
            tenantId,
            membershipId,
            memberId: member.id,
            delta: -creditsForOcc,
            reason: "booking",
            bookingId: booking.id,
            note: null,
            createdAt: bookedAt
          };
          this.creditLedger.set(debitEntry.id, debitEntry);

          // Attendance: check-in for all past bookings
          const checkedInAt = (() => {
            const d = new Date(occ.startsAt);
            d.setMinutes(d.getMinutes() + 5);
            return d.toISOString();
          })();
          const attendance: StoredAttendanceRecord = {
            id: randomUUID(),
            tenantId,
            branchId,
            occurrenceId: occ.id,
            memberId: member.id,
            status: b % 5 === 4 ? "no_show" : "attended",
            checkedInAt: b % 5 === 4 ? null : checkedInAt,
            actorUserId: ownerTenantUserId,
            overrideReason: null,
            createdAt: checkedInAt,
            updatedAt: checkedInAt
          };
          this.attendance.set(attendance.id, attendance);
        }
      }
    }

    // ── Seed Automations ──
    const auto1: AutomationRuleResponse = {
      id: randomUUID(),
      tenantId,
      name: "New Member Welcome & Induction",
      description: "Send onboarding guide and booking link when a new member joins.",
      triggerType: "member_joined",
      triggerConfig: {},
      conditions: [],
      actionType: "send_email",
      actionConfig: {
        template: "welcome_induction",
        recipientType: "member",
        subject: "Welcome to FITOS Demo Gym! Your journey begins today."
      },
      isActive: true,
      totalExecutions: 14,
      lastExecutedAt: daysAgo(1),
      createdAt: daysAgo(60),
      updatedAt: daysAgo(1)
    };
    const auto2: AutomationRuleResponse = {
      id: randomUUID(),
      tenantId,
      name: "Trial Session WhatsApp Follow-Up",
      description: "Trigger WhatsApp follow-up 2 hours after completing a free trial class.",
      triggerType: "trial_completed",
      triggerConfig: { delayMinutes: 120 },
      conditions: [],
      actionType: "send_whatsapp",
      actionConfig: {
        template: "trial_followup",
        recipientType: "lead",
        body: "Hey there! How was your session today? Ready to join the pack with 20% off your first month?"
      },
      isActive: true,
      totalExecutions: 8,
      lastExecutedAt: daysAgo(2),
      createdAt: daysAgo(60),
      updatedAt: daysAgo(2)
    };
    const auto3: AutomationRuleResponse = {
      id: randomUUID(),
      tenantId,
      name: "Membership Expiration Warning (3 Days)",
      description: "Send renewal alert SMS 3 days prior to monthly package expiration.",
      triggerType: "membership_expiring_soon",
      triggerConfig: { daysBeforeExpiry: 3 },
      conditions: [],
      actionType: "send_sms",
      actionConfig: {
        recipientType: "member",
        body: "Hi {member.firstName}, your Monthly Unlimited pass expires in 3 days. Renew now on your portal to keep your spot!"
      },
      isActive: true,
      totalExecutions: 22,
      lastExecutedAt: daysAgo(3),
      createdAt: daysAgo(60),
      updatedAt: daysAgo(3)
    };
    const auto4: AutomationRuleResponse = {
      id: randomUUID(),
      tenantId,
      name: "Win-Back Alert for Inactive Members (21+ Days)",
      description:
        "Create a staff outreach task when an active member has not checked in for 21 days.",
      triggerType: "member_inactive",
      triggerConfig: { daysInactive: 21 },
      conditions: [],
      actionType: "create_staff_task",
      actionConfig: {
        subject: "Call inactive member for wellness check-in",
        recipientType: "staff"
      },
      isActive: true,
      totalExecutions: 5,
      lastExecutedAt: daysAgo(5),
      createdAt: daysAgo(60),
      updatedAt: daysAgo(5)
    };
    for (const a of [auto1, auto2, auto3, auto4]) {
      this.automations.set(a.id, a);
    }
    this.automationLogs.push(
      {
        id: randomUUID(),
        ruleId: auto1.id,
        ruleName: auto1.name,
        tenantId,
        status: "success",
        triggerEvent: "member.created",
        targetEntityId: storedMembers[0]?.id ?? null,
        targetEntityName: "Amina Otieno",
        message: "Welcome email sent successfully to amina.otieno@gmail.com",
        executedAt: daysAgo(1)
      },
      {
        id: randomUUID(),
        ruleId: auto2.id,
        ruleName: auto2.name,
        tenantId,
        status: "success",
        triggerEvent: "trial.completed",
        targetEntityId: null,
        targetEntityName: "Daniel Wekesa",
        message: "WhatsApp follow-up delivered to +254745000004",
        executedAt: daysAgo(2)
      }
    );

    // ── Seed Equipment Assets & Pools ──
    const reformerIds: string[] = [];
    for (let r = 1; r <= 6; r++) {
      const assetId = randomUUID();
      reformerIds.push(assetId);
      const asset: EquipmentAssetResponse = {
        id: assetId,
        tenantId,
        branchId,
        roomId: roomMain.id,
        branchName: "Kilimani",
        roomName: roomMain.name,
        name: `Balanced Body Allegro 2 Reformer #${r}`,
        assetCode: `REF-KLM-0${r}`,
        serialNumber: `BB-ALG2-2025-${100 + r}`,
        modelName: "Allegro 2 with Tower",
        category: "Pilates & Core",
        status: "available",
        purchaseDate: daysAgo(180),
        warrantyEndsAt: daysFrom(540),
        lastServicedAt: daysAgo(30),
        nextServiceDueAt: daysFrom(60),
        lastCalibratedAt: null,
        nextCalibrationDueAt: null,
        notes: "Includes custom footbar, long box and jumpboard attachments.",
        createdAt: daysAgo(180),
        updatedAt: daysAgo(30)
      };
      this.equipmentAssets.set(asset.id, asset);
    }

    // Advanced Diagnostic & Therapy Units
    const inbodyId = randomUUID();
    const inbody: EquipmentAssetResponse = {
      id: inbodyId,
      tenantId,
      branchId,
      roomId: roomMain.id,
      branchName: "Kilimani",
      roomName: roomMain.name,
      name: "InBody 970 High-Precision Body Composition Analyzer",
      assetCode: "DIAG-IB970-01",
      serialNumber: "IB970-KEN-88219",
      modelName: "InBody 970 Multi-Frequency BIA",
      category: "Assessment & Diagnostics",
      status: "available",
      purchaseDate: daysAgo(120),
      warrantyEndsAt: daysFrom(600),
      lastServicedAt: daysAgo(15),
      nextServiceDueAt: daysFrom(75),
      lastCalibratedAt: daysAgo(15),
      nextCalibrationDueAt: daysFrom(165),
      notes: "Calibrated to LookinBody precision standards with multi-frequency analysis.",
      createdAt: daysAgo(120),
      updatedAt: daysAgo(15)
    };
    this.equipmentAssets.set(inbody.id, inbody);

    const forceDecksId = randomUUID();
    const forceDecks: EquipmentAssetResponse = {
      id: forceDecksId,
      tenantId,
      branchId,
      roomId: roomMain.id,
      branchName: "Kilimani",
      roomName: roomMain.name,
      name: "VALD ForceDecks Dual Force Plate System",
      assetCode: "PERF-FD-01",
      serialNumber: "VALD-FD-60032",
      modelName: "ForceDecks Max FD4000",
      category: "Assessment & Diagnostics",
      status: "available",
      purchaseDate: daysAgo(90),
      warrantyEndsAt: daysFrom(630),
      lastServicedAt: daysAgo(20),
      nextServiceDueAt: daysFrom(70),
      lastCalibratedAt: daysAgo(20),
      nextCalibrationDueAt: daysFrom(160),
      notes: "Dual plate wireless force measurement for jump profiling and asymmetry testing.",
      createdAt: daysAgo(90),
      updatedAt: daysAgo(20)
    };
    this.equipmentAssets.set(forceDecks.id, forceDecks);

    const neubieId = randomUUID();
    const neubie: EquipmentAssetResponse = {
      id: neubieId,
      tenantId,
      branchId,
      roomId: roomMain.id,
      branchName: "Kilimani",
      roomName: roomMain.name,
      name: "NEUBIE Direct Current Neuromuscular STIM System",
      assetCode: "THER-NEU-01",
      serialNumber: "NF-NEUBIE-9410",
      modelName: "NeuFit NEUBIE 1st Gen",
      category: "Therapy & Recovery",
      status: "available",
      purchaseDate: daysAgo(150),
      warrantyEndsAt: daysFrom(570),
      lastServicedAt: daysAgo(40),
      nextServiceDueAt: daysFrom(50),
      lastCalibratedAt: daysAgo(40),
      nextCalibrationDueAt: daysFrom(140),
      notes: "Pulsed direct current therapy device for neuromuscular re-education and pain relief.",
      createdAt: daysAgo(150),
      updatedAt: daysAgo(40)
    };
    this.equipmentAssets.set(neubie.id, neubie);

    // Pool
    const poolId = randomUUID();
    this.equipmentPools.set(poolId, {
      id: poolId,
      tenantId,
      branchId,
      branchName: "Kilimani",
      name: "Kilimani Reformer Pilates Pool",
      category: "Pilates & Core",
      totalQuantity: 6,
      availableQuantity: 6,
      assetIds: reformerIds
    });

    // Maintenance logs
    const maint1: EquipmentMaintenanceRecordResponse = {
      id: randomUUID(),
      tenantId,
      assetId: inbody.id,
      assetName: inbody.name,
      type: "calibration",
      performedAt: daysAgo(15),
      performedBy: "Dr. Dennis Kiprop",
      costMinor: 500000,
      notes: "Quarterly precision impedance verification & firmware update 4.2 applied.",
      nextDueAt: daysFrom(165),
      createdAt: daysAgo(15)
    };
    const maint2: EquipmentMaintenanceRecordResponse = {
      id: randomUUID(),
      tenantId,
      assetId: reformerIds[0] ?? randomUUID(),
      assetName: "Balanced Body Allegro 2 Reformer #1",
      type: "inspection",
      performedAt: daysAgo(30),
      performedBy: "FitTech Maintenance Kenya",
      costMinor: 250000,
      notes: "Carriage glide lubrication, spring tension testing, and strap replacement.",
      nextDueAt: daysFrom(60),
      createdAt: daysAgo(30)
    };
    this.equipmentMaintenance.set(maint1.id, maint1);
    this.equipmentMaintenance.set(maint2.id, maint2);

    // ── Seed Inventory & Consumables ──
    const item1: InventoryItemResponse = {
      id: randomUUID(),
      tenantId,
      branchId,
      branchName: "Kilimani",
      sku: "RET-GRIP-01",
      name: "FITOS Non-Slip Grip Socks (Unisex M/L)",
      category: "Apparel & Accessories",
      unit: "pair",
      unitCostMinor: 60000,
      retailPriceMinor: 150000,
      stockOnHand: 45,
      reorderPoint: 15,
      reorderQuantity: 50,
      isRetail: true,
      isConsumable: false,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(5)
    };
    const item2: InventoryItemResponse = {
      id: randomUUID(),
      tenantId,
      branchId,
      branchName: "Kilimani",
      sku: "BEV-ELEC-01",
      name: "HydroFuel Electrolyte Hydration 500ml (Citrus)",
      category: "Nutrition & Hydration",
      unit: "bottle",
      unitCostMinor: 15000,
      retailPriceMinor: 35000,
      stockOnHand: 120,
      reorderPoint: 40,
      reorderQuantity: 100,
      isRetail: true,
      isConsumable: true,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(2)
    };
    const item3: InventoryItemResponse = {
      id: randomUUID(),
      tenantId,
      branchId,
      branchName: "Kilimani",
      sku: "ACC-BAND-05",
      name: "Pro Latex Loop Resistance Band 5-Pack",
      category: "Training Accessories",
      unit: "set",
      unitCostMinor: 100000,
      retailPriceMinor: 250000,
      stockOnHand: 28,
      reorderPoint: 10,
      reorderQuantity: 30,
      isRetail: true,
      isConsumable: false,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(10)
    };
    const item4: InventoryItemResponse = {
      id: randomUUID(),
      tenantId,
      branchId,
      branchName: "Kilimani",
      sku: "CON-IB-WIPE",
      name: "InBody LookinBody Conductive Tissue Wipes (100pk)",
      category: "Assessment Consumables",
      unit: "pack",
      unitCostMinor: 45000,
      retailPriceMinor: 0,
      stockOnHand: 80,
      reorderPoint: 25,
      reorderQuantity: 50,
      isRetail: false,
      isConsumable: true,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(15)
    };
    for (const item of [item1, item2, item3, item4]) {
      this.inventoryItems.set(item.id, item);
    }

    // Movements
    this.inventoryMovements.push(
      {
        id: randomUUID(),
        tenantId,
        branchId,
        itemId: item1.id,
        itemName: item1.name,
        movementType: "purchase_in",
        quantity: 50,
        referenceType: "po",
        referenceId: "PO-2025-001",
        costMinor: 3000000,
        notes: "Initial inventory delivery from East Africa Fitness Supplies",
        recordedByUserId: ownerTenantUserId,
        recordedByName: "Gym Owner",
        recordedAt: daysAgo(60)
      },
      {
        id: randomUUID(),
        tenantId,
        branchId,
        itemId: item1.id,
        itemName: item1.name,
        movementType: "sale_out",
        quantity: -5,
        referenceType: "pos_sale",
        referenceId: null,
        costMinor: null,
        notes: "Front desk POS retail sales to members",
        recordedByUserId: ownerTenantUserId,
        recordedByName: "Gym Owner",
        recordedAt: daysAgo(5)
      }
    );

    // Purchase Order
    const poId = randomUUID();
    this.purchaseOrders.set(poId, {
      id: poId,
      tenantId,
      branchId,
      branchName: "Kilimani",
      poNumber: "PO-2025-001",
      supplierName: "East Africa Fitness Supplies Ltd",
      status: "received",
      items: [
        {
          itemId: item1.id,
          itemName: item1.name,
          quantity: 50,
          unitCostMinor: 60000,
          totalMinor: 3000000
        },
        {
          itemId: item2.id,
          itemName: item2.name,
          quantity: 150,
          unitCostMinor: 15000,
          totalMinor: 2250000
        },
        {
          itemId: item3.id,
          itemName: item3.name,
          quantity: 30,
          unitCostMinor: 100000,
          totalMinor: 3000000
        }
      ],
      totalMinor: 8250000,
      orderedAt: daysAgo(65),
      receivedAt: daysAgo(60),
      notes: "Quarterly stock replenishment for Kilimani branch.",
      createdAt: daysAgo(65),
      updatedAt: daysAgo(60)
    });

    // ── Seed Assessment Definitions & Sessions (FITOS Assess) ──
    const defInBody: AssessmentDefinitionResponse = {
      id: randomUUID(),
      tenantId,
      name: "InBody 970 Multi-Frequency Full Body Composition Scan",
      category: "body_composition",
      description:
        "Direct Segmental Multi-frequency Bioelectrical Impedance Analysis measuring 6 frequencies across 5 body segments.",
      deviceVendor: "lookinbody_inbody",
      metrics: [
        { key: "weightKg", name: "Total Body Weight", unit: "kg", optimalMin: 50, optimalMax: 95 },
        {
          key: "skeletalMuscleMassKg",
          name: "Skeletal Muscle Mass",
          unit: "kg",
          optimalMin: 28,
          optimalMax: 45
        },
        {
          key: "bodyFatPercentage",
          name: "Percent Body Fat",
          unit: "%",
          optimalMin: 12,
          optimalMax: 22
        },
        {
          key: "visceralFatLevel",
          name: "Visceral Fat Level",
          unit: "lvl",
          optimalMin: 1,
          optimalMax: 9
        },
        {
          key: "ecwRatio",
          name: "Extracellular Water Ratio",
          unit: "ratio",
          optimalMin: 0.36,
          optimalMax: 0.39
        },
        {
          key: "bmrKcal",
          name: "Basal Metabolic Rate",
          unit: "kcal",
          optimalMin: 1400,
          optimalMax: 2200
        }
      ],
      isActive: true,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120)
    };

    const defForce: AssessmentDefinitionResponse = {
      id: randomUUID(),
      tenantId,
      name: "VALD ForceDecks Bilateral Countermovement Jump (CMJ)",
      category: "neuromuscular_force",
      description:
        "Dual force plate kinetic analysis for explosive power, eccentric deceleration, and neuromuscular asymmetry.",
      deviceVendor: "vald_forcedecks",
      metrics: [
        {
          key: "jumpHeightCm",
          name: "Jump Height (Flight Time)",
          unit: "cm",
          optimalMin: 35,
          optimalMax: 65
        },
        {
          key: "peakPowerWatts",
          name: "Peak Concentric Power",
          unit: "W",
          optimalMin: 3500,
          optimalMax: 6000
        },
        {
          key: "rsiModified",
          name: "Reactive Strength Index (mRSI)",
          unit: "m/s",
          optimalMin: 0.45,
          optimalMax: 0.85
        },
        {
          key: "concentricAsymmetryPct",
          name: "Concentric Force Asymmetry",
          unit: "%",
          optimalMin: 0,
          optimalMax: 8
        },
        {
          key: "landingAsymmetryPct",
          name: "Landing Impact Asymmetry",
          unit: "%",
          optimalMin: 0,
          optimalMax: 10
        }
      ],
      isActive: true,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120)
    };

    const defVO2: AssessmentDefinitionResponse = {
      id: randomUUID(),
      tenantId,
      name: "VO2 Max & Metabolic Threshold Ramp Protocol",
      category: "cardiovascular_vo2",
      description:
        "Direct breath-by-breath gas exchange spirometry testing aerobic capacity and metabolic crossover points.",
      deviceVendor: "cosmed_k5",
      metrics: [
        {
          key: "vo2MaxMlKgMin",
          name: "Maximal Oxygen Uptake (VO2 Max)",
          unit: "ml/kg/min",
          optimalMin: 42,
          optimalMax: 60
        },
        {
          key: "aerobicThresholdHr",
          name: "Aerobic Threshold (VT1)",
          unit: "bpm",
          optimalMin: 130,
          optimalMax: 155
        },
        {
          key: "anaerobicThresholdHr",
          name: "Anaerobic Threshold (VT2)",
          unit: "bpm",
          optimalMin: 165,
          optimalMax: 185
        },
        {
          key: "maxHeartRateBpm",
          name: "Peak Heart Rate",
          unit: "bpm",
          optimalMin: 175,
          optimalMax: 198
        }
      ],
      isActive: true,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120)
    };

    this.assessmentDefinitions.set(defInBody.id, defInBody);
    this.assessmentDefinitions.set(defForce.id, defForce);
    this.assessmentDefinitions.set(defVO2.id, defVO2);

    // Seed historical sessions for Amina Otieno (storedMembers[0]) and Daniel Wekesa (storedMembers[1])
    const amina = storedMembers[0];
    const daniel = storedMembers[1];
    const aminaContact = amina ? this.contacts.get(amina.contactId) : null;
    const aminaName = aminaContact
      ? `${aminaContact.firstName} ${aminaContact.lastName}`
      : "Amina Otieno";
    const danielContact = daniel ? this.contacts.get(daniel.contactId) : null;
    const danielName = danielContact
      ? `${danielContact.firstName} ${danielContact.lastName}`
      : "Daniel Wekesa";

    if (amina) {
      const sess1: AssessmentSessionResponse = {
        id: randomUUID(),
        tenantId,
        branchId,
        branchName: "Kilimani",
        memberId: amina.id,
        memberName: aminaName,
        assessorStaffId: trainerUserId ?? ownerTenantUserId,
        assessorName: "Dr. Dennis Kiprop",
        definitionId: defInBody.id,
        definitionName: defInBody.name,
        category: "body_composition",
        status: "completed",
        conductedAt: daysAgo(45),
        summary:
          "Baseline InBody scan. Healthy ECW ratio, good muscle distribution with slight right-leg dominance.",
        metrics: {
          weightKg: 64.2,
          skeletalMuscleMassKg: 27.8,
          bodyFatPercentage: 21.4,
          visceralFatLevel: 5,
          ecwRatio: 0.375,
          bmrKcal: 1485
        },
        notes: "Targeting +1.5kg SMM over 8-week periodized hyper-strength block.",
        createdAt: daysAgo(45),
        updatedAt: daysAgo(45)
      };

      const sess2: AssessmentSessionResponse = {
        id: randomUUID(),
        tenantId,
        branchId,
        branchName: "Kilimani",
        memberId: amina.id,
        memberName: aminaName,
        assessorStaffId: trainerUserId ?? ownerTenantUserId,
        assessorName: "Dr. Dennis Kiprop",
        definitionId: defInBody.id,
        definitionName: defInBody.name,
        category: "body_composition",
        status: "completed",
        conductedAt: daysAgo(5),
        summary: "Follow-up scan showing +0.9kg muscle mass gain and 1.2% reduction in body fat.",
        metrics: {
          weightKg: 64.5,
          skeletalMuscleMassKg: 28.7,
          bodyFatPercentage: 20.2,
          visceralFatLevel: 4,
          ecwRatio: 0.372,
          bmrKcal: 1512
        },
        notes: "Excellent progress on nutrition adherence and progressive overload.",
        createdAt: daysAgo(5),
        updatedAt: daysAgo(5)
      };

      const sessForce: AssessmentSessionResponse = {
        id: randomUUID(),
        tenantId,
        branchId,
        branchName: "Kilimani",
        memberId: amina.id,
        memberName: aminaName,
        assessorStaffId: trainerUserId ?? ownerTenantUserId,
        assessorName: "Coach Peter Kamau",
        definitionId: defForce.id,
        definitionName: defForce.name,
        category: "neuromuscular_force",
        status: "completed",
        conductedAt: daysAgo(10),
        summary:
          "Bilateral CMJ force test. 38.2cm jump height with 3.8% concentric symmetry (within elite bounds).",
        metrics: {
          jumpHeightCm: 38.2,
          peakPowerWatts: 4120,
          rsiModified: 0.58,
          concentricAsymmetryPct: 3.8,
          landingAsymmetryPct: 5.2
        },
        notes:
          "Triple extension power is strong. Minimal left-right asymmetry on force absorption.",
        createdAt: daysAgo(10),
        updatedAt: daysAgo(10)
      };

      this.assessmentSessions.set(sess1.id, sess1);
      this.assessmentSessions.set(sess2.id, sess2);
      this.assessmentSessions.set(sessForce.id, sessForce);
    }

    if (daniel) {
      const sessDaniel: AssessmentSessionResponse = {
        id: randomUUID(),
        tenantId,
        branchId,
        branchName: "Kilimani",
        memberId: daniel.id,
        memberName: danielName,
        assessorStaffId: trainerUserId ?? ownerTenantUserId,
        assessorName: "Dr. Dennis Kiprop",
        definitionId: defVO2.id,
        definitionName: defVO2.name,
        category: "cardiovascular_vo2",
        status: "completed",
        conductedAt: daysAgo(14),
        summary: "Full ramp aerobic test. VO2 max reached 52.4 ml/kg/min with VT2 at 172 bpm.",
        metrics: {
          vo2MaxMlKgMin: 52.4,
          aerobicThresholdHr: 144,
          anaerobicThresholdHr: 172,
          maxHeartRateBpm: 191
        },
        notes: "Threshold 2 is solid. Zone 2 training recommended to expand aerobic base.",
        createdAt: daysAgo(14),
        updatedAt: daysAgo(14)
      };
      this.assessmentSessions.set(sessDaniel.id, sessDaniel);
    }

    // ── Seed Therapy & Recovery Modalities & Protocols (FITOS Therapy) ──
    const modNeubie: TherapyModalityResponse = {
      id: randomUUID(),
      tenantId,
      code: "neubie_direct_current",
      name: "NEUBIE Pulsed Direct Current Neuromuscular Stimulation",
      category: "neuromuscular",
      defaultDurationMinutes: 45,
      contraindications: ["Pacemaker", "Pregnancy", "Active DVT / Blood Clots", "Recent seizure"],
      description:
        "Direct current stimulation designed to reset neurological tone, promote tissue regeneration, and accelerate pain-free movement.",
      isActive: true,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120)
    };

    const modAlterG: TherapyModalityResponse = {
      id: randomUUID(),
      tenantId,
      code: "alterg_anti_gravity",
      name: "AlterG Anti-Gravity Treadmill Differential Air Pressure",
      category: "unweighted_gait",
      defaultDurationMinutes: 30,
      contraindications: ["Unstable fracture", "Severe DVT", "Severe open wound at waist"],
      description:
        "NASA-patented differential air pressure system allowing precision bodyweight unloading from 100% down to 20% in 1% increments.",
      isActive: true,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120)
    };

    const modNormatec: TherapyModalityResponse = {
      id: randomUUID(),
      tenantId,
      code: "normatec_compression",
      name: "Normatec 3 Dynamic Air Compression System",
      category: "pneumatic_compression",
      defaultDurationMinutes: 30,
      contraindications: [
        "Acute pulmonary edema",
        "Acute thrombophlebitis",
        "Severe atherosclerosis"
      ],
      description:
        "Biomimicking peristaltic pulse pneumatic compression for rapid lymphatic drainage, venous return, and DOMS reduction.",
      isActive: true,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120)
    };

    this.therapyModalities.set(modNeubie.id, modNeubie);
    this.therapyModalities.set(modAlterG.id, modAlterG);
    this.therapyModalities.set(modNormatec.id, modNormatec);

    // Protocols
    const proto1: TherapyProtocolResponse = {
      id: randomUUID(),
      tenantId,
      modalityCode: "neubie_direct_current",
      modalityName: modNeubie.name,
      name: "Acute Patellar Tendinopathy Neuromuscular Reset",
      indication: "Patellofemoral pain syndrome, jumper's knee, chronic tendinopathy",
      targetArea: "Quadriceps, VMO & Infrapatellar Tendon",
      parameters: {
        frequencyHz: 45,
        intensitymA: 3.8,
        polarity: "positive_proximal",
        durationMinutes: 30
      },
      safetyChecklist: [
        "Verify no metallic implants in knee",
        "Test skin sensation before pulse ramping",
        "Maintain active quad eccentric contraction during pulse"
      ],
      clinicalNotes:
        "Target motor points on vastus medialis and rectus femoris. Apply direct current during active terminal knee extension.",
      isActive: true,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120)
    };

    const proto2: TherapyProtocolResponse = {
      id: randomUUID(),
      tenantId,
      modalityCode: "alterg_anti_gravity",
      modalityName: modAlterG.name,
      name: "Lower Body Return-to-Run (70% BW Unloading)",
      indication: "Post-op meniscus/ACL rehab, bone stress injury return-to-load",
      targetArea: "Lower Extremities & Gait Kinetic Chain",
      parameters: { bodyweightPct: 70, speedKmh: 8.5, inclinePct: 0, durationMinutes: 25 },
      safetyChecklist: [
        "Calibrate air pressure seal",
        "Confirm zero pain at 70% unweighted baseline",
        "Monitor bilateral ground reaction symmetry"
      ],
      clinicalNotes:
        "Assess cadence and heel-strike symmetry. Increase load by 5% every 3 successful pain-free sessions.",
      isActive: true,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120)
    };

    const proto3: TherapyProtocolResponse = {
      id: randomUUID(),
      tenantId,
      modalityCode: "normatec_compression",
      modalityName: modNormatec.name,
      name: "Full-Leg Post-Endurance Recovery Flush (Level 5)",
      indication: "Post-competition recovery, high-volume leg day DOMS prevention",
      targetArea: "Bilateral Lower Limbs (Feet to Hips)",
      parameters: { pressureLevel: 5, zoneHoldTimeSec: 30, durationMinutes: 30 },
      safetyChecklist: [
        "Check for peripheral circulation before session",
        "Ensure zippered sleeves are fully fastened"
      ],
      clinicalNotes:
        "ZoneBoost enabled on calf and hamstring chambers for maximal metabolic clearance.",
      isActive: true,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120)
    };

    this.therapyProtocols.set(proto1.id, proto1);
    this.therapyProtocols.set(proto2.id, proto2);
    this.therapyProtocols.set(proto3.id, proto3);

    // Seed Therapy Sessions
    if (amina) {
      const sessTh1: TherapySessionResponse = {
        id: randomUUID(),
        tenantId,
        branchId,
        branchName: "Kilimani",
        memberId: amina.id,
        memberName: aminaName,
        staffUserId: trainerUserId ?? ownerTenantUserId,
        staffName: "Dr. Dennis Kiprop",
        protocolId: proto1.id,
        protocolName: proto1.name,
        modalityCode: "neubie_direct_current",
        assetId: null,
        assetName: "NEUBIE DC Unit 01",
        status: "completed",
        startedAt: daysAgo(3, 10, 0),
        completedAt: daysAgo(3, 10, 45),
        prePainScore: 6,
        postPainScore: 1,
        actualDosage: { frequencyHz: 45, intensitymA: 3.5, durationMinutes: 30 },
        adverseReaction: false,
        sessionNotes:
          "Patient reported immediate reduction in patellar tendon pressure upon eccentric loading post-session.",
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3)
      };
      this.therapySessions.set(sessTh1.id, sessTh1);
    }

    if (daniel) {
      const sessTh2: TherapySessionResponse = {
        id: randomUUID(),
        tenantId,
        branchId,
        branchName: "Kilimani",
        memberId: daniel.id,
        memberName: danielName,
        staffUserId: trainerUserId ?? ownerTenantUserId,
        staffName: "Coach Peter Kamau",
        protocolId: proto3.id,
        protocolName: proto3.name,
        modalityCode: "normatec_compression",
        assetId: null,
        assetName: "Normatec 3 Leg Sleeves",
        status: "completed",
        startedAt: daysAgo(2, 16, 0),
        completedAt: daysAgo(2, 16, 30),
        prePainScore: 4,
        postPainScore: 0,
        actualDosage: { pressureLevel: 5, durationMinutes: 30 },
        adverseReaction: false,
        sessionNotes: "Post-hyrox training flush. Lower extremity stiffness resolved.",
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2)
      };
      this.therapySessions.set(sessTh2.id, sessTh2);
    }
  }

  private async createDemoTenant(input: {
    tenant: Pick<TenantSummary, "name" | "slug">;
    branch: Pick<BranchResponse, "name" | "slug">;
    owner: { email: string; displayName: string; passwordHash: string };
    staff?: Array<{
      email: string;
      displayName: string;
      roleKey: Exclude<RoleKey, "owner">;
      passwordHash: string;
    }>;
  }): Promise<{
    tenantId: string;
    branchId: string;
    ownerTenantUserId: string;
    trainerUserId: string | null;
  }> {
    const tenantId = randomUUID();
    const tenant: StoredTenant = {
      id: tenantId,
      name: input.tenant.name,
      slug: input.tenant.slug,
      timezone: "Africa/Nairobi",
      currency: "KES",
      status: "active"
    };
    this.tenants.set(tenantId, tenant);
    const timestamp = now();
    const branch: StoredBranch = {
      id: randomUUID(),
      tenantId,
      name: input.branch.name,
      slug: input.branch.slug,
      timezone: null,
      phone: null,
      email: null,
      addressLine1: null,
      addressLine2: null,
      city: "Nairobi",
      countryCode: "KE",
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.branches.set(branch.id, branch);
    const roleByKey = new Map<RoleKey, StoredRole>();
    for (const [key, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS) as Array<
      [RoleKey, readonly PermissionKey[]]
    >) {
      const role: StoredRole = {
        id: randomUUID(),
        tenantId,
        key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        permissions: [...permissions]
      };
      this.roles.set(role.id, role);
      roleByKey.set(key, role);
    }
    const user: StoredUser = {
      id: randomUUID(),
      email: normalizeEmail(input.owner.email),
      displayName: input.owner.displayName,
      status: "active",
      lastLoginAt: null,
      passwordHash: input.owner.passwordHash
    };
    this.users.set(user.id, user);
    const ownerRole = roleByKey.get("owner");
    if (!ownerRole) throw new Error("Owner role unavailable.");
    const tenantUser: StoredTenantUser = {
      id: randomUUID(),
      tenantId,
      userId: user.id,
      roleId: ownerRole.id,
      status: "active"
    };
    this.tenantUsers.set(tenantUser.id, tenantUser);
    this.branchAccess.set(tenantUser.id, new Set([branch.id]));

    let trainerUserId: string | null = null;
    for (const staffInput of input.staff ?? []) {
      const role = roleByKey.get(staffInput.roleKey);
      if (!role) throw new Error(`${staffInput.roleKey} role unavailable.`);
      const staffUser: StoredUser = {
        id: randomUUID(),
        email: normalizeEmail(staffInput.email),
        displayName: staffInput.displayName,
        status: "active",
        lastLoginAt: null,
        passwordHash: staffInput.passwordHash
      };
      this.users.set(staffUser.id, staffUser);
      const staffMembership: StoredTenantUser = {
        id: randomUUID(),
        tenantId,
        userId: staffUser.id,
        roleId: role.id,
        status: "active"
      };
      this.tenantUsers.set(staffMembership.id, staffMembership);
      this.branchAccess.set(staffMembership.id, new Set([branch.id]));
      if (staffInput.roleKey === "trainer") trainerUserId = staffUser.id;
    }
    return { tenantId, branchId: branch.id, ownerTenantUserId: tenantUser.id, trainerUserId };
  }

  async findLoginIdentity(email: string): Promise<LoginIdentity | null> {
    const normalized = normalizeEmail(email);
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === normalized && candidate.status === "active"
    );
    if (!user) return null;
    const tenantUser = [...this.tenantUsers.values()].find(
      (candidate) => candidate.userId === user.id && candidate.status === "active"
    );
    if (!tenantUser) return null;
    const tenant = this.tenants.get(tenantUser.tenantId);
    const role = this.roles.get(tenantUser.roleId);
    if (!tenant || !role) return null;
    const roles = this.rolesForUserTenant(user.id, tenant.id);
    return {
      user: this.toUserSummary(user),
      passwordHash: user.passwordHash,
      tenantUserId: tenantUser.id,
      tenant,
      role: this.toRoleResponse(role),
      roles,
      branchIds: this.resolveBranchIds(tenantUser, role)
    };
  }

  async createSession(input: CreateSessionInput): Promise<{ id: string }> {
    const id = randomUUID();
    this.sessions.set(input.tokenHash, { ...input, id, revokedAt: null });
    return { id };
  }

  async resolveSession(tokenHash: string, currentTime: string): Promise<ResolvedSession | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.revokedAt || session.expiresAt <= currentTime) return null;
    const tenantUser = this.tenantUsers.get(session.tenantUserId);
    const user = this.users.get(session.userId);
    if (!tenantUser || !user || tenantUser.status !== "active" || user.status !== "active")
      return null;
    const tenant = this.tenants.get(tenantUser.tenantId);
    const role = this.roles.get(tenantUser.roleId);
    if (!tenant || !role || tenant.status !== "active") return null;
    const roles = this.rolesForUserTenant(user.id, tenant.id);
    return {
      sessionId: session.id,
      user: this.toUserSummary(user),
      tenantUserId: tenantUser.id,
      tenant,
      role: this.toRoleResponse(role),
      roles,
      branchIds: this.resolveBranchIds(tenantUser, role),
      permissions: [...new Set(roles.flatMap((item) => item.permissions))]
    };
  }

  async revokeSession(tokenHash: string, at: string): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session) session.revokedAt = at;
  }

  async markUserLoggedIn(userId: string, at: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) user.lastLoginAt = at;
  }
  async setUserPassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) user.passwordHash = passwordHash;
  }
  async revokeOtherUserSessions(
    userId: string,
    currentSessionId: string,
    at: string
  ): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.id !== currentSessionId) session.revokedAt = at;
    }
  }
  async listUserSessions(userId: string, nowTime: string) {
    return [...this.sessions.values()]
      .filter(
        (session) => session.userId === userId && !session.revokedAt && session.expiresAt > nowTime
      )
      .map((session) => ({
        id: session.id,
        createdAt: session.expiresAt,
        lastSeenAt: null,
        expiresAt: session.expiresAt,
        userAgentSummary: session.userAgentSummary ?? null,
        current: false
      }));
  }
  async revokeUserSession(userId: string, sessionId: string, at: string) {
    const session = [...this.sessions.values()].find(
      (item) => item.id === sessionId && item.userId === userId
    );
    if (!session || session.revokedAt) return false;
    session.revokedAt = at;
    return true;
  }

  async updateUserProfile(
    userId: string,
    input: import("@fitos/contracts").UpdateUserProfileRequest
  ): Promise<UserSummary | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    if (input.displayName !== undefined) user.displayName = input.displayName.trim();
    if (input.phone !== undefined)
      (user as StoredUser & { phone?: string | null }).phone = input.phone;
    return {
      id: user.id,
      email: user.email,
      phone: (user as StoredUser & { phone?: string | null }).phone ?? null,
      displayName: user.displayName,
      status: user.status,
      lastLoginAt: user.lastLoginAt
    };
  }

  async findTenant(scope: TenantScope): Promise<TenantSummary | null> {
    return this.tenants.get(scope.tenantId) ?? null;
  }

  async updateTenant(scope: TenantScope, input: UpdateOrganizationRequest): Promise<TenantSummary> {
    const tenant = this.requireTenant(scope.tenantId);
    if (input.name !== undefined) tenant.name = input.name;
    if (input.timezone !== undefined) tenant.timezone = input.timezone;
    if (input.currency !== undefined) tenant.currency = input.currency;
    return { ...tenant };
  }

  async listBranches(scope: TenantScope): Promise<BranchResponse[]> {
    return [...this.branches.values()]
      .filter((branch) => branch.tenantId === scope.tenantId && scope.branchIds.includes(branch.id))
      .map((branch) => this.toBranchResponse(branch));
  }

  async listTenantBranches(tenantId: string): Promise<BranchResponse[]> {
    return [...this.branches.values()]
      .filter((branch) => branch.tenantId === tenantId)
      .map((branch) => this.toBranchResponse(branch));
  }

  async findBranchById(scope: TenantScope, branchId: string): Promise<BranchResponse | null> {
    const branch = this.branches.get(branchId);
    if (!branch || branch.tenantId !== scope.tenantId || !scope.branchIds.includes(branchId))
      return null;
    return this.toBranchResponse(branch);
  }

  async createBranch(scope: TenantScope, input: CreateBranchRequest): Promise<BranchResponse> {
    const slug = input.slug ? toSlug(input.slug) : toSlug(input.name);
    if (
      [...this.branches.values()].some(
        (branch) => branch.tenantId === scope.tenantId && branch.slug === slug
      )
    ) {
      throw new Error("Branch slug already exists.");
    }
    const timestamp = now();
    const branch: StoredBranch = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      name: input.name,
      slug,
      timezone: input.timezone ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      countryCode: input.countryCode ?? "KE",
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.branches.set(branch.id, branch);
    this.branchAccess.get(scope.tenantUserId)?.add(branch.id);
    return this.toBranchResponse(branch);
  }

  async updateBranch(
    scope: TenantScope,
    branchId: string,
    input: UpdateBranchRequest
  ): Promise<BranchResponse | null> {
    const branch = this.branches.get(branchId);
    if (!branch || branch.tenantId !== scope.tenantId || !scope.branchIds.includes(branchId))
      return null;
    const slug = input.slug ? toSlug(input.slug) : undefined;
    if (
      slug &&
      [...this.branches.values()].some(
        (candidate) =>
          candidate.id !== branchId &&
          candidate.tenantId === scope.tenantId &&
          candidate.slug === slug
      )
    ) {
      throw new Error("Branch slug already exists.");
    }
    Object.assign(branch, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug ? { slug } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
      ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode ?? "KE" } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: now()
    });
    return this.toBranchResponse(branch);
  }

  async createMember(
    scope: TenantScope,
    input: CreateMemberRequest,
    normalizedPhone: string | null
  ): Promise<MemberResponse> {
    if (!scope.branchIds.includes(input.homeBranchId)) throw new Error("Branch unavailable.");
    const timestamp = now();
    const contact: StoredContact = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      firstName: input.contact.firstName,
      lastName: input.contact.lastName ?? null,
      phone: normalizedPhone,
      email: input.contact.email?.trim().toLowerCase() || null,
      dateOfBirth: input.contact.dateOfBirth ?? null
    };
    this.contacts.set(contact.id, contact);
    const member: StoredMember = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      contactId: contact.id,
      homeBranchId: input.homeBranchId,
      memberNumber: null,
      status: "active",
      joinedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.members.set(member.id, member);
    return this.toMemberResponse(member, contact);
  }

  async findMemberById(scope: TenantScope, memberId: string): Promise<MemberResponse | null> {
    const member = this.members.get(memberId);
    if (
      !member ||
      member.tenantId !== scope.tenantId ||
      (member.homeBranchId && !scope.branchIds.includes(member.homeBranchId))
    )
      return null;
    const contact = this.contacts.get(member.contactId);
    return contact ? this.toMemberResponse(member, contact) : null;
  }

  async searchMembers(
    scope: TenantScope,
    filters: MemberListFilters
  ): Promise<CursorPage<MemberListItem>> {
    if (filters.branchId && !scope.branchIds.includes(filters.branchId))
      return { data: [], page: { nextCursor: null, hasMore: false } };
    const query = filters.query?.trim().toLowerCase();
    const all = [...this.members.values()]
      .filter((member) => member.tenantId === scope.tenantId)
      .filter((member) => !member.homeBranchId || scope.branchIds.includes(member.homeBranchId))
      .filter((member) => !filters.branchId || member.homeBranchId === filters.branchId)
      .filter((member) => !filters.status || member.status === filters.status)
      .map((member) => ({ member, contact: this.contacts.get(member.contactId) }))
      .filter((record): record is { member: StoredMember; contact: StoredContact } =>
        Boolean(record.contact)
      )
      .filter(({ member, contact }) => {
        if (!query) return true;
        return [
          contact.firstName,
          contact.lastName,
          contact.phone,
          contact.email,
          member.memberNumber
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query));
      })
      .sort(
        (a, b) =>
          b.member.createdAt.localeCompare(a.member.createdAt) ||
          b.member.id.localeCompare(a.member.id)
      );
    const cursor = decodeCursor(filters.cursor);
    const afterCursor = cursor
      ? all.filter(
          ({ member }) =>
            member.createdAt < cursor.createdAt ||
            (member.createdAt === cursor.createdAt && member.id < cursor.id)
        )
      : all;
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const selected = afterCursor.slice(0, limit + 1);
    const hasMore = selected.length > limit;
    const data = selected
      .slice(0, limit)
      .map(({ member, contact }) => this.toMemberListItem(member, contact));
    const last = data.at(-1);
    return {
      data,
      page: {
        nextCursor:
          hasMore && last ? encodeCursor({ createdAt: last.updatedAt, id: last.id }) : null,
        hasMore
      }
    };
  }

  async updateMember(
    scope: TenantScope,
    memberId: string,
    input: UpdateMemberRequest,
    normalizedPhone?: string | null
  ): Promise<MemberResponse | null> {
    const member = this.members.get(memberId);
    if (
      !member ||
      member.tenantId !== scope.tenantId ||
      (member.homeBranchId && !scope.branchIds.includes(member.homeBranchId))
    )
      return null;
    if (
      input.homeBranchId !== undefined &&
      input.homeBranchId !== null &&
      !scope.branchIds.includes(input.homeBranchId)
    )
      return null;
    const contact = this.contacts.get(member.contactId);
    if (!contact) return null;
    if (input.contact) {
      if (input.contact.firstName !== undefined) contact.firstName = input.contact.firstName;
      if (input.contact.lastName !== undefined) contact.lastName = input.contact.lastName ?? null;
      if (input.contact.email !== undefined)
        contact.email = input.contact.email?.trim().toLowerCase() || null;
      if (input.contact.dateOfBirth !== undefined)
        contact.dateOfBirth = input.contact.dateOfBirth ?? null;
      if (normalizedPhone !== undefined) contact.phone = normalizedPhone;
    }
    if (input.homeBranchId !== undefined) member.homeBranchId = input.homeBranchId;
    if (input.status !== undefined) member.status = input.status;
    member.updatedAt = now();
    return this.toMemberResponse(member, contact);
  }

  async createLead(
    scope: TenantScope,
    input: CreateLeadRequest,
    normalizedPhone: string | null
  ): Promise<LeadResponse> {
    if (input.branchId && !scope.branchIds.includes(input.branchId))
      throw new Error("Branch unavailable.");
    const timestamp = now();
    const contact: StoredContact = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      firstName: input.contact.firstName,
      lastName: input.contact.lastName ?? null,
      phone: normalizedPhone,
      email: input.contact.email?.trim().toLowerCase() || null,
      dateOfBirth: input.contact.dateOfBirth ?? null
    };
    const lead: StoredLead = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      contactId: contact.id,
      branchId: input.branchId ?? null,
      ownerUserId: input.ownerUserId ?? null,
      interest: input.interest ?? null,
      source: input.source ?? null,
      stage: "new",
      lostReason: null,
      nextFollowUpAt: input.nextFollowUpAt ?? null,
      convertedMemberId: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.contacts.set(contact.id, contact);
    this.leads.set(lead.id, lead);
    return this.toLeadResponse(lead, contact);
  }

  async findLeadById(scope: TenantScope, leadId: string): Promise<LeadResponse | null> {
    const lead = this.leads.get(leadId);
    if (
      !lead ||
      lead.tenantId !== scope.tenantId ||
      (lead.branchId && !scope.branchIds.includes(lead.branchId))
    )
      return null;
    const contact = this.contacts.get(lead.contactId);
    return contact ? this.toLeadResponse(lead, contact) : null;
  }

  async searchLeads(
    scope: TenantScope,
    filters: LeadListFilters
  ): Promise<CursorPage<LeadResponse>> {
    if (filters.branchId && !scope.branchIds.includes(filters.branchId))
      return { data: [], page: { nextCursor: null, hasMore: false } };
    const query = filters.query?.trim().toLowerCase();
    const rows = [...this.leads.values()]
      .filter(
        (lead) =>
          lead.tenantId === scope.tenantId &&
          (!lead.branchId || scope.branchIds.includes(lead.branchId))
      )
      .filter((lead) => !filters.branchId || lead.branchId === filters.branchId)
      .filter((lead) => !filters.stage || lead.stage === filters.stage)
      .map((lead) => ({ lead, contact: this.contacts.get(lead.contactId) }))
      .filter((row): row is { lead: StoredLead; contact: StoredContact } => Boolean(row.contact))
      .filter(
        ({ lead, contact }) =>
          !query ||
          [contact.firstName, contact.lastName, contact.phone, contact.email, lead.interest]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(query))
      )
      .sort(
        (a, b) =>
          b.lead.createdAt.localeCompare(a.lead.createdAt) || b.lead.id.localeCompare(a.lead.id)
      );
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const selected = rows.slice(0, limit + 1);
    const data = selected
      .slice(0, limit)
      .map(({ lead, contact }) => this.toLeadResponse(lead, contact));
    const last = data.at(-1);
    return {
      data,
      page: {
        hasMore: selected.length > limit,
        nextCursor:
          selected.length > limit && last
            ? encodeCursor({ createdAt: last.createdAt, id: last.id })
            : null
      }
    };
  }

  async updateLeadStage(
    scope: TenantScope,
    leadId: string,
    input: UpdateLeadStageRequest,
    _actorUserId: string
  ): Promise<LeadResponse | null> {
    const lead = this.leads.get(leadId);
    if (
      !lead ||
      lead.tenantId !== scope.tenantId ||
      (lead.branchId && !scope.branchIds.includes(lead.branchId))
    )
      return null;
    lead.stage = input.stage;
    lead.lostReason = input.stage === "lost" ? (input.lostReason ?? null) : null;
    lead.updatedAt = now();
    const contact = this.contacts.get(lead.contactId);
    return contact ? this.toLeadResponse(lead, contact) : null;
  }

  async convertLead(
    scope: TenantScope,
    leadId: string,
    _actorUserId: string
  ): Promise<LeadConversionResponse | null> {
    const lead = this.leads.get(leadId);
    if (
      !lead ||
      lead.tenantId !== scope.tenantId ||
      (lead.branchId && !scope.branchIds.includes(lead.branchId))
    )
      return null;
    const contact = this.contacts.get(lead.contactId);
    if (!contact) return null;
    const existing = [...this.members.values()].find(
      (member) => member.tenantId === scope.tenantId && member.contactId === contact.id
    );
    const timestamp = now();
    const member = existing ?? {
      id: randomUUID(),
      tenantId: scope.tenantId,
      contactId: contact.id,
      homeBranchId: lead.branchId,
      memberNumber: null,
      status: "active" as const,
      joinedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (!existing) this.members.set(member.id, member);
    lead.convertedMemberId = member.id;
    lead.stage = "joined";
    lead.lostReason = null;
    lead.updatedAt = timestamp;
    return {
      lead: this.toLeadResponse(lead, contact),
      member: this.toMemberResponse(member, contact),
      alreadyConverted: Boolean(existing)
    };
  }

  async addLeadNote(
    scope: TenantScope,
    leadId: string,
    body: string,
    actorUserId: string
  ): Promise<LeadNoteResponse | null> {
    if (!(await this.findLeadById(scope, leadId))) return null;
    const note: StoredLeadNote = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      leadId,
      body,
      createdByUserId: actorUserId,
      createdAt: now()
    };
    this.leadNotes.set(note.id, note);
    return this.noteResponse(note);
  }

  async listLeadNotes(scope: TenantScope, leadId: string): Promise<LeadNoteResponse[]> {
    if (!(await this.findLeadById(scope, leadId))) return [];
    return [...this.leadNotes.values()]
      .filter((note) => note.tenantId === scope.tenantId && note.leadId === leadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((note) => this.noteResponse(note));
  }

  async createLeadTask(
    scope: TenantScope,
    leadId: string,
    input: CreateLeadTaskRequest
  ): Promise<LeadTaskResponse | null> {
    if (!(await this.findLeadById(scope, leadId))) return null;
    const task: StoredLeadTask = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      leadId,
      body: input.body,
      dueAt: input.dueAt ?? null,
      assigneeUserId: input.assigneeUserId ?? null,
      completedAt: null,
      createdAt: now()
    };
    this.leadTasks.set(task.id, task);
    return this.taskResponse(task);
  }

  async listLeadTasks(scope: TenantScope, leadId: string): Promise<LeadTaskResponse[]> {
    if (!(await this.findLeadById(scope, leadId))) return [];
    return [...this.leadTasks.values()]
      .filter((task) => task.tenantId === scope.tenantId && task.leadId === leadId)
      .sort((a, b) => (a.dueAt ?? a.createdAt).localeCompare(b.dueAt ?? b.createdAt))
      .map((task) => this.taskResponse(task));
  }

  async completeLeadTask(
    scope: TenantScope,
    leadId: string,
    taskId: string
  ): Promise<LeadTaskResponse | null> {
    const task = this.leadTasks.get(taskId);
    if (
      !task ||
      task.tenantId !== scope.tenantId ||
      task.leadId !== leadId ||
      !(await this.findLeadById(scope, leadId))
    )
      return null;
    task.completedAt = task.completedAt ?? now();
    return this.taskResponse(task);
  }

  async listServices(scope: TenantScope): Promise<ServiceResponse[]> {
    return [...this.services.values()]
      .filter(
        (service) =>
          service.tenantId === scope.tenantId &&
          (!service.branchId || scope.branchIds.includes(service.branchId))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findServiceById(scope: TenantScope, serviceId: string): Promise<ServiceResponse | null> {
    const service = this.services.get(serviceId);
    return service &&
      service.tenantId === scope.tenantId &&
      (!service.branchId || scope.branchIds.includes(service.branchId))
      ? { ...service, price: service.price ? { ...service.price } : null }
      : null;
  }

  async createService(scope: TenantScope, input: CreateServiceRequest): Promise<ServiceResponse> {
    if (input.branchId && !scope.branchIds.includes(input.branchId))
      throw new Error("Branch unavailable.");
    const timestamp = now();
    const service: StoredService = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId ?? null,
      name: input.name,
      slug: input.slug || toSlug(input.name),
      serviceType: input.serviceType,
      durationMinutes: input.durationMinutes,
      defaultCapacity: input.defaultCapacity ?? null,
      creditsRequired: input.creditsRequired ?? 0,
      cancellationCutoffMinutes: input.cancellationCutoffMinutes ?? 0,
      restoreCreditOnLateCancel: input.restoreCreditOnLateCancel ?? false,
      bookingWindowHours: input.bookingWindowHours ?? null,
      price: input.price ?? null,
      publicVisible: input.publicVisible ?? false,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (
      [...this.services.values()].some(
        (item) =>
          item.tenantId === service.tenantId &&
          item.branchId === service.branchId &&
          item.slug === service.slug
      )
    )
      throw new Error("service slug already exists");
    this.services.set(service.id, service);
    return { ...service, price: service.price ? { ...service.price } : null };
  }

  async updateService(
    scope: TenantScope,
    serviceId: string,
    input: UpdateServiceRequest
  ): Promise<ServiceResponse | null> {
    const service = this.services.get(serviceId);
    if (
      !service ||
      service.tenantId !== scope.tenantId ||
      (service.branchId && !scope.branchIds.includes(service.branchId))
    )
      return null;
    const slug = input.slug ?? service.slug;
    if (
      [...this.services.values()].some(
        (item) =>
          item.id !== service.id &&
          item.tenantId === service.tenantId &&
          item.branchId === service.branchId &&
          item.slug === slug
      )
    )
      throw new Error("service slug already exists");
    Object.assign(service, input, { slug, updatedAt: now() });
    return { ...service, price: service.price ? { ...service.price } : null };
  }

  async listRooms(scope: TenantScope, branchId?: string): Promise<RoomResponse[]> {
    if (branchId && !scope.branchIds.includes(branchId)) return [];
    return [...this.rooms.values()]
      .filter(
        (room) =>
          room.tenantId === scope.tenantId &&
          scope.branchIds.includes(room.branchId) &&
          (!branchId || room.branchId === branchId)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findRoomById(scope: TenantScope, roomId: string): Promise<RoomResponse | null> {
    const room = this.rooms.get(roomId);
    return room && room.tenantId === scope.tenantId && scope.branchIds.includes(room.branchId)
      ? { ...room }
      : null;
  }

  async createRoom(scope: TenantScope, input: CreateRoomRequest): Promise<RoomResponse> {
    if (!scope.branchIds.includes(input.branchId)) throw new Error("Branch unavailable.");
    if (
      [...this.rooms.values()].some(
        (room) =>
          room.tenantId === scope.tenantId &&
          room.branchId === input.branchId &&
          room.name.toLowerCase() === input.name.toLowerCase()
      )
    )
      throw new Error("room name already exists");
    const timestamp = now();
    const room: StoredRoom = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId,
      name: input.name,
      capacity: input.capacity ?? null,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.rooms.set(room.id, room);
    return { ...room };
  }

  async updateRoom(
    scope: TenantScope,
    roomId: string,
    input: UpdateRoomRequest
  ): Promise<RoomResponse | null> {
    const room = this.rooms.get(roomId);
    if (!room || room.tenantId !== scope.tenantId || !scope.branchIds.includes(room.branchId)) {
      return null;
    }
    const nextName = input.name ?? room.name;
    if (
      [...this.rooms.values()].some(
        (candidate) =>
          candidate.id !== room.id &&
          candidate.tenantId === room.tenantId &&
          candidate.branchId === room.branchId &&
          candidate.name.toLowerCase() === nextName.toLowerCase()
      )
    ) {
      throw new Error("room name already exists");
    }
    if (input.name !== undefined) room.name = input.name;
    if (input.capacity !== undefined) room.capacity = input.capacity;
    if (input.isActive !== undefined) room.isActive = input.isActive;
    room.updatedAt = now();
    return { ...room };
  }

  async createScheduleTemplate(
    scope: TenantScope,
    input: CreateScheduleTemplateRequest,
    occurrences: CreateScheduleOccurrenceRequest[],
    materializedThrough: string
  ): Promise<ScheduleTemplateMutationResponse> {
    this.assertOccurrenceDraftsNoConflict(scope, occurrences);
    const timestamp = now();
    const template: StoredScheduleTemplate = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId,
      serviceId: input.serviceId,
      trainerUserId: input.trainerUserId ?? null,
      roomId: input.roomId ?? null,
      timezone: input.timezone,
      daysOfWeek: [...input.daysOfWeek],
      localStartTime: input.localStartTime,
      durationMinutes: input.durationMinutes,
      capacity: input.capacity,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate ?? null,
      materializedThrough,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const created = occurrences.map((occurrence) =>
      this.storeOccurrence(scope, occurrence, template.id, timestamp)
    );
    this.scheduleTemplates.set(template.id, template);
    return { template: this.scheduleTemplateResponse(template), occurrences: created };
  }

  async findScheduleTemplateById(
    scope: TenantScope,
    templateId: string
  ): Promise<ScheduleTemplateResponse | null> {
    const template = this.scheduleTemplates.get(templateId);
    return template &&
      template.tenantId === scope.tenantId &&
      scope.branchIds.includes(template.branchId)
      ? this.scheduleTemplateResponse(template)
      : null;
  }

  async listScheduleTemplates(
    scope: TenantScope,
    branchId?: string
  ): Promise<ScheduleTemplateResponse[]> {
    if (branchId && !scope.branchIds.includes(branchId)) return [];
    return [...this.scheduleTemplates.values()]
      .filter(
        (template) =>
          template.tenantId === scope.tenantId &&
          scope.branchIds.includes(template.branchId) &&
          (!branchId || template.branchId === branchId)
      )
      .sort((a, b) => a.localStartTime.localeCompare(b.localStartTime))
      .map((template) => this.scheduleTemplateResponse(template));
  }

  async materializeScheduleTemplate(
    scope: TenantScope,
    templateId: string,
    occurrences: CreateScheduleOccurrenceRequest[],
    materializedThrough: string
  ): Promise<ScheduleTemplateMutationResponse | null> {
    const template = this.scheduleTemplates.get(templateId);
    if (
      !template ||
      template.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(template.branchId)
    ) {
      return null;
    }
    const existingStarts = new Set(
      [...this.occurrences.values()]
        .filter((occurrence) => occurrence.templateId === templateId)
        .map((occurrence) => occurrence.startsAt)
    );
    const newOccurrences = occurrences.filter(
      (occurrence) => !existingStarts.has(new Date(occurrence.startsAt).toISOString())
    );
    this.assertOccurrenceDraftsNoConflict(scope, newOccurrences);
    const timestamp = now();
    const created = newOccurrences.map((occurrence) =>
      this.storeOccurrence(scope, occurrence, template.id, timestamp)
    );
    template.materializedThrough =
      template.materializedThrough && template.materializedThrough > materializedThrough
        ? template.materializedThrough
        : materializedThrough;
    template.updatedAt = timestamp;
    return { template: this.scheduleTemplateResponse(template), occurrences: created };
  }

  async createScheduleOccurrence(
    scope: TenantScope,
    input: CreateScheduleOccurrenceRequest
  ): Promise<ScheduleOccurrenceResponse> {
    if (!scope.branchIds.includes(input.branchId)) throw new Error("Branch unavailable.");
    const service = await this.findServiceById(scope, input.serviceId);
    if (!service || (service.branchId && service.branchId !== input.branchId))
      throw new Error("Service unavailable.");
    if (input.roomId) {
      const room = await this.findRoomById(scope, input.roomId);
      if (!room || room.branchId !== input.branchId || !room.isActive)
        throw new Error("Room unavailable.");
    }
    if (input.trainerUserId && !(await this.findStaffByUserId(scope, input.trainerUserId)))
      throw new Error("Trainer unavailable.");
    this.assertOccurrenceDraftsNoConflict(scope, [input]);
    return this.storeOccurrence(scope, input, null, now());
  }

  async findScheduleOccurrenceById(
    scope: TenantScope,
    occurrenceId: string
  ): Promise<ScheduleOccurrenceResponse | null> {
    const occurrence = this.occurrences.get(occurrenceId);
    return occurrence &&
      occurrence.tenantId === scope.tenantId &&
      scope.branchIds.includes(occurrence.branchId)
      ? this.occurrenceResponse(occurrence)
      : null;
  }

  async listScheduleOccurrences(
    scope: TenantScope,
    filters: ScheduleOccurrenceFilters
  ): Promise<CursorPage<ScheduleOccurrenceResponse>> {
    if (filters.branchId && !scope.branchIds.includes(filters.branchId))
      return { data: [], page: { hasMore: false, nextCursor: null } };
    const rows = [...this.occurrences.values()]
      .filter((item) => item.tenantId === scope.tenantId && scope.branchIds.includes(item.branchId))
      .filter((item) => !filters.branchId || item.branchId === filters.branchId)
      .filter((item) => !filters.serviceId || item.serviceId === filters.serviceId)
      .filter((item) => !filters.trainerUserId || item.trainerUserId === filters.trainerUserId)
      .filter((item) => !filters.roomId || item.roomId === filters.roomId)
      .filter((item) => !filters.status || item.status === filters.status)
      .filter((item) => !filters.startsAfter || item.startsAt >= filters.startsAfter)
      .filter((item) => !filters.endsBefore || item.endsAt <= filters.endsBefore)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const selected = rows.slice(0, limit + 1);
    return {
      data: selected.slice(0, limit).map((item) => this.occurrenceResponse(item)),
      page: { hasMore: selected.length > limit, nextCursor: null }
    };
  }

  async cancelScheduleOccurrence(
    scope: TenantScope,
    occurrenceId: string,
    reason: string,
    actorUserId = scope.userId
  ): Promise<ScheduleOccurrenceResponse | null> {
    const occurrence = this.occurrences.get(occurrenceId);
    if (
      !occurrence ||
      occurrence.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(occurrence.branchId)
    )
      return null;
    occurrence.status = "cancelled";
    occurrence.cancellationReason = reason;
    occurrence.updatedAt = now();
    if (occurrence.templateId) {
      const key = `${occurrence.id}:cancelled`;
      if (!this.scheduleExceptions.has(key)) {
        this.scheduleExceptions.set(key, {
          id: randomUUID(),
          tenantId: scope.tenantId,
          templateId: occurrence.templateId,
          occurrenceId: occurrence.id,
          exceptionType: "cancelled",
          reason,
          originalStartsAt: occurrence.startsAt,
          createdByUserId: actorUserId,
          createdAt: now()
        });
      }
    }
    return this.occurrenceResponse(occurrence);
  }

  async overrideScheduleOccurrence(
    scope: TenantScope,
    occurrenceId: string,
    input: OverrideScheduleOccurrenceRequest,
    actorUserId: string
  ): Promise<ScheduleOccurrenceResponse | null> {
    const occurrence = this.occurrences.get(occurrenceId);
    if (
      !occurrence ||
      !occurrence.templateId ||
      occurrence.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(occurrence.branchId)
    ) {
      return null;
    }
    const exceptionKey = `${occurrence.id}:overridden`;
    if (this.scheduleExceptions.has(exceptionKey))
      throw new Error("Occurrence already overridden.");
    const draft: CreateScheduleOccurrenceRequest = {
      branchId: occurrence.branchId,
      serviceId: occurrence.serviceId,
      trainerUserId:
        input.trainerUserId === undefined ? occurrence.trainerUserId : input.trainerUserId,
      roomId: input.roomId === undefined ? occurrence.roomId : input.roomId,
      startsAt: input.startsAt ?? occurrence.startsAt,
      endsAt: input.endsAt ?? occurrence.endsAt,
      capacity: input.capacity ?? occurrence.capacity
    };
    const activeBookingCount = [...this.bookings.values()].filter(
      (booking) => booking.occurrenceId === occurrence.id && booking.status === "confirmed"
    ).length;
    if (draft.capacity < activeBookingCount) {
      throw new Error("Capacity cannot be lower than confirmed bookings.");
    }
    this.assertOccurrenceDraftsNoConflict(scope, [draft], occurrence.id);
    this.scheduleExceptions.set(exceptionKey, {
      id: randomUUID(),
      tenantId: scope.tenantId,
      templateId: occurrence.templateId,
      occurrenceId: occurrence.id,
      exceptionType: "overridden",
      reason: input.reason,
      originalStartsAt: occurrence.startsAt,
      createdByUserId: actorUserId,
      createdAt: now()
    });
    occurrence.trainerUserId = draft.trainerUserId ?? null;
    occurrence.roomId = draft.roomId ?? null;
    occurrence.startsAt = new Date(draft.startsAt).toISOString();
    occurrence.endsAt = new Date(draft.endsAt).toISOString();
    occurrence.capacity = draft.capacity;
    occurrence.updatedAt = now();
    return this.occurrenceResponse(occurrence);
  }

  async createBooking(
    scope: TenantScope,
    input: CreateBookingRequest,
    actorUserId: string,
    allowEntitlementOverride: boolean
  ): Promise<BookingResponse> {
    const occurrence = this.occurrences.get(input.occurrenceId);
    if (
      !occurrence ||
      occurrence.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(occurrence.branchId) ||
      occurrence.status !== "scheduled"
    )
      throw new Error("Occurrence unavailable.");
    const member = this.members.get(input.memberId);
    if (!member || member.tenantId !== scope.tenantId || member.status !== "active")
      throw new Error("Member unavailable.");
    const activeBookings = [...this.bookings.values()].filter(
      (booking) =>
        booking.tenantId === scope.tenantId &&
        booking.occurrenceId === occurrence.id &&
        booking.status === "confirmed"
    );
    const service = this.services.get(occurrence.serviceId);
    if (!service || service.tenantId !== scope.tenantId) throw new Error("Service unavailable.");

    if (activeBookings.length >= (occurrence.effectiveCapacity ?? occurrence.capacity)) {
      throw new Error("Occurrence is full.");
    }
    const creditsRequired = service.creditsRequired;
    const eligibleMemberships = [...this.memberMemberships.values()]
      .filter(
        (membership) =>
          membership.tenantId === scope.tenantId &&
          membership.memberId === input.memberId &&
          membership.status === "active" &&
          membership.startsAt <= occurrence.startsAt &&
          (!membership.endsAt || membership.endsAt > occurrence.startsAt) &&
          (!membership.planSnapshot.branchId ||
            membership.planSnapshot.branchId === occurrence.branchId)
      )
      .sort((a, b) => (a.endsAt ?? "9999").localeCompare(b.endsAt ?? "9999"));
    const creditMembership = eligibleMemberships.find((membership) => {
      const balance = [...this.creditLedger.values()]
        .filter((entry) => entry.membershipId === membership.id)
        .reduce((total, entry) => total + entry.delta, 0);
      return balance >= creditsRequired;
    });
    if (creditsRequired > 0 && !creditMembership && !allowEntitlementOverride) {
      throw new Error("Insufficient credits for this service.");
    }
    const timestamp = now();
    const booking: StoredBooking = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: occurrence.branchId,
      occurrenceId: occurrence.id,
      memberId: input.memberId,
      status: "confirmed",
      source: input.source ?? "staff",
      bookedAt: timestamp,
      cancelledAt: null,
      cancellationReason: null,
      creditMembershipId: creditMembership?.id ?? null,
      creditsDebited: creditMembership ? creditsRequired : 0,
      entitlementOverrideReason:
        creditsRequired > 0 && !creditMembership ? (input.overrideReason ?? null) : null,
      lateCancelled: false,
      createdByUserId: actorUserId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.bookings.set(booking.id, booking);
    if (creditMembership && creditsRequired > 0) {
      const entry: StoredCreditLedgerEntry = {
        id: randomUUID(),
        tenantId: scope.tenantId,
        membershipId: creditMembership.id,
        memberId: booking.memberId,
        delta: -creditsRequired,
        reason: "booking",
        bookingId: booking.id,
        note: `Booking credit deduction (${creditsRequired})`,
        createdAt: timestamp
      };
      this.creditLedger.set(entry.id, entry);
    }
    return { ...booking };
  }

  async findBookingById(scope: TenantScope, bookingId: string): Promise<BookingResponse | null> {
    const booking = this.bookings.get(bookingId);
    return booking &&
      booking.tenantId === scope.tenantId &&
      scope.branchIds.includes(booking.branchId)
      ? { ...booking }
      : null;
  }

  async listBookings(
    scope: TenantScope,
    filters: BookingListFilters
  ): Promise<CursorPage<BookingResponse>> {
    const rows = [...this.bookings.values()]
      .filter(
        (booking) =>
          booking.tenantId === scope.tenantId && scope.branchIds.includes(booking.branchId)
      )
      .filter((booking) => !filters.occurrenceId || booking.occurrenceId === filters.occurrenceId)
      .filter((booking) => !filters.memberId || booking.memberId === filters.memberId)
      .filter((booking) => !filters.status || booking.status === filters.status)
      .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt) || b.id.localeCompare(a.id));
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const selected = rows.slice(0, limit + 1);
    return {
      data: selected.slice(0, limit).map((booking) => ({
        ...booking,
        serviceName: this.services.get(this.occurrences.get(booking.occurrenceId)?.serviceId ?? "")
          ?.name
      })),
      page: { hasMore: selected.length > limit, nextCursor: null }
    };
  }

  async cancelBooking(
    scope: TenantScope,
    bookingId: string,
    reason: string
  ): Promise<BookingResponse | null> {
    const booking = this.bookings.get(bookingId);
    if (
      !booking ||
      booking.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(booking.branchId)
    )
      return null;
    if (booking.status === "cancelled") return { ...booking };
    const occurrence = this.occurrences.get(booking.occurrenceId);
    const service = occurrence ? this.services.get(occurrence.serviceId) : undefined;
    if (!occurrence || !service) throw new Error("Booking service unavailable.");
    const cutoffAt =
      new Date(occurrence.startsAt).getTime() - service.cancellationCutoffMinutes * 60_000;
    const lateCancelled = Date.now() >= cutoffAt;
    const restoreCredit =
      booking.creditsDebited > 0 && (!lateCancelled || service.restoreCreditOnLateCancel);
    booking.status = "cancelled";
    booking.cancelledAt = now();
    booking.cancellationReason = reason;
    booking.lateCancelled = lateCancelled;
    booking.updatedAt = booking.cancelledAt;
    if (
      restoreCredit &&
      booking.creditMembershipId &&
      ![...this.creditLedger.values()].some(
        (entry) => entry.bookingId === booking.id && entry.reason === "cancellation"
      )
    ) {
      const entry: StoredCreditLedgerEntry = {
        id: randomUUID(),
        tenantId: scope.tenantId,
        membershipId: booking.creditMembershipId,
        memberId: booking.memberId,
        delta: booking.creditsDebited,
        reason: "cancellation",
        bookingId: booking.id,
        note: `Booking cancellation credit restoration (${booking.creditsDebited})`,
        createdAt: booking.cancelledAt
      };
      this.creditLedger.set(entry.id, entry);
    }
    return { ...booking };
  }

  async listMembershipPlans(
    scope: TenantScope,
    branchId?: string
  ): Promise<MembershipPlanResponse[]> {
    return [...this.membershipPlans.values()]
      .filter((p) => p.tenantId === scope.tenantId)
      .filter(() => scope.branchIds.length > 0)
      .filter((p) => !p.branchId || scope.branchIds.includes(p.branchId))
      .filter((p) => !branchId || !p.branchId || p.branchId === branchId)
      .map((p) => ({ ...p }));
  }

  async findMembershipPlanById(
    scope: TenantScope,
    planId: string
  ): Promise<MembershipPlanResponse | null> {
    const plan = this.membershipPlans.get(planId);
    return plan &&
      plan.tenantId === scope.tenantId &&
      scope.branchIds.length > 0 &&
      (!plan.branchId || scope.branchIds.includes(plan.branchId))
      ? { ...plan }
      : null;
  }

  async createMembershipPlan(
    scope: TenantScope,
    input: CreateMembershipPlanRequest
  ): Promise<MembershipPlanResponse> {
    if (input.includedCredits <= 0) {
      throw new Error("Membership plan must grant at least one credit.");
    }
    if (input.branchId && !scope.branchIds.includes(input.branchId)) {
      throw new Error("Membership plan branch is not accessible.");
    }
    const timestamp = now();
    const plan: StoredMembershipPlan = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId ?? null,
      name: input.name,
      slug: input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      price: input.price ?? null,
      durationDays: input.durationDays ?? null,
      includedCredits: input.includedCredits,
      includedServiceIds: input.includedServiceIds ?? null,
      publicVisible: input.publicVisible ?? false,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.membershipPlans.set(plan.id, plan);
    return { ...plan };
  }

  async updateMembershipPlan(
    scope: TenantScope,
    planId: string,
    input: Partial<CreateMembershipPlanRequest> & { isActive?: boolean }
  ): Promise<MembershipPlanResponse | null> {
    const plan = this.membershipPlans.get(planId);
    if (
      !plan ||
      plan.tenantId !== scope.tenantId ||
      (plan.branchId !== null && !scope.branchIds.includes(plan.branchId))
    ) {
      return null;
    }
    if (input.includedCredits !== undefined && input.includedCredits <= 0) {
      throw new Error("Membership plan must grant at least one credit.");
    }
    if (input.branchId && !scope.branchIds.includes(input.branchId)) {
      throw new Error("Membership plan branch is not accessible.");
    }
    if (input.name !== undefined) plan.name = input.name;
    if (input.slug !== undefined) plan.slug = input.slug;
    if (input.branchId !== undefined) plan.branchId = input.branchId;
    if (input.price !== undefined) plan.price = input.price;
    if (input.durationDays !== undefined) plan.durationDays = input.durationDays;
    if (input.includedCredits !== undefined) plan.includedCredits = input.includedCredits;
    if (input.includedServiceIds !== undefined) plan.includedServiceIds = input.includedServiceIds;
    if (input.publicVisible !== undefined) plan.publicVisible = input.publicVisible;
    if (input.isActive !== undefined) plan.isActive = input.isActive;
    plan.updatedAt = now();
    return { ...plan };
  }

  async listMemberMemberships(
    scope: TenantScope,
    memberId: string
  ): Promise<MemberMembershipResponse[]> {
    return [...this.memberMemberships.values()]
      .filter((m) => m.tenantId === scope.tenantId && m.memberId === memberId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => ({ ...m }));
  }

  async findMemberMembershipById(
    scope: TenantScope,
    membershipId: string
  ): Promise<MemberMembershipResponse | null> {
    const membership = this.memberMemberships.get(membershipId);
    return membership && membership.tenantId === scope.tenantId ? { ...membership } : null;
  }

  async activateMembership(
    scope: TenantScope,
    input: ActivateMembershipRequest,
    _actorUserId?: string
  ): Promise<{ membership: MemberMembershipResponse; ledgerEntry: CreditLedgerEntryResponse }> {
    const plan = this.membershipPlans.get(input.planId);
    if (
      !plan ||
      plan.tenantId !== scope.tenantId ||
      scope.branchIds.length === 0 ||
      !plan.isActive ||
      (plan.branchId !== null && !scope.branchIds.includes(plan.branchId))
    ) {
      throw new Error("Membership plan not found.");
    }
    if (plan.includedCredits <= 0) {
      throw new Error("Membership plan must grant at least one credit.");
    }
    const member = this.members.get(input.memberId);
    if (
      !member ||
      member.tenantId !== scope.tenantId ||
      member.status !== "active" ||
      (member.homeBranchId !== null && !scope.branchIds.includes(member.homeBranchId))
    ) {
      throw new Error("Member not found.");
    }
    const timestamp = now();
    const startsAt = input.startsAt ?? timestamp;
    let endsAt: string | null = null;
    if (plan.durationDays) {
      const startMs = new Date(startsAt).getTime();
      endsAt = new Date(startMs + plan.durationDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const membership: StoredMemberMembership = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      memberId: input.memberId,
      planId: plan.id,
      planSnapshot: { ...plan, price: plan.price ? { ...plan.price } : null },
      status: "active",
      startsAt,
      endsAt,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.memberMemberships.set(membership.id, membership);

    const ledgerEntry: StoredCreditLedgerEntry = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      membershipId: membership.id,
      memberId: input.memberId,
      delta: plan.includedCredits,
      reason: "purchase",
      bookingId: null,
      note: `Membership activated: ${plan.name}`,
      createdAt: timestamp
    };
    this.creditLedger.set(ledgerEntry.id, ledgerEntry);

    return { membership: { ...membership }, ledgerEntry: { ...ledgerEntry } };
  }

  async cancelMembership(
    scope: TenantScope,
    membershipId: string,
    _reason?: string
  ): Promise<MemberMembershipResponse | null> {
    const membership = this.memberMemberships.get(membershipId);
    if (!membership || membership.tenantId !== scope.tenantId) return null;
    membership.status = "cancelled";
    membership.updatedAt = now();
    return { ...membership };
  }

  async holdMembership(
    scope: TenantScope,
    membershipId: string
  ): Promise<MemberMembershipResponse | null> {
    const membership = this.memberMemberships.get(membershipId);
    if (!membership || membership.tenantId !== scope.tenantId || membership.status !== "active")
      return null;
    membership.status = "paused";
    membership.updatedAt = now();
    return { ...membership };
  }

  async resumeMembership(
    scope: TenantScope,
    membershipId: string
  ): Promise<MemberMembershipResponse | null> {
    const membership = this.memberMemberships.get(membershipId);
    if (!membership || membership.tenantId !== scope.tenantId || membership.status !== "paused")
      return null;
    membership.status = "active";
    membership.updatedAt = now();
    return { ...membership };
  }

  async renewMembership(
    scope: TenantScope,
    membershipId: string
  ): Promise<{
    membership: MemberMembershipResponse;
    ledgerEntry: CreditLedgerEntryResponse;
  } | null> {
    const membership = this.memberMemberships.get(membershipId);
    if (
      !membership ||
      membership.tenantId !== scope.tenantId ||
      !["active", "paused", "expired"].includes(membership.status)
    )
      return null;
    const plan = this.membershipPlans.get(membership.planId ?? "");
    if (
      !plan ||
      !plan.isActive ||
      (plan.branchId !== null && !scope.branchIds.includes(plan.branchId))
    )
      return null;
    const timestamp = now();
    const base =
      membership.endsAt && new Date(membership.endsAt) > new Date(timestamp)
        ? new Date(membership.endsAt)
        : new Date(timestamp);
    membership.startsAt = base.toISOString();
    membership.endsAt = plan.durationDays
      ? new Date(base.getTime() + plan.durationDays * 86400000).toISOString()
      : null;
    membership.status = "active";
    membership.updatedAt = timestamp;
    const ledgerEntry: StoredCreditLedgerEntry = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      membershipId,
      memberId: membership.memberId,
      delta: plan.includedCredits,
      reason: "purchase",
      bookingId: null,
      note: `Membership renewed: ${plan.name}`,
      createdAt: timestamp
    };
    this.creditLedger.set(ledgerEntry.id, ledgerEntry);
    return { membership: { ...membership }, ledgerEntry: { ...ledgerEntry } };
  }

  async listCreditLedger(
    scope: TenantScope,
    memberId: string
  ): Promise<CreditLedgerEntryResponse[]> {
    return [...this.creditLedger.values()]
      .filter((e) => e.tenantId === scope.tenantId && e.memberId === memberId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ tenantId: _, ...entry }) => entry);
  }

  async getCreditBalance(scope: TenantScope, memberId: string): Promise<number> {
    const entries = [...this.creditLedger.values()].filter(
      (e) => e.tenantId === scope.tenantId && e.memberId === memberId
    );
    return entries.reduce((sum, e) => sum + e.delta, 0);
  }

  async adjustCredit(
    scope: TenantScope,
    memberId: string,
    input: ManualCreditAdjustmentRequest,
    _actorUserId: string
  ): Promise<CreditLedgerEntryResponse> {
    const membership = this.memberMemberships.get(input.membershipId);
    if (
      !membership ||
      membership.tenantId !== scope.tenantId ||
      membership.memberId !== memberId ||
      membership.status !== "active" ||
      (membership.planSnapshot.branchId !== null &&
        !scope.branchIds.includes(membership.planSnapshot.branchId))
    ) {
      throw new Error("Active membership unavailable for adjustment.");
    }
    if (!Number.isInteger(input.delta) || input.delta === 0) {
      throw new Error("Credit adjustment must be a non-zero integer.");
    }
    const balance = [...this.creditLedger.values()]
      .filter((entry) => entry.membershipId === membership.id)
      .reduce((sum, entry) => sum + entry.delta, 0);
    if (balance + input.delta < 0) {
      throw new Error("Credit adjustment would create a negative balance.");
    }
    const entry: StoredCreditLedgerEntry = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      membershipId: membership.id,
      memberId,
      delta: input.delta,
      reason: "manual_adjustment",
      bookingId: null,
      note: input.reason,
      createdAt: now()
    };
    this.creditLedger.set(entry.id, entry);
    const { tenantId: _tenantId, ...response } = entry;
    return response;
  }

  async listStaff(scope: TenantScope): Promise<StaffUserResponse[]> {
    return [...this.tenantUsers.values()]
      .filter((membership) => membership.tenantId === scope.tenantId)
      .map((membership) => this.toStaff(membership))
      .filter((staff): staff is StaffUserResponse => Boolean(staff));
  }

  async findStaffByUserId(scope: TenantScope, userId: string): Promise<StaffUserResponse | null> {
    const membership = [...this.tenantUsers.values()].find(
      (candidate) => candidate.tenantId === scope.tenantId && candidate.userId === userId
    );
    return membership ? this.toStaff(membership) : null;
  }

  async findStaffByEmail(scope: TenantScope, email: string): Promise<StaffUserResponse | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === normalizeEmail(email)
    );
    return user ? this.findStaffByUserId(scope, user.id) : null;
  }

  async findRoleById(scope: TenantScope, roleId: string): Promise<RoleResponse | null> {
    const role = this.roles.get(roleId);
    return role && role.tenantId === scope.tenantId ? this.toRoleResponse(role) : null;
  }

  async listRoles(scope: TenantScope): Promise<RoleResponse[]> {
    return [...this.roles.values()]
      .filter((role) => role.tenantId === scope.tenantId || role.tenantId === null)
      .map((role) => this.toRoleResponse(role));
  }

  async inviteStaff(scope: TenantScope, input: InviteStaffInput): Promise<StaffUserResponse> {
    if (await this.findStaffByEmail(scope, input.email))
      throw new Error("Staff member already exists.");
    const role = await this.findRoleById(scope, input.roleId);
    if (!role || input.branchIds.some((branchId) => !scope.branchIds.includes(branchId)))
      throw new Error("Invalid staff access.");
    const user: StoredUser = {
      id: randomUUID(),
      email: normalizeEmail(input.email),
      displayName: input.displayName,
      status: "invited",
      lastLoginAt: null,
      passwordHash: "!invite-required!"
    };
    this.users.set(user.id, user);
    const membership: StoredTenantUser = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      userId: user.id,
      roleId: role.id,
      status: "invited"
    };
    this.tenantUsers.set(membership.id, membership);
    this.branchAccess.set(membership.id, new Set(input.branchIds));
    const staff = this.toStaff(membership);
    if (!staff) throw new Error("Unable to create invited staff member.");
    return staff;
  }

  async updateStaffAccess(
    scope: TenantScope,
    userId: string,
    input: StaffAccessInput
  ): Promise<StaffUserResponse | null> {
    const membership = [...this.tenantUsers.values()].find(
      (candidate) => candidate.tenantId === scope.tenantId && candidate.userId === userId
    );
    const role = await this.findRoleById(scope, input.roleId);
    if (
      !membership ||
      !role ||
      input.branchIds.some((branchId) => !scope.branchIds.includes(branchId))
    )
      return null;
    membership.roleId = role.id;
    this.staffRoleAssignments.set(
      membership.id,
      new Set(input.roleIds?.length ? input.roleIds : [role.id])
    );
    this.branchAccess.set(membership.id, new Set(input.branchIds));
    return this.toStaff(membership);
  }

  async deactivateStaff(scope: TenantScope, userId: string): Promise<StaffUserResponse | null> {
    const membership = [...this.tenantUsers.values()].find(
      (candidate) => candidate.tenantId === scope.tenantId && candidate.userId === userId
    );
    if (!membership) return null;
    membership.status = "deactivated";
    return this.toStaff(membership);
  }

  async countActiveOwners(scope: TenantScope): Promise<number> {
    return [...this.tenantUsers.values()].filter((membership) => {
      const role = this.roles.get(membership.roleId);
      return (
        membership.tenantId === scope.tenantId &&
        membership.status === "active" &&
        role?.key === "owner"
      );
    }).length;
  }

  async recordAudit(input: AuditRecordInput): Promise<AuditEventResponse> {
    const event: AuditEventResponse = {
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      beforeSummary: input.beforeSummary ?? null,
      afterSummary: input.afterSummary ?? null,
      requestId: input.requestId,
      createdAt: now()
    };
    this.auditEvents.unshift(event);
    return event;
  }

  async listAuditEvents(scope: TenantScope, resourceId?: string): Promise<AuditEventResponse[]> {
    return this.auditEvents.filter(
      (event) =>
        event.tenantId === scope.tenantId && (!resourceId || event.resourceId === resourceId)
    );
  }

  async listPlatformAuditEvents(): Promise<AuditEventResponse[]> {
    return this.auditEvents.filter((event) => event.action.startsWith("tenant.")).slice(0, 200);
  }

  async listPlatformAccountExportRequests() {
    return [...this.accountExportRequests.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => ({ ...request }));
  }
  async updateAccountExportRequestStatus(
    requestId: string,
    status: import("@fitos/contracts").AccountExportStatus
  ) {
    const request = this.accountExportRequests.get(requestId);
    if (!request) return null;
    if (["completed", "failed"].includes(request.status) && request.status !== status) return null;
    const updated = {
      ...request,
      status,
      completedAt: status === "completed" ? now() : request.completedAt,
      updatedAt: now()
    };
    this.accountExportRequests.set(requestId, updated);
    return { ...updated };
  }

  async listPlatformPlanChangeRequests() {
    return [...this.planChangeRequests.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => ({ ...request }));
  }

  async listPlatformAccountCancellationRequests() {
    return [...this.accountCancellationRequests.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => ({ ...request }));
  }
  async listPlatformAccountDeletionRequests() {
    return [...this.accountDeletionRequests.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => ({ ...request }));
  }
  async decideAccountDeletionRequest(
    requestId: string,
    status: "reviewing" | "approved" | "rejected",
    reason: string,
    _decidedByUserId: string
  ) {
    const request = this.accountDeletionRequests.get(requestId);
    if (!request || !["requested", "reviewing"].includes(request.status)) return null;
    const updated = { ...request, status, reason, updatedAt: now() };
    this.accountDeletionRequests.set(requestId, updated);
    return { ...updated };
  }

  async decideAccountCancellationRequest(
    requestId: string,
    status: "reviewing" | "approved" | "rejected",
    reason: string,
    _decidedByUserId: string
  ) {
    const request = this.accountCancellationRequests.get(requestId);
    if (!request || !["requested", "reviewing"].includes(request.status)) return null;
    const updated = { ...request, status, reason, updatedAt: now() };
    this.accountCancellationRequests.set(requestId, updated);
    return { ...updated };
  }

  async getNotificationPreferences(userId: string) {
    return (
      this.notificationPreferences.get(userId) ?? {
        email: true,
        sms: false,
        bookingReminders: true,
        operationalAlerts: true,
        leadFollowUps: true
      }
    );
  }

  async updateNotificationPreferences(
    userId: string,
    input: import("@fitos/contracts").UpdateNotificationPreferencesRequest
  ) {
    const value = { ...input };
    this.notificationPreferences.set(userId, value);
    return value;
  }

  async listNotifications(userId: string) {
    return [...this.notifications.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listPlatformPlanDefinitions() {
    if (!this.platformPlanDefinitions.size)
      for (const key of Object.keys(SaaS_PLAN_QUOTAS) as import("@fitos/contracts").SaaSPlan[])
        this.platformPlanDefinitions.set(key, {
          key,
          name: `FITOS ${key[0]!.toUpperCase()}${key.slice(1)}`,
          description: `${key[0]!.toUpperCase()}${key.slice(1)} workspace plan`,
          quotas: SaaS_PLAN_QUOTAS[key],
          capabilities: PLATFORM_FEATURE_REGISTRY.filter((feature) => feature.defaultEnabled).map(
            (feature) => feature.key
          ),
          isActive: true
        });
    return [...this.platformPlanDefinitions.values()];
  }

  async updatePlatformPlanDefinition(
    key: import("@fitos/contracts").SaaSPlan,
    input: Omit<import("@fitos/contracts").SaaSPlanDefinition, "key"> & { isActive?: boolean }
  ) {
    if (input.isActive === false) return null;
    const updated = {
      key,
      name: input.name,
      description: input.description,
      quotas: input.quotas,
      capabilities: input.capabilities,
      isActive: input.isActive ?? true
    };
    this.platformPlanDefinitions.set(key, updated);
    return updated;
  }

  async listPlatformFeatureFlagOverrides() {
    return [...this.platformFeatureFlagOverrides.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  async createPlatformFeatureFlagOverride(
    input: Omit<import("@fitos/contracts").FeatureFlagOverrideResponse, "id" | "createdAt">
  ) {
    const item = { ...input, id: randomUUID(), createdAt: now() };
    this.platformFeatureFlagOverrides.set(item.id, item);
    return item;
  }

  async createNotification(
    input: Omit<import("@fitos/contracts").NotificationResponse, "id" | "readAt" | "createdAt">
  ) {
    const item = { ...input, id: randomUUID(), readAt: null, createdAt: now() };
    this.notifications.set(item.id, item);
    return item;
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const item = this.notifications.get(notificationId);
    if (!item || item.userId !== userId) return null;
    const updated = { ...item, readAt: item.readAt ?? now() };
    this.notifications.set(notificationId, updated);
    return updated;
  }

  async createAccountExportRequest(scope: TenantScope, requestedByUserId: string) {
    const timestamp = now();
    const request = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      requestedByUserId,
      status: "requested" as const,
      format: "json" as const,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null
    };
    this.accountExportRequests.set(request.id, request);
    return { ...request };
  }

  async listAccountExportRequests(scope: TenantScope) {
    return [...this.accountExportRequests.values()]
      .filter((request) => request.tenantId === scope.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => ({ ...request }));
  }

  async createPlanChangeRequest(
    scope: TenantScope,
    requestedByUserId: string,
    requestedPlan: import("@fitos/contracts").SaaSPlan
  ) {
    const timestamp = now();
    const request = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      requestedByUserId,
      requestedPlan,
      status: "requested" as const,
      reason: null,
      decidedByUserId: null,
      decidedAt: null,
      effectiveAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.planChangeRequests.set(request.id, request);
    return { ...request };
  }

  async listPlanChangeRequests(scope: TenantScope) {
    return [...this.planChangeRequests.values()]
      .filter((request) => request.tenantId === scope.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => ({ ...request }));
  }

  async createAccountCancellationRequest(
    scope: TenantScope,
    requestedByUserId: string,
    reason?: string
  ) {
    const timestamp = now();
    const request = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      requestedByUserId,
      status: "requested" as const,
      reason: reason ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.accountCancellationRequests.set(request.id, request);
    return { ...request };
  }

  async listAccountCancellationRequests(scope: TenantScope) {
    return [...this.accountCancellationRequests.values()]
      .filter((request) => request.tenantId === scope.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => ({ ...request }));
  }
  async createAccountDeletionRequest(
    scope: TenantScope,
    requestedByUserId: string,
    confirmation: string,
    reason?: string
  ) {
    const timestamp = now();
    const request = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      requestedByUserId,
      status: "requested" as const,
      confirmation,
      reason: reason ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.accountDeletionRequests.set(request.id, request);
    return { ...request };
  }
  async listAccountDeletionRequests(scope: TenantScope) {
    return [...this.accountDeletionRequests.values()]
      .filter((request) => request.tenantId === scope.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => ({ ...request }));
  }

  async publishEvent(event: DomainEvent): Promise<void> {
    this.domainEvents.push(event);
  }

  async createPayment(
    scope: TenantScope,
    input: CreatePaymentRequest,
    actorUserId: string
  ): Promise<PaymentTransactionResponse> {
    if (!scope.branchIds.includes(input.branchId)) {
      throw new Error("Branch unavailable.");
    }
    if (!/^\d+$/.test(input.amount.amountMinor) || BigInt(input.amount.amountMinor) <= 0n) {
      throw new Error("Payment amount must be greater than zero.");
    }
    if (!/^[A-Z]{3}$/.test(input.amount.currency)) {
      throw new Error("Payment currency must be a three-letter uppercase code.");
    }
    this.assertPaymentAllocationTarget(
      scope,
      input.branchId,
      input.memberId ?? null,
      input.allocationType ?? null,
      input.allocationId ?? null
    );
    const timestamp = now();
    const payment: StoredPaymentTransaction = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId,
      memberId: input.memberId ?? null,
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? null,
      providerRef: null,
      status: "completed",
      note: input.note ?? null,
      allocationType: input.allocationType ?? null,
      allocationId: input.allocationId ?? null,
      recordedByUserId: actorUserId,
      recordedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.payments.set(payment.id, payment);
    return { ...payment };
  }

  async findPaymentById(
    scope: TenantScope,
    paymentId: string
  ): Promise<PaymentTransactionResponse | null> {
    const payment = this.payments.get(paymentId);
    return payment &&
      payment.tenantId === scope.tenantId &&
      scope.branchIds.includes(payment.branchId)
      ? { ...payment }
      : null;
  }

  async listPayments(
    scope: TenantScope,
    filters: PaymentListFilters
  ): Promise<CursorPage<PaymentTransactionResponse>> {
    const rows = [...this.payments.values()]
      .filter((p) => p.tenantId === scope.tenantId && scope.branchIds.includes(p.branchId))
      .filter((p) => !filters.branchId || p.branchId === filters.branchId)
      .filter((p) => !filters.memberId || p.memberId === filters.memberId)
      .filter((p) => !filters.method || p.method === filters.method)
      .filter((p) => !filters.status || p.status === filters.status)
      .filter((p) => !filters.unmatched || !p.memberId || !p.allocationType)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id));
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const selected = rows.slice(0, limit + 1);
    return {
      data: selected.slice(0, limit).map((p) => ({ ...p })),
      page: { hasMore: selected.length > limit, nextCursor: null }
    };
  }

  async voidPayment(
    scope: TenantScope,
    paymentId: string,
    reason: string
  ): Promise<PaymentTransactionResponse | null> {
    const payment = this.payments.get(paymentId);
    if (
      !payment ||
      payment.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(payment.branchId)
    ) {
      return null;
    }
    if (payment.status === "voided") return { ...payment };
    if (payment.status !== "completed") return null;
    payment.status = "voided";
    payment.note = payment.note
      ? `${payment.note} | Void reason: ${reason}`
      : `Void reason: ${reason}`;
    payment.updatedAt = now();
    return { ...payment };
  }

  async reconcilePayment(
    scope: TenantScope,
    paymentId: string,
    input: ReconcilePaymentRequest
  ): Promise<PaymentTransactionResponse | null> {
    const payment = this.payments.get(paymentId);
    if (
      !payment ||
      payment.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(payment.branchId)
    ) {
      return null;
    }
    if (payment.status !== "completed") {
      throw new Error("Only completed payments can be reconciled.");
    }
    if (
      payment.memberId === input.memberId &&
      payment.allocationType === input.allocationType &&
      payment.allocationId === (input.allocationId ?? null)
    ) {
      return { ...payment };
    }
    if (
      (payment.memberId && payment.memberId !== input.memberId) ||
      (payment.allocationType && payment.allocationType !== input.allocationType) ||
      (payment.allocationId && payment.allocationId !== (input.allocationId ?? null))
    ) {
      throw new Error("Payment is already reconciled to a different target.");
    }
    this.assertPaymentAllocationTarget(
      scope,
      payment.branchId,
      input.memberId,
      input.allocationType,
      input.allocationId ?? null
    );
    payment.memberId = input.memberId;
    payment.allocationType = input.allocationType;
    payment.allocationId = input.allocationId ?? null;
    payment.note = payment.note
      ? `${payment.note} | Reconciliation: ${input.reason}`
      : `Reconciliation: ${input.reason}`;
    payment.updatedAt = now();
    return { ...payment };
  }

  async refundPayment(
    scope: TenantScope,
    paymentId: string,
    reason: string
  ): Promise<PaymentTransactionResponse | null> {
    const payment = this.payments.get(paymentId);
    if (
      !payment ||
      payment.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(payment.branchId)
    ) {
      return null;
    }
    if (payment.status === "refunded") return { ...payment };
    if (payment.status !== "completed") return null;
    payment.status = "refunded";
    payment.note = payment.note
      ? `${payment.note} | Refund reason: ${reason}`
      : `Refund reason: ${reason}`;
    payment.updatedAt = now();
    return { ...payment };
  }

  private assertPaymentAllocationTarget(
    scope: TenantScope,
    branchId: string,
    memberId: string | null,
    allocationType: PaymentTransactionResponse["allocationType"],
    allocationId: string | null
  ): void {
    if (!memberId) {
      if (allocationType || allocationId) {
        throw new Error("A payment cannot be allocated without a member.");
      }
      return;
    }
    const member = this.members.get(memberId);
    if (
      !member ||
      member.tenantId !== scope.tenantId ||
      member.status !== "active" ||
      (member.homeBranchId !== null && !scope.branchIds.includes(member.homeBranchId))
    ) {
      throw new Error("Member unavailable.");
    }
    if (!allocationType) {
      if (allocationId) throw new Error("Allocation type is required.");
      return;
    }
    if (allocationType === "booking") {
      const booking = allocationId ? this.bookings.get(allocationId) : null;
      if (
        !booking ||
        booking.tenantId !== scope.tenantId ||
        booking.branchId !== branchId ||
        booking.memberId !== memberId ||
        booking.status !== "confirmed"
      ) {
        throw new Error("Booking allocation target is unavailable.");
      }
      return;
    }
    if (allocationType === "membership") {
      const membership = allocationId ? this.memberMemberships.get(allocationId) : null;
      if (
        !membership ||
        membership.tenantId !== scope.tenantId ||
        membership.memberId !== memberId ||
        !["scheduled", "active"].includes(membership.status) ||
        (membership.planSnapshot.branchId !== null && membership.planSnapshot.branchId !== branchId)
      ) {
        throw new Error("Membership allocation target is unavailable.");
      }
      return;
    }
    if (allocationId) {
      throw new Error("Walk-in and other allocations cannot have a target ID.");
    }
  }

  async checkIn(
    scope: TenantScope,
    input: CheckInRequest,
    actorUserId: string,
    branchId: string,
    allowOverride: boolean
  ): Promise<AttendanceRecordResponse> {
    const member = this.members.get(input.memberId);
    if (
      !scope.branchIds.includes(branchId) ||
      !member ||
      member.tenantId !== scope.tenantId ||
      member.status !== "active" ||
      (member.homeBranchId !== null && !scope.branchIds.includes(member.homeBranchId))
    ) {
      throw new Error("Member unavailable.");
    }
    const occurrenceId = input.occurrenceId ?? null;
    if (occurrenceId) {
      const occurrence = this.occurrences.get(occurrenceId);
      if (
        !occurrence ||
        occurrence.tenantId !== scope.tenantId ||
        occurrence.branchId !== branchId ||
        occurrence.status !== "scheduled"
      ) {
        throw new Error("Occurrence unavailable for check-in.");
      }
      const booking = [...this.bookings.values()].find(
        (candidate) =>
          candidate.tenantId === scope.tenantId &&
          candidate.occurrenceId === occurrenceId &&
          candidate.memberId === input.memberId &&
          candidate.status === "confirmed"
      );
      if (!booking && !allowOverride) {
        throw new Error("A confirmed booking is required for class check-in.");
      }
    } else {
      const timestamp = Date.now();
      const eligibleMembership = [...this.memberMemberships.values()].find((membership) => {
        if (
          membership.tenantId !== scope.tenantId ||
          membership.memberId !== input.memberId ||
          membership.status !== "active" ||
          new Date(membership.startsAt).getTime() > timestamp ||
          (membership.endsAt && new Date(membership.endsAt).getTime() <= timestamp)
        ) {
          return false;
        }
        return (
          [...this.creditLedger.values()]
            .filter((entry) => entry.membershipId === membership.id)
            .reduce((sum, entry) => sum + entry.delta, 0) > 0
        );
      });
      if (!eligibleMembership && !allowOverride) {
        throw new Error("An active membership entitlement is required for general check-in.");
      }
    }
    const existing = [...this.attendance.values()].find(
      (record) =>
        record.tenantId === scope.tenantId &&
        record.branchId === branchId &&
        record.memberId === input.memberId &&
        (occurrenceId
          ? record.occurrenceId === occurrenceId
          : record.occurrenceId === null && record.status === "checked_in")
    );
    if (existing) {
      if (["checked_in", "attended"].includes(existing.status)) return { ...existing };
      throw new Error(`Member already has ${existing.status} attendance for this occurrence.`);
    }
    const timestamp = now();
    const record: StoredAttendanceRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId,
      occurrenceId,
      memberId: input.memberId,
      status: "checked_in",
      checkedInAt: timestamp,
      actorUserId,
      overrideReason: allowOverride ? (input.overrideReason ?? null) : null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.attendance.set(record.id, record);
    return { ...record };
  }

  async findAttendanceRecord(
    scope: TenantScope,
    recordId: string
  ): Promise<AttendanceRecordResponse | null> {
    const record = this.attendance.get(recordId);
    return record && record.tenantId === scope.tenantId && scope.branchIds.includes(record.branchId)
      ? { ...record }
      : null;
  }

  async listAttendanceRecords(
    scope: TenantScope,
    filters: AttendanceListFilters
  ): Promise<CursorPage<AttendanceRecordResponse>> {
    const rows = [...this.attendance.values()]
      .filter((r) => r.tenantId === scope.tenantId && scope.branchIds.includes(r.branchId))
      .filter((r) => !filters.branchId || r.branchId === filters.branchId)
      .filter((r) => !filters.occurrenceId || r.occurrenceId === filters.occurrenceId)
      .filter((r) => !filters.memberId || r.memberId === filters.memberId)
      .filter((r) => !filters.status || r.status === filters.status)
      .filter((r) => !filters.from || r.createdAt >= filters.from)
      .filter((r) => !filters.to || r.createdAt <= filters.to)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const selected = rows.slice(0, limit + 1);
    return {
      data: selected.slice(0, limit).map((r) => ({ ...r })),
      page: { hasMore: selected.length > limit, nextCursor: null }
    };
  }

  async updateAttendanceStatus(
    scope: TenantScope,
    recordId: string,
    input: UpdateRosterStatusRequest,
    allowOverride: boolean
  ): Promise<AttendanceRecordResponse | null> {
    const record = this.attendance.get(recordId);
    if (
      !record ||
      record.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(record.branchId)
    ) {
      return null;
    }
    if (record.status === input.status) return { ...record };
    const normalTransitions: Record<
      AttendanceRecordResponse["status"],
      readonly AttendanceRecordResponse["status"][]
    > = {
      booked: ["checked_in", "no_show", "late_cancel"],
      checked_in: ["attended"],
      attended: [],
      no_show: [],
      late_cancel: []
    };
    if (!normalTransitions[record.status].includes(input.status) && !allowOverride) {
      throw new Error(`Illegal attendance transition from ${record.status} to ${input.status}.`);
    }
    if (allowOverride && !input.overrideReason) {
      throw new Error("An override reason is required.");
    }
    record.status = input.status;
    if (input.status === "checked_in" || input.status === "attended") {
      if (!record.checkedInAt) record.checkedInAt = now();
    }
    if (allowOverride) record.overrideReason = input.overrideReason ?? null;
    record.updatedAt = now();
    return { ...record };
  }

  async acquireIdempotency(record: IdempotencyRecord): Promise<IdempotencyAcquireResult> {
    const mapKey = `${record.tenantId}:${record.operation}:${record.key}`;
    const existing = this.idempotency.get(mapKey);
    if (!existing || existing.expiresAt <= now()) {
      this.idempotency.set(mapKey, { ...record });
      return { kind: "acquired" };
    }
    if (existing.fingerprint !== record.fingerprint) return { kind: "key_reused" };
    if (existing.status === "in_progress") return { kind: "in_progress" };
    return {
      kind: "replay",
      responseStatus: existing.responseStatus ?? 200,
      responseBody: existing.responseBody ?? {}
    };
  }

  async completeIdempotency(
    input: Pick<IdempotencyRecord, "tenantId" | "operation" | "key"> & {
      responseStatus: number;
      responseBody: unknown;
    }
  ): Promise<void> {
    const mapKey = `${input.tenantId}:${input.operation}:${input.key}`;
    const existing = this.idempotency.get(mapKey);
    if (existing) {
      existing.status = "completed";
      existing.responseStatus = input.responseStatus;
      existing.responseBody = input.responseBody;
    }
  }

  async abandonIdempotency(
    input: Pick<IdempotencyRecord, "tenantId" | "operation" | "key">
  ): Promise<void> {
    this.idempotency.delete(`${input.tenantId}:${input.operation}:${input.key}`);
  }

  private requireTenant(tenantId: string): StoredTenant {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error("Tenant is unavailable.");
    return tenant;
  }

  private rolesForUserTenant(userId: string, tenantId: string): RoleResponse[] {
    return [...this.tenantUsers.values()]
      .filter(
        (membership) =>
          membership.userId === userId &&
          membership.tenantId === tenantId &&
          membership.status === "active"
      )
      .flatMap((membership) => {
        const roleIds =
          this.staffRoleAssignments.get(membership.id) ?? new Set([membership.roleId]);
        return [...roleIds].map((roleId) => this.roles.get(roleId));
      })
      .filter((role): role is StoredRole => Boolean(role))
      .map((role) => this.toRoleResponse(role));
  }

  private resolveBranchIds(membership: StoredTenantUser, role: StoredRole): string[] {
    if (role.key === "owner") {
      return [...this.branches.values()]
        .filter((branch) => branch.tenantId === membership.tenantId)
        .map((branch) => branch.id);
    }
    return [...(this.branchAccess.get(membership.id) ?? new Set())];
  }

  private toUserSummary(user: StoredUser): UserSummary {
    const { passwordHash: _passwordHash, ...summary } = user;
    return { ...summary };
  }

  private toRoleResponse(role: StoredRole): RoleResponse {
    const { tenantId: _tenantId, ...response } = role;
    return { ...response, permissions: [...response.permissions] };
  }

  private toBranchResponse(branch: StoredBranch): BranchResponse {
    const { tenantId: _tenantId, ...response } = branch;
    return { ...response };
  }

  private toMemberResponse(member: StoredMember, contact: StoredContact): MemberResponse {
    const { contactId: _contactId, ...response } = member;
    const { tenantId: _tenantId, ...contactResponse } = contact;
    return { ...response, contact: { ...contactResponse } };
  }

  private toMemberListItem(member: StoredMember, contact: StoredContact): MemberListItem {
    return {
      id: member.id,
      homeBranchId: member.homeBranchId,
      status: member.status,
      memberNumber: member.memberNumber,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: contact.email,
      joinedAt: member.joinedAt,
      updatedAt: member.updatedAt
    };
  }

  private toLeadResponse(lead: StoredLead, contact: StoredContact): LeadResponse {
    const { contactId: _contactId, ...response } = lead;
    return {
      ...response,
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        email: contact.email
      }
    };
  }

  private noteResponse(note: StoredLeadNote): LeadNoteResponse {
    const { tenantId: _tenantId, leadId: _leadId, ...response } = note;
    return response;
  }

  private taskResponse(task: StoredLeadTask): LeadTaskResponse {
    const { tenantId: _tenantId, leadId: _leadId, ...response } = task;
    return response;
  }

  private scheduleTemplateResponse(template: StoredScheduleTemplate): ScheduleTemplateResponse {
    return { ...template, daysOfWeek: [...template.daysOfWeek] };
  }

  private assertOccurrenceDraftsNoConflict(
    scope: TenantScope,
    drafts: CreateScheduleOccurrenceRequest[],
    excludedOccurrenceId?: string
  ): void {
    const normalized = drafts.map((draft) => ({
      ...draft,
      startsAtDate: new Date(draft.startsAt),
      endsAtDate: new Date(draft.endsAt)
    }));
    for (const draft of normalized) {
      if (
        Number.isNaN(draft.startsAtDate.getTime()) ||
        Number.isNaN(draft.endsAtDate.getTime()) ||
        draft.endsAtDate <= draft.startsAtDate
      ) {
        throw new Error("Occurrence end must be after start.");
      }
      const clashes = [...this.occurrences.values()].some(
        (occurrence) =>
          occurrence.id !== excludedOccurrenceId &&
          occurrence.tenantId === scope.tenantId &&
          occurrence.status === "scheduled" &&
          new Date(occurrence.startsAt) < draft.endsAtDate &&
          draft.startsAtDate < new Date(occurrence.endsAt) &&
          ((draft.roomId && occurrence.roomId === draft.roomId) ||
            (draft.trainerUserId && occurrence.trainerUserId === draft.trainerUserId))
      );
      if (clashes) throw new Error("Schedule conflict.");
    }
    for (let index = 0; index < normalized.length; index += 1) {
      const left = normalized[index];
      if (!left) continue;
      for (let otherIndex = index + 1; otherIndex < normalized.length; otherIndex += 1) {
        const right = normalized[otherIndex];
        if (!right) continue;
        const overlaps =
          left.startsAtDate < right.endsAtDate && right.startsAtDate < left.endsAtDate;
        const sharesResource =
          Boolean(left.roomId && left.roomId === right.roomId) ||
          Boolean(left.trainerUserId && left.trainerUserId === right.trainerUserId);
        if (overlaps && sharesResource) throw new Error("Schedule conflict.");
      }
    }
  }

  private storeOccurrence(
    scope: TenantScope,
    input: CreateScheduleOccurrenceRequest,
    templateId: string | null,
    timestamp: string
  ): ScheduleOccurrenceResponse {
    const occurrence: StoredOccurrence = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId,
      templateId,
      serviceId: input.serviceId,
      trainerUserId: input.trainerUserId ?? null,
      roomId: input.roomId ?? null,
      startsAt: new Date(input.startsAt).toISOString(),
      endsAt: new Date(input.endsAt).toISOString(),
      capacity: input.capacity,
      status: "scheduled",
      cancellationReason: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.occurrences.set(occurrence.id, occurrence);
    return this.occurrenceResponse(occurrence);
  }

  private occurrenceResponse(occurrence: StoredOccurrence): ScheduleOccurrenceResponse {
    const { cancellationReason: _cancellationReason, ...response } = occurrence;
    return { ...response };
  }

  private toStaff(membership: StoredTenantUser): StaffUserResponse | null {
    const user = this.users.get(membership.userId);
    const role = this.roles.get(membership.roleId);
    if (!user || !role) return null;
    const assignedRoleIds = this.staffRoleAssignments.get(membership.id) ?? new Set([role.id]);
    const assignedRoles = [...assignedRoleIds]
      .map((roleId) => this.roles.get(roleId))
      .filter((item): item is StoredRole => Boolean(item))
      .map((item) => this.toRoleResponse(item));
    const branchIds = this.resolveBranchIds(membership, role);
    const branches = branchIds
      .map((branchId) => this.branches.get(branchId))
      .filter((branch): branch is StoredBranch => Boolean(branch))
      .map((branch) => this.toBranchResponse(branch));
    return {
      user: this.toUserSummary(user),
      role: this.toRoleResponse(role),
      roles: assignedRoles,
      branches,
      tenantUserId: membership.id
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public Tenant Methods (slug based, no auth)
  // ───────────────────────────────────────────────────────────────────────────
  async getPublicTenantInfo(tenantSlug: string): Promise<PublicTenantInfoResponse | null> {
    const tenant = [...this.tenants.values()].find((t) => t.slug === tenantSlug);
    if (!tenant) return null;
    const branches = [...this.branches.values()]
      .filter((b) => b.tenantId === tenant.id && b.isActive)
      .map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        city: b.city,
        addressLine1: b.addressLine1,
        phone: b.phone,
        email: b.email
      }));
    return {
      name: tenant.name,
      slug: tenant.slug,
      tagline: "Premium Training & Fitness Studio",
      description: "State-of-the-art facilities, world-class coaching, and dynamic group sessions.",
      currency: tenant.currency,
      timezone: tenant.timezone,
      branches
    };
  }

  async listPublicServices(tenantSlug: string): Promise<PublicServiceResponse[]> {
    const tenant = [...this.tenants.values()].find((t) => t.slug === tenantSlug);
    if (!tenant) return [];
    return [...this.services.values()]
      .filter((s) => s.tenantId === tenant.id && s.isActive && s.publicVisible)
      .map((s) => {
        const branch = s.branchId ? this.branches.get(s.branchId) : null;
        return {
          id: s.id,
          name: s.name,
          slug: s.slug,
          serviceType: s.serviceType,
          durationMinutes: s.durationMinutes,
          creditsRequired: s.creditsRequired,
          price: s.price,
          branchName: branch?.name ?? null
        };
      });
  }

  async listPublicCoaches(tenantSlug: string): Promise<PublicCoachResponse[]> {
    const tenant = [...this.tenants.values()].find((t) => t.slug === tenantSlug);
    if (!tenant) return [];
    const trainerMemberships = [...this.tenantUsers.values()].filter((tu) => {
      if (tu.tenantId !== tenant.id || tu.status !== "active") return false;
      const role = this.roles.get(tu.roleId);
      return (
        role?.name.toLowerCase().includes("trainer") ||
        role?.name.toLowerCase().includes("coach") ||
        role?.name.toLowerCase().includes("owner")
      );
    });
    return trainerMemberships.map((tm) => {
      const user = this.users.get(tm.userId);
      const role = this.roles.get(tm.roleId);
      return {
        id: user?.id ?? tm.userId,
        displayName: user?.displayName ?? "Fitness Coach",
        roleName: role?.name ?? "Coach",
        specialties: ["HIIT", "Strength & Conditioning", "Functional Movement"],
        bio: "Certified fitness specialist focused on sustainable transformation and athletic performance."
      };
    });
  }

  async listPublicSchedule(
    tenantSlug: string,
    daysAhead = 14
  ): Promise<PublicScheduleOccurrenceResponse[]> {
    const tenant = [...this.tenants.values()].find((t) => t.slug === tenantSlug);
    if (!tenant) return [];
    const nowTime = new Date();
    const cutoff = new Date(nowTime);
    cutoff.setDate(cutoff.getDate() + daysAhead);

    return [...this.occurrences.values()]
      .filter((occ) => {
        if (occ.tenantId !== tenant.id || occ.status !== "scheduled") return false;
        const start = new Date(occ.startsAt);
        return start >= nowTime && start <= cutoff;
      })
      .map((occ) => {
        const service = this.services.get(occ.serviceId);
        const trainer = occ.trainerUserId ? this.users.get(occ.trainerUserId) : null;
        const room = occ.roomId ? this.rooms.get(occ.roomId) : null;
        const branch = this.branches.get(occ.branchId);
        const bookingsForOcc = [...this.bookings.values()].filter(
          (b) => b.occurrenceId === occ.id && b.status === "confirmed"
        );
        const bookedCount = bookingsForOcc.length;
        const effectiveCapacity = (
          this.serviceEquipmentRequirements.get(occ.serviceId) ?? []
        ).reduce((capacity, requirement) => {
          const available = [...this.equipmentAssets.values()].filter(
            (asset) =>
              asset.tenantId === tenant.id &&
              asset.poolId === requirement.poolId &&
              asset.branchId === occ.branchId &&
              asset.status === "available"
          ).length;
          return requirement.quantityRequired > 0
            ? Math.min(capacity, Math.floor(available / requirement.quantityRequired))
            : capacity;
        }, occ.capacity);
        const availableSpots = Math.max(0, effectiveCapacity - bookedCount);

        return {
          id: occ.id,
          serviceId: occ.serviceId,
          serviceName: service?.name ?? "Class",
          serviceType: service?.serviceType ?? "class",
          trainerName: trainer?.displayName ?? null,
          roomName: room?.name ?? null,
          branchName: branch?.name ?? null,
          startsAt: occ.startsAt,
          endsAt: occ.endsAt,
          capacity: occ.capacity,
          effectiveCapacity,
          bookedCount,
          availableSpots,
          price: service?.price ?? null
        };
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  async createPublicLead(
    tenantSlug: string,
    input: CreatePublicLeadRequest
  ): Promise<LeadResponse> {
    const tenant = [...this.tenants.values()].find((t) => t.slug === tenantSlug);
    if (!tenant) throw new Error("Tenant not found.");
    const defaultBranch = [...this.branches.values()].find((b) => b.tenantId === tenant.id);
    const branchId = input.branchId || defaultBranch?.id || null;

    const contactId = randomUUID();
    const leadId = randomUUID();
    const ts = now();
    const contact: StoredContact = {
      id: contactId,
      tenantId: tenant.id,
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      phone: normalizePhone(input.phone) ?? input.phone?.trim() ?? null,
      email: input.email ?? null,
      dateOfBirth: null
    };
    const lead: StoredLead = {
      id: leadId,
      tenantId: tenant.id,
      contactId,
      branchId,
      ownerUserId: null,
      interest: input.interest ?? "Public Website Trial",
      source: "website",
      stage: "new",
      lostReason: null,
      nextFollowUpAt: null,
      convertedMemberId: null,
      createdAt: ts,
      updatedAt: ts
    };
    this.contacts.set(contactId, contact);
    this.leads.set(leadId, lead);
    return {
      id: lead.id,
      tenantId: lead.tenantId,
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        email: contact.email
      },
      branchId: lead.branchId,
      ownerUserId: lead.ownerUserId,
      interest: lead.interest,
      source: lead.source,
      stage: lead.stage,
      lostReason: lead.lostReason,
      nextFollowUpAt: lead.nextFollowUpAt,
      convertedMemberId: lead.convertedMemberId,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt
    };
  }

  async createPublicReservation(
    tenantSlug: string,
    input: import("@fitos/contracts").CreatePublicReservationRequest
  ): Promise<import("@fitos/contracts").PublicReservationResponse> {
    const tenant = [...this.tenants.values()].find((t) => t.slug === tenantSlug);
    if (!tenant) throw new Error("Tenant not found.");
    let status: import("@fitos/contracts").PublicReservationResponse["status"] = "requested";
    if (input.occurrenceId) {
      const occurrence = this.occurrences.get(input.occurrenceId);
      if (!occurrence || occurrence.tenantId !== tenant.id || occurrence.status === "cancelled") {
        throw new Error("The selected schedule occurrence is unavailable.");
      }
      const confirmedBookings = [...this.bookings.values()].filter(
        (b) => b.occurrenceId === occurrence.id && b.status === "confirmed"
      ).length;
      const pendingReservations = this.publicReservations.filter(
        (r) =>
          r.occurrenceId === occurrence.id && (r.status === "requested" || r.status === "confirmed")
      ).length;
      status =
        confirmedBookings + pendingReservations <
        (occurrence.effectiveCapacity ?? occurrence.capacity)
          ? "confirmed"
          : "waitlisted";
    }
    const reservation = {
      id: randomUUID(),
      tenantId: tenant.id,
      ...input,
      status,
      createdAt: now()
    };
    this.publicReservations.push(reservation);
    return reservation;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Member Portal Authentication & Self-Service
  // ───────────────────────────────────────────────────────────────────────────
  async findMemberByIdentifier(identifier: string): Promise<MemberResponse | null> {
    const normalized = identifier.trim().toLowerCase();
    for (const member of this.members.values()) {
      const contact = this.contacts.get(member.contactId);
      if (!contact) continue;
      const matchEmail = contact.email && contact.email.toLowerCase() === normalized;
      const matchPhone =
        contact.phone &&
        contact.phone.replace(/[^0-9+]/g, "").includes(normalized.replace(/[^0-9+]/g, ""));
      const matchMemberNum =
        member.memberNumber && member.memberNumber.toLowerCase() === normalized;
      if (matchEmail || matchPhone || matchMemberNum) {
        return this.toMemberResponse(member, contact);
      }
    }
    return null;
  }

  async setMemberPassword(memberId: string, passwordHash: string): Promise<void> {
    this.memberPasswords.set(memberId, passwordHash);
  }
  async verifyMemberPassword(memberId: string, password: string): Promise<boolean> {
    const hash = this.memberPasswords.get(memberId);
    return hash
      ? new (await import("@fitos/auth")).ScryptPasswordHasher().verify(password, hash)
      : false;
  }

  async createMemberSession(input: {
    memberId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<{ id: string }> {
    const id = randomUUID();
    this.memberSessions.set(input.tokenHash, {
      id,
      memberId: input.memberId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null
    });
    return { id };
  }

  async resolveMemberSession(
    tokenHash: string,
    currentTime: string
  ): Promise<MemberProfileResponse | null> {
    const session = this.memberSessions.get(tokenHash);
    if (!session || session.revokedAt || session.expiresAt <= currentTime) return null;
    const member = this.members.get(session.memberId);
    if (!member) return null;
    const contact = this.contacts.get(member.contactId);
    if (!contact) return null;
    const tenant = this.tenants.get(member.tenantId);
    const branch = member.homeBranchId ? this.branches.get(member.homeBranchId) : null;

    // Credit balance
    const entries = [...this.creditLedger.values()].filter((c) => c.memberId === member.id);
    const creditBalance = entries.reduce((sum, e) => sum + e.delta, 0);

    // Active plan
    const memberships = [...this.memberMemberships.values()].filter(
      (m) => m.memberId === member.id && m.status === "active"
    );
    const latestPlan = memberships[0];

    return {
      id: member.id,
      tenantId: member.tenantId,
      tenantName: tenant?.name ?? "FITOS Gym",
      tenantSlug: tenant?.slug ?? "fitos-demo-gym",
      homeBranchId: member.homeBranchId,
      homeBranchName: branch?.name ?? null,
      memberNumber: member.memberNumber,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: contact.email,
      status: member.status === "active" ? "active" : "inactive",
      joinedAt: member.joinedAt,
      creditBalance,
      activePlan: latestPlan
        ? {
            name: latestPlan.planSnapshot?.name ?? "Membership",
            expiresAt: latestPlan.endsAt,
            status: latestPlan.status
          }
        : null
    };
  }

  async revokeMemberSession(tokenHash: string, at: string): Promise<void> {
    const session = this.memberSessions.get(tokenHash);
    if (session) {
      session.revokedAt = at;
    }
  }

  async getMemberPortalOverview(memberId: string): Promise<MemberPortalOverviewResponse | null> {
    const member = this.members.get(memberId);
    if (!member) return null;
    const contact = this.contacts.get(member.contactId);
    if (!contact) return null;
    const tenant = this.tenants.get(member.tenantId);
    const branch = member.homeBranchId ? this.branches.get(member.homeBranchId) : null;

    const entries = [...this.creditLedger.values()].filter((c) => c.memberId === member.id);
    const creditBalance = entries.reduce((sum, e) => sum + e.delta, 0);
    const nowTime = new Date();
    const memberships = [...this.memberMemberships.values()].filter(
      (m) =>
        m.memberId === member.id &&
        m.status === "active" &&
        (!m.endsAt || new Date(m.endsAt) >= nowTime)
    );
    const latestPlan = memberships[0];

    const resolvedProfile: MemberProfileResponse = {
      id: member.id,
      tenantId: member.tenantId,
      tenantName: tenant?.name ?? "FITOS Gym",
      tenantSlug: tenant?.slug ?? "fitos-demo-gym",
      homeBranchId: member.homeBranchId,
      homeBranchName: branch?.name ?? null,
      memberNumber: member.memberNumber,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: contact.email,
      status: member.status === "active" ? "active" : "inactive",
      joinedAt: member.joinedAt,
      creditBalance,
      activePlan: latestPlan
        ? {
            name: latestPlan.planSnapshot?.name ?? "Membership",
            expiresAt: latestPlan.endsAt,
            status: latestPlan.status
          }
        : null
    };

    const upcomingBookings = [...this.bookings.values()]
      .filter(
        (b) => b.memberId === memberId && (b.status === "confirmed" || b.status === "waitlisted")
      )
      .map((b) => {
        const occ = this.occurrences.get(b.occurrenceId);
        const service = occ ? this.services.get(occ.serviceId) : null;
        const trainer = occ?.trainerUserId ? this.users.get(occ.trainerUserId) : null;
        const room = occ?.roomId ? this.rooms.get(occ.roomId) : null;
        return {
          ...b,
          serviceName: service?.name ?? "Class",
          trainerName: trainer?.displayName ?? null,
          roomName: room?.name ?? null,
          startsAt: occ?.startsAt ?? b.bookedAt,
          endsAt: occ?.endsAt ?? b.bookedAt
        };
      })
      .filter((b) => new Date(b.startsAt) >= nowTime)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    const recentAttendance = [...this.attendance.values()]
      .filter((a) => a.memberId === memberId)
      .map((a) => {
        const occ = a.occurrenceId ? this.occurrences.get(a.occurrenceId) : null;
        const service = occ ? this.services.get(occ.serviceId) : null;
        return {
          ...a,
          serviceName: service?.name ?? "General Check-in",
          startsAt: occ?.startsAt ?? a.checkedInAt
        };
      })
      .sort(
        (a, b) =>
          new Date(b.checkedInAt ?? b.createdAt).getTime() -
          new Date(a.checkedInAt ?? a.createdAt).getTime()
      )
      .slice(0, 10);

    return {
      profile: resolvedProfile,
      bookableOccurrences: [...this.occurrences.values()]
        .filter(
          (o) =>
            o.tenantId === member.tenantId &&
            o.status === "scheduled" &&
            (!member.homeBranchId || o.branchId === member.homeBranchId) &&
            new Date(o.startsAt) >= nowTime
        )
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .slice(0, 50)
        .map((occurrence) => {
          const service = this.services.get(occurrence.serviceId);
          const required = service?.creditsRequired ?? 1;
          const outsideBookingWindow =
            service?.bookingWindowHours !== null &&
            service?.bookingWindowHours !== undefined &&
            new Date(occurrence.startsAt).getTime() - Date.now() >
              service.bookingWindowHours * 60 * 60 * 1000;
          const serviceExcluded =
            Array.isArray(latestPlan?.planSnapshot.includedServiceIds) &&
            latestPlan.planSnapshot.includedServiceIds.length > 0 &&
            !latestPlan.planSnapshot.includedServiceIds.includes(occurrence.serviceId);
          const booked = [...this.bookings.values()].some(
            (booking) =>
              booking.occurrenceId === occurrence.id &&
              booking.memberId === memberId &&
              (booking.status === "confirmed" || booking.status === "waitlisted")
          );
          const confirmed = [...this.bookings.values()].filter(
            (booking) => booking.occurrenceId === occurrence.id && booking.status === "confirmed"
          ).length;
          const eligibility = serviceExcluded
            ? {
                canBook: false,
                reasonCode: "SERVICE_NOT_INCLUDED" as const,
                message: "Your membership does not include this service."
              }
            : outsideBookingWindow
              ? {
                  canBook: false,
                  reasonCode: "OUTSIDE_BOOKING_WINDOW" as const,
                  message: "This session is not open for booking yet."
                }
              : booked
                ? {
                    canBook: false,
                    reasonCode: "ALREADY_BOOKED" as const,
                    message: "You are already booked into this session."
                  }
                : confirmed >= (occurrence.effectiveCapacity ?? occurrence.capacity)
                  ? {
                      canBook: true,
                      reasonCode: "WAITLIST_ONLY" as const,
                      message: "This session is full, but you can join the waitlist."
                    }
                  : creditBalance < required
                    ? {
                        canBook: false,
                        reasonCode: "INSUFFICIENT_CREDITS" as const,
                        message: `You need ${required} credit(s) but have ${creditBalance} remaining.`
                      }
                    : !memberships.length
                      ? {
                          canBook: false,
                          reasonCode: "MEMBERSHIP_INACTIVE" as const,
                          message: "An active membership is required to book this session."
                        }
                      : {
                          canBook: true,
                          reasonCode: "ELIGIBLE" as const,
                          message: "You can book this session."
                        };
          return { ...occurrence, bookingEligibility: eligibility };
        }),
      upcomingBookings,
      recentAttendance
    };
  }

  async memberSelfBook(memberId: string, occurrenceId: string): Promise<BookingResponse> {
    const member = this.members.get(memberId);
    if (!member) throw new Error("Member not found.");
    const occ = this.occurrences.get(occurrenceId);
    if (!occ || occ.tenantId !== member.tenantId) {
      throw new Error("Class occurrence not found.");
    }
    if (occ.status !== "scheduled") throw new Error("This class is not open for booking.");
    const service = this.services.get(occ.serviceId);
    if (
      service?.bookingWindowHours !== null &&
      service?.bookingWindowHours !== undefined &&
      new Date(occ.startsAt).getTime() - Date.now() > service.bookingWindowHours * 60 * 60 * 1000
    ) {
      throw new Error("This session is not open for booking yet.");
    }

    const activeBookings = [...this.bookings.values()].filter(
      (b) => b.occurrenceId === occ.id && b.status === "confirmed"
    );
    const alreadyBooked = activeBookings.some((b) => b.memberId === memberId);
    const alreadyWaitlisted = [...this.bookings.values()].some(
      (b) => b.occurrenceId === occ.id && b.memberId === memberId && b.status === "waitlisted"
    );
    if (alreadyBooked || alreadyWaitlisted)
      throw new Error("You are already booked into this session.");

    const creditsRequired = service?.creditsRequired ?? 1;

    // Check credit balance
    const entries = [...this.creditLedger.values()].filter((c) => c.memberId === member.id);
    const creditBalance = entries.reduce((sum, e) => sum + e.delta, 0);
    if (creditBalance < creditsRequired) {
      throw new Error(
        `Insufficient credits. This session requires ${creditsRequired} credit(s), you have ${creditBalance}.`
      );
    }

    if (member.homeBranchId && member.homeBranchId !== occ.branchId) {
      throw new Error("This session is outside your branch access.");
    }
    const activeMembership = [...this.memberMemberships.values()].find((m) => {
      if (m.memberId !== member.id || m.status !== "active") return false;
      return !m.endsAt || new Date(m.endsAt).getTime() >= Date.now();
    });
    if (!activeMembership)
      throw new Error("An active membership is required to book this session.");
    if (
      Array.isArray(activeMembership.planSnapshot.includedServiceIds) &&
      activeMembership.planSnapshot.includedServiceIds.length > 0 &&
      !activeMembership.planSnapshot.includedServiceIds.includes(occ.serviceId)
    ) {
      throw new Error("Your membership does not include this service.");
    }

    const waitlisted = activeBookings.length >= (occ.effectiveCapacity ?? occ.capacity);

    const bookingId = randomUUID();
    const ts = now();
    const booking: StoredBooking = {
      id: bookingId,
      tenantId: member.tenantId,
      branchId: occ.branchId,
      occurrenceId: occ.id,
      memberId: member.id,
      status: waitlisted ? "waitlisted" : "confirmed",
      source: "member_portal",
      bookedAt: ts,
      cancelledAt: null,
      cancellationReason: null,
      creditMembershipId: activeMembership?.id ?? null,
      creditsDebited: waitlisted ? 0 : creditsRequired,
      entitlementOverrideReason: null,
      lateCancelled: false,
      createdByUserId: null,
      createdAt: ts,
      updatedAt: ts
    };
    this.bookings.set(booking.id, booking);

    // Debit credit ledger
    if (waitlisted) return booking;

    const ledgerEntry: StoredCreditLedgerEntry = {
      id: randomUUID(),
      tenantId: member.tenantId,
      membershipId: activeMembership?.id ?? "",
      memberId: member.id,
      delta: -creditsRequired,
      reason: "booking",
      bookingId: booking.id,
      note: `Self-booked ${service?.name ?? "class"}`,
      createdAt: ts
    };
    this.creditLedger.set(ledgerEntry.id, ledgerEntry);

    return booking;
  }

  async memberSelfCancel(
    memberId: string,
    bookingId: string,
    reason: string
  ): Promise<BookingResponse> {
    const booking = this.bookings.get(bookingId);
    if (!booking || booking.memberId !== memberId) throw new Error("Booking not found.");
    if (booking.status !== "confirmed" && booking.status !== "waitlisted") {
      throw new Error("Booking is already cancelled.");
    }

    const ts = now();
    const occurrence = this.occurrences.get(booking.occurrenceId);
    const service = occurrence ? this.services.get(occurrence.serviceId) : undefined;
    const cutoffAt =
      occurrence && service
        ? new Date(occurrence.startsAt).getTime() - service.cancellationCutoffMinutes * 60_000
        : Number.POSITIVE_INFINITY;
    const lateCancelled = booking.status === "confirmed" && Date.now() >= cutoffAt;
    booking.status = "cancelled";
    booking.cancelledAt = ts;
    booking.cancellationReason = reason || "Member self-cancelled";
    booking.lateCancelled = lateCancelled;
    booking.updatedAt = ts;

    // Refund credits
    if (
      booking.creditsDebited > 0 &&
      (!lateCancelled || Boolean(service?.restoreCreditOnLateCancel))
    ) {
      const refundEntry: StoredCreditLedgerEntry = {
        id: randomUUID(),
        tenantId: booking.tenantId,
        membershipId: booking.creditMembershipId ?? "",
        memberId: booking.memberId,
        delta: booking.creditsDebited,
        reason: "cancellation",
        bookingId: booking.id,
        note: `Self-cancellation credit refund`,
        createdAt: ts
      };
      this.creditLedger.set(refundEntry.id, refundEntry);
    }
    return booking;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Real Aggregate Analytics & Insights Engine
  // ───────────────────────────────────────────────────────────────────────────
  async getInsightsOverview(
    scope: TenantScope,
    branchId?: string
  ): Promise<InsightsOverviewResponse> {
    const tenantId = scope.tenantId;
    const allMembers = [...this.members.values()].filter(
      (m) => m.tenantId === tenantId && (!branchId || m.homeBranchId === branchId)
    );
    const allBookings = [...this.bookings.values()].filter(
      (b) => b.tenantId === tenantId && (!branchId || b.branchId === branchId)
    );
    const allAttendance = [...this.attendance.values()].filter(
      (a) => a.tenantId === tenantId && (!branchId || a.branchId === branchId)
    );
    const allLeads = [...this.leads.values()].filter(
      (l) => l.tenantId === tenantId && (!branchId || l.branchId === branchId)
    );
    const allOccurrences = [...this.occurrences.values()].filter(
      (o) => o.tenantId === tenantId && (!branchId || o.branchId === branchId)
    );

    const totalActiveMembers = allMembers.filter((m) => m.status === "active").length;
    const totalLeadsInPipeline = allLeads.length;

    // Avg Weekly Visits
    const attendedCount = allAttendance.filter((a) => a.status === "attended").length;
    const avgWeeklyVisits = attendedCount;

    // Class Occupancy
    let totalBookedSlots = 0;
    let totalCapacitySlots = 0;
    for (const occ of allOccurrences) {
      const occBookings = allBookings.filter(
        (b) => b.occurrenceId === occ.id && b.status === "confirmed"
      ).length;
      totalBookedSlots += occBookings;
      totalCapacitySlots += occ.capacity ?? 0;
    }
    const classOccupancyRate =
      totalCapacitySlots > 0 ? Math.round((totalBookedSlots / totalCapacitySlots) * 100) : 0;

    // Retention Rate 90d
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const activeInLast90d = allMembers.filter((m) => {
      const hasRecentAttendance = allAttendance.some(
        (a) => a.memberId === m.id && new Date(a.checkedInAt ?? a.createdAt) >= ninetyDaysAgo
      );
      return m.status === "active" || hasRecentAttendance;
    }).length;
    const memberRetention90d =
      allMembers.length > 0 ? Math.round((activeInLast90d / allMembers.length) * 100) : 0;

    // Lead Conversion Rate
    const convertedLeads = allLeads.filter(
      (l) => l.stage === "joined" || l.convertedMemberId
    ).length;
    const leadConversionRate =
      allLeads.length > 0 ? Math.round((convertedLeads / allLeads.length) * 100) : 0;

    // Weekly Attendance by day
    const dayMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };
    for (const rec of allAttendance) {
      if (rec.status === "attended" && rec.checkedInAt) {
        const day = new Date(rec.checkedInAt).getDay();
        dayMap[day] = (dayMap[day] ?? 0) + 1;
      }
    }
    const weeklyAttendance: WeeklyAttendancePoint[] = [
      { day: "Mon", count: dayMap[1] ?? 0 },
      { day: "Tue", count: dayMap[2] ?? 0 },
      { day: "Wed", count: dayMap[3] ?? 0 },
      { day: "Thu", count: dayMap[4] ?? 0 },
      { day: "Fri", count: dayMap[5] ?? 0 },
      { day: "Sat", count: dayMap[6] ?? 0 },
      { day: "Sun", count: dayMap[0] ?? 0 }
    ];

    // Heatmap
    const occupancyHeatmap: OccupancyHeatmapPoint[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 6; h <= 20; h += 2) {
        const occAtSlot = allOccurrences.filter((o) => {
          const s = new Date(o.startsAt);
          return s.getDay() === d && s.getHours() >= h && s.getHours() < h + 2;
        });
        const occPct =
          occAtSlot.length > 0
            ? Math.min(
                100,
                Math.round(
                  (allBookings.filter((b) => occAtSlot.some((o) => o.id === b.occurrenceId))
                    .length /
                    (occAtSlot.length * 20)) *
                    100
                )
              )
            : 0;
        occupancyHeatmap.push({
          dayOfWeek: d,
          hourOfDay: h,
          occupancyPercent: occPct,
          sessionCount: occAtSlot.length
        });
      }
    }

    // Retention Cohorts
    const retentionCohorts: RetentionCohortRow[] = [
      // Cohort retention requires a historical cohort query; do not fabricate rows.
    ];

    // At-Risk Members (> 21 days since last visit)
    const atRiskMembers: AtRiskMemberItem[] = allMembers
      .filter(
        (m) =>
          m.status === "inactive" ||
          (() => {
            const visits = allAttendance
              .filter((attendance) => attendance.memberId === m.id && attendance.checkedInAt)
              .map((attendance) => new Date(attendance.checkedInAt!).getTime());
            const lastVisit = visits.length ? Math.max(...visits) : 0;
            return !lastVisit || lastVisit < ninetyDaysAgo.getTime();
          })()
      )
      .slice(0, 8)
      .map((m) => {
        const contact = this.contacts.get(m.contactId);
        const entries = [...this.creditLedger.values()].filter((c) => c.memberId === m.id);
        const creditBalance = entries.reduce((sum, e) => sum + e.delta, 0);
        const plan = [...this.memberMemberships.values()].find((mm) => mm.memberId === m.id);
        return {
          id: m.id,
          firstName: contact?.firstName ?? "Member",
          lastName: contact?.lastName ?? null,
          phone: contact?.phone ?? null,
          email: contact?.email ?? null,
          daysInactive: Math.max(
            0,
            Math.floor(
              (Date.now() -
                Math.max(
                  0,
                  ...allAttendance
                    .filter((attendance) => attendance.memberId === m.id && attendance.checkedInAt)
                    .map((attendance) => new Date(attendance.checkedInAt!).getTime())
                )) /
                86400000
            )
          ),
          planName: plan?.planSnapshot?.name ?? "10-Class Punch Pass",
          creditsRemaining: Math.max(0, creditBalance),
          lastVisitAt:
            allAttendance
              .filter((attendance) => attendance.memberId === m.id && attendance.checkedInAt)
              .sort(
                (a, b) => new Date(b.checkedInAt!).getTime() - new Date(a.checkedInAt!).getTime()
              )[0]?.checkedInAt ?? null
        };
      });

    // Lead Funnel
    const stageCounts: Record<string, number> = {
      new: 0,
      contacted: 0,
      trial_booked: 0,
      trial_completed: 0,
      offer: 0,
      joined: 0,
      lost: 0
    };
    for (const l of allLeads) {
      if (l.stage in stageCounts) stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1;
    }
    const totalL = allLeads.length;
    const leadFunnel: LeadFunnelStageCount[] = [
      {
        stage: "new",
        label: "New Inquiries",
        count: stageCounts.new ?? 0,
        percentage: totalL ? Math.round(((stageCounts.new ?? 0) / totalL) * 100) : 0
      },
      {
        stage: "contacted",
        label: "Contacted / Qualified",
        count: stageCounts.contacted ?? 0,
        percentage: totalL ? Math.round(((stageCounts.contacted ?? 0) / totalL) * 100) : 0
      },
      {
        stage: "trial_booked",
        label: "Trial Class Booked",
        count: stageCounts.trial_booked ?? 0,
        percentage: totalL ? Math.round(((stageCounts.trial_booked ?? 0) / totalL) * 100) : 0
      },
      {
        stage: "trial_completed",
        label: "Trial Completed",
        count: stageCounts.trial_completed ?? 0,
        percentage: totalL ? Math.round(((stageCounts.trial_completed ?? 0) / totalL) * 100) : 0
      },
      {
        stage: "offer",
        label: "Membership Offered",
        count: stageCounts.offer ?? 0,
        percentage: totalL ? Math.round(((stageCounts.offer ?? 0) / totalL) * 100) : 0
      },
      {
        stage: "joined",
        label: "Joined as Member",
        count: stageCounts.joined ?? 0,
        percentage: totalL ? Math.round(((stageCounts.joined ?? 0) / totalL) * 100) : 0
      }
    ];

    return {
      summary: {
        avgWeeklyVisits,
        avgWeeklyVisitsChangePct: null,
        classOccupancyRate,
        classOccupancyChangePct: null,
        memberRetention90d,
        memberRetentionChangePct: null,
        leadConversionRate,
        leadConversionChangePct: null,
        totalActiveMembers,
        totalLeadsInPipeline
      },
      weeklyAttendance,
      occupancyHeatmap,
      retentionCohorts,
      atRiskMembers,
      leadFunnel
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Automations Workflow Engine
  // ───────────────────────────────────────────────────────────────────────────
  async listAutomations(scope: TenantScope): Promise<AutomationRuleResponse[]> {
    return [...this.automations.values()].filter((a) => a.tenantId === scope.tenantId);
  }

  async createAutomation(
    scope: TenantScope,
    input: CreateAutomationRuleRequest
  ): Promise<AutomationRuleResponse> {
    const id = randomUUID();
    const ts = now();
    const rule: AutomationRuleResponse = {
      id,
      tenantId: scope.tenantId,
      name: input.name,
      description: input.description ?? "",
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig ?? {},
      conditions: input.conditions ?? [],
      actionType: input.actionType,
      actionConfig: input.actionConfig,
      isActive: input.isActive ?? true,
      totalExecutions: 0,
      lastExecutedAt: null,
      createdAt: ts,
      updatedAt: ts
    };
    this.automations.set(id, rule);
    return rule;
  }

  async updateAutomation(
    scope: TenantScope,
    ruleId: string,
    input: UpdateAutomationRuleRequest
  ): Promise<AutomationRuleResponse | null> {
    const rule = this.automations.get(ruleId);
    if (!rule || rule.tenantId !== scope.tenantId) return null;
    if (input.name !== undefined) rule.name = input.name;
    if (input.description !== undefined) rule.description = input.description;
    if (input.triggerType !== undefined) rule.triggerType = input.triggerType;
    if (input.triggerConfig !== undefined) rule.triggerConfig = input.triggerConfig;
    if (input.conditions !== undefined) rule.conditions = input.conditions;
    if (input.actionType !== undefined) rule.actionType = input.actionType;
    if (input.actionConfig !== undefined) rule.actionConfig = input.actionConfig;
    if (input.isActive !== undefined) rule.isActive = input.isActive;
    rule.updatedAt = now();
    return rule;
  }

  async deleteAutomation(scope: TenantScope, ruleId: string): Promise<boolean> {
    const rule = this.automations.get(ruleId);
    if (!rule || rule.tenantId !== scope.tenantId) return false;
    this.automations.delete(ruleId);
    return true;
  }

  async listAutomationLogs(scope: TenantScope): Promise<AutomationExecutionLogResponse[]> {
    return this.automationLogs.filter((l) => l.tenantId === scope.tenantId).slice(-50);
  }

  async recordAutomationActionResult(
    actionId: string,
    result: import("@fitos/contracts").AutomationActionResult
  ): Promise<boolean> {
    const log = this.automationLogs.find((entry) => entry.id === actionId);
    if (!log) return false;
    log.status =
      result.status === "delivered"
        ? "success"
        : result.status === "simulated"
          ? "skipped"
          : result.status;
    log.message = result.message;
    return true;
  }

  async triggerAutomation(
    scope: TenantScope,
    ruleId: string
  ): Promise<AutomationExecutionLogResponse> {
    const rule = this.automations.get(ruleId);
    if (!rule || rule.tenantId !== scope.tenantId) throw new Error("Automation rule not found.");
    const ts = now();
    rule.totalExecutions += 1;
    rule.lastExecutedAt = ts;
    const actionId = randomUUID();
    const log: AutomationExecutionLogResponse = {
      id: actionId,
      ruleId: rule.id,
      ruleName: rule.name,
      tenantId: scope.tenantId,
      status: "skipped",
      triggerEvent: "manual.test",
      targetEntityId: null,
      targetEntityName: "Test Run",
      message: `SIMULATION: evaluated action ${rule.actionType}; no customer communication was sent.`,
      executedAt: ts,
      actionId,
      actionType: rule.actionType,
      provider: "simulation",
      actionConfig: { ...rule.actionConfig }
    };
    this.automationLogs.push(log);
    return log;
  }

  async getTodayOverview(
    scope: TenantScope,
    branchId: string
  ): Promise<import("@fitos/contracts").TodayOverviewResponse> {
    const timezone = this.tenants.get(scope.tenantId)?.timezone ?? "Africa/Nairobi";
    const localDate = (value: string | Date) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(value));
    const date = localDate(new Date());
    const sameDay = (value: string | null | undefined) =>
      Boolean(value && localDate(value) === date);
    const members = [...this.members.values()].filter(
      (m) => m.tenantId === scope.tenantId && m.homeBranchId === branchId
    );
    const bookings = [...this.bookings.values()].filter(
      (b) => b.tenantId === scope.tenantId && b.branchId === branchId && sameDay(b.bookedAt)
    );
    const attendance = [...this.attendance.values()].filter(
      (a) => a.tenantId === scope.tenantId && a.branchId === branchId && sameDay(a.checkedInAt)
    );
    const occurrences = [...this.occurrences.values()].filter(
      (o) =>
        o.tenantId === scope.tenantId &&
        o.branchId === branchId &&
        o.status === "scheduled" &&
        sameDay(o.startsAt)
    );
    const leads = [...this.leads.values()].filter(
      (l) => l.tenantId === scope.tenantId && l.branchId === branchId && sameDay(l.createdAt)
    );
    const next = occurrences
      .filter((o) => new Date(o.startsAt) >= new Date())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    return {
      branchId,
      date,
      members: {
        active: members.filter((m) => m.status === "active").length,
        joinedToday: members.filter((m) => sameDay(m.joinedAt)).length
      },
      bookings: {
        today: bookings.length,
        confirmed: bookings.filter((b) => b.status === "confirmed").length,
        cancelled: bookings.filter((b) => b.status === "cancelled").length,
        waitlisted: 0
      },
      attendance: {
        checkedInToday: attendance.length,
        expectedToday: occurrences.reduce(
          (sum, o) =>
            sum +
            bookings.filter((b) => b.occurrenceId === o.id && b.status === "confirmed").length,
          0
        ),
        noShows: attendance.filter((record) => record.status === "no_show").length
      },
      schedule: {
        sessionsToday: occurrences.length,
        nextSession: next
          ? {
              id: next.id,
              name: this.services.get(next.serviceId)?.name ?? "Scheduled session",
              startsAt: next.startsAt
            }
          : null
      },
      leads: {
        newToday: leads.length,
        followUpsDue: [...this.leads.values()].filter(
          (lead) =>
            lead.tenantId === scope.tenantId &&
            lead.branchId === branchId &&
            Boolean(lead.nextFollowUpAt) &&
            new Date(lead.nextFollowUpAt!).getTime() <= Date.now() &&
            lead.stage !== "joined" &&
            lead.stage !== "lost"
        ).length
      }
    };
  }

  // ─── Platform & Self-Service SaaS ──────────────────────────────────────────
  async signupTenant(
    input: SaaSTenantSignupRequest,
    passwordHash: string
  ): Promise<SaaSTenantSignupResponse> {
    const tenantId = randomUUID();
    const branchId = randomUUID();
    const userId = randomUUID();
    const roleId = randomUUID();
    const tenantUserId = randomUUID();
    const ts = now();

    const slug = toSlug(input.slug || input.gymName);
    const tenant: StoredTenant = {
      id: tenantId,
      name: input.gymName,
      slug,
      timezone: input.timezone || "Africa/Nairobi",
      currency: input.currency || "KES",
      status: "active"
    };
    this.tenants.set(tenantId, tenant);

    const branch: StoredBranch = {
      id: branchId,
      tenantId,
      name: input.branchName || "Main Branch",
      slug: toSlug(input.branchName || "main-branch"),
      timezone: input.timezone || "Africa/Nairobi",
      phone: input.ownerPhone || null,
      email: input.ownerEmail,
      addressLine1: input.branchAddress || null,
      addressLine2: null,
      city: input.country || "Nairobi",
      countryCode: "KE",
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    };
    this.branches.set(branchId, branch);

    const user: StoredUser = {
      id: userId,
      email: normalizeEmail(input.ownerEmail),
      passwordHash,
      displayName: input.ownerName,
      status: "active",
      lastLoginAt: null
    };
    this.users.set(userId, user);

    const role: StoredRole = {
      id: roleId,
      tenantId,
      key: "owner",
      name: "Owner",
      permissions: [...DEFAULT_ROLE_PERMISSIONS.owner]
    };
    this.roles.set(roleId, role);

    this.tenantUsers.set(tenantUserId, {
      id: tenantUserId,
      tenantId,
      userId,
      roleId,
      status: "active"
    });

    const trialEndsAt = new Date(Date.now() + 14 * 86400000).toISOString();
    this.tenantSubscriptions.set(tenantId, {
      tenantId,
      plan: "pro",
      planName: "FITOS Pro (14-Day Free Trial)",
      status: "trial",
      trialEndsAt,
      currentPeriodEndsAt: trialEndsAt,
      capabilities: [
        "feature.crm",
        "feature.automations",
        "feature.insights",
        "feature.portal",
        "feature.assessments",
        "feature.therapy",
        "feature.inventory",
        "feature.equipment",
        "feature.sites",
        "feature.integrations"
      ]
    });

    const token = randomUUID();
    return {
      tenantId,
      tenantSlug: slug,
      tenantName: input.gymName,
      branchId,
      ownerUserId: userId,
      ownerEmail: input.ownerEmail,
      token,
      csrfToken: "mock-csrf-token",
      trialEndsAt
    };
  }

  async getTenantSubscription(tenantId: string): Promise<TenantSubscriptionResponse> {
    const sub = this.tenantSubscriptions.get(tenantId);
    if (sub) return sub;
    const defaultTrial = new Date(Date.now() + 14 * 86400000).toISOString();
    return {
      tenantId,
      plan: "pro",
      planName: "FITOS Pro Trial",
      status: "trial",
      trialEndsAt: defaultTrial,
      currentPeriodEndsAt: defaultTrial,
      capabilities: [
        "feature.crm",
        "feature.automations",
        "feature.insights",
        "feature.portal",
        "feature.assessments",
        "feature.therapy",
        "feature.inventory",
        "feature.equipment",
        "feature.sites",
        "feature.integrations"
      ]
    };
  }

  async getWorkspacePreference(userId: string, tenantId: string) {
    return this.workspacePreferences.get(`${userId}:${tenantId}`) ?? null;
  }

  async setWorkspacePreference(
    userId: string,
    tenantId: string,
    workspace: import("@fitos/contracts").WorkspaceKey
  ) {
    this.workspacePreferences.set(`${userId}:${tenantId}`, workspace);
  }

  async listPlatformTenantControls(): Promise<
    import("@fitos/contracts").PlatformTenantControlRecord[]
  > {
    return Promise.all(
      [...this.tenants.values()].map(async (tenant) => ({
        tenant,
        subscription: await this.getTenantSubscription(tenant.id),
        usage: await this.getTenantUsageQuotas(tenant.id)
      }))
    );
  }

  async getTenantUsageQuotas(tenantId: string): Promise<UsageQuotaMetricsResponse> {
    const plan = this.tenantSubscriptions.get(tenantId)?.plan ?? "starter";
    const limits = SaaS_PLAN_QUOTAS[plan];
    const activeMembers = [...this.members.values()].filter(
      (m) => m.tenantId === tenantId && m.status === "active"
    ).length;
    const activeStaff = [...this.tenantUsers.values()].filter(
      (tu) => tu.tenantId === tenantId && tu.status === "active"
    ).length;
    const branchCount = [...this.branches.values()].filter((b) => b.tenantId === tenantId).length;
    const autoRuns = this.automationLogs.filter((l) => l.tenantId === tenantId).length;

    return {
      activeMembers,
      maxMembers: limits.maxMembers,
      activeStaff,
      maxStaff: limits.maxStaff,
      branches: branchCount,
      maxBranches: limits.maxBranches,
      automationRunsThisMonth: autoRuns,
      maxAutomationRuns: limits.maxAutomationRuns,
      storageUsedMb: null,
      maxStorageMb: limits.maxStorageMb
    };
  }

  async transitionTenantSubscriptionStatus(
    tenantId: string,
    status: import("@fitos/contracts").TenantAccountStatus
  ) {
    const subscription =
      this.tenantSubscriptions.get(tenantId) ?? (await this.getTenantSubscription(tenantId));
    if (!subscription) return null;
    const updated = { ...subscription, status };
    this.tenantSubscriptions.set(tenantId, updated);
    return updated;
  }

  async updateTenantCapabilities(
    tenantId: string,
    capabilities: import("@fitos/contracts").SaaSCapabilityKey[]
  ) {
    const subscription =
      this.tenantSubscriptions.get(tenantId) ?? (await this.getTenantSubscription(tenantId));
    if (!subscription) return null;
    const updated = { ...subscription, capabilities: [...new Set(capabilities)] };
    this.tenantSubscriptions.set(tenantId, updated);
    return updated;
  }

  async updateTenantPlan(tenantId: string, plan: import("@fitos/contracts").SaaSPlan) {
    const subscription =
      this.tenantSubscriptions.get(tenantId) ?? (await this.getTenantSubscription(tenantId));
    if (!subscription) return null;
    const updated = {
      ...subscription,
      plan,
      planName: `FITOS ${plan[0]!.toUpperCase()}${plan.slice(1)}`
    };
    this.tenantSubscriptions.set(tenantId, updated);
    return updated;
  }

  async decidePlanChangeRequest(
    requestId: string,
    status: "approved" | "rejected",
    reason: string,
    decidedByUserId: string,
    effectiveAt: Date | null
  ) {
    const request = this.planChangeRequests.get(requestId);
    if (!request || request.status !== "requested") return null;
    const decidedAt = now();
    const updated = {
      ...request,
      status,
      reason,
      decidedByUserId,
      decidedAt,
      effectiveAt: effectiveAt?.toISOString() ?? null,
      updatedAt: decidedAt
    };
    this.planChangeRequests.set(requestId, updated);
    if (status === "approved" && (!effectiveAt || effectiveAt <= new Date()))
      await this.updateTenantPlan(request.tenantId, request.requestedPlan);
    return { ...updated };
  }

  async listFeatureFlags(_tenantId: string): Promise<FeatureFlagResponse[]> {
    const subscription = await this.getTenantSubscription(_tenantId);
    const capabilities = new Set(subscription.capabilities);
    const nowDate = new Date();
    const applicable = [...this.platformFeatureFlagOverrides.values()]
      .filter(
        (override) =>
          override.scope === "global" ||
          (override.scope === "tenant" && override.scopeValue === _tenantId) ||
          (override.scope === "plan" && override.scopeValue === subscription.plan) ||
          (override.scope === "pilot" &&
            override.scopeValue
              ?.split(",")
              .map((value) => value.trim())
              .includes(_tenantId))
      )
      .filter(
        (override) =>
          (!override.effectiveFrom || new Date(override.effectiveFrom) <= nowDate) &&
          (!override.effectiveUntil || new Date(override.effectiveUntil) > nowDate)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const override of applicable) {
      if (override.enabled) capabilities.add(override.key);
      else capabilities.delete(override.key);
    }
    return PLATFORM_FEATURE_REGISTRY.map((feature) => ({
      key: feature.key,
      enabled: capabilities.has(feature.key),
      name: feature.name,
      description: `${feature.name} capability`,
      category:
        feature.maturity === "stable" ? "core" : feature.maturity === "beta" ? "advanced" : "beta"
    }));
  }

  async saveImplementationInquiry(
    input: import("@fitos/contracts").ImplementationInquiryDraft,
    submit: boolean
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse> {
    const existing = input.id ? this.implementationInquiries.get(input.id) : undefined;
    const ts = now();
    const id = existing?.id ?? randomUUID();
    const inquiry = {
      id,
      contactName: input.contactName,
      businessName: input.businessName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      businessType: input.businessType,
      payload: input.payload,
      status: submit ? "submitted" : "draft",
      schemaVersion: 1,
      submittedAt: submit ? ts : null,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts
    } as import("@fitos/contracts").ImplementationInquiryResponse;
    this.implementationInquiries.set(id, inquiry);
    return inquiry;
  }

  async listImplementationInquiries(
    status?: import("@fitos/contracts").ImplementationInquiryStatus
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse[]> {
    return [...this.implementationInquiries.values()]
      .filter((item) => !status || item.status === status)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getImplementationInquiry(
    id: string
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse | null> {
    return this.implementationInquiries.get(id) ?? null;
  }
  async updateImplementationInquiryStatus(
    id: string,
    status: import("@fitos/contracts").ImplementationInquiryStatus
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse | null> {
    const item = this.implementationInquiries.get(id);
    if (!item) return null;
    const updated = { ...item, status, updatedAt: now() };
    this.implementationInquiries.set(id, updated);
    return updated;
  }
  async buildTenantSeedManifest(
    id: string
  ): Promise<import("@fitos/contracts").TenantSeedManifest | null> {
    const item = this.implementationInquiries.get(id);
    if (!item) return null;
    const payload = item.payload as Record<string, unknown>;
    const arrayValue = (key: string): unknown[] =>
      Array.isArray(payload[key]) ? payload[key] : [];
    const objectValue = (key: string): Record<string, unknown> => {
      const value = payload[key];
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    };
    return {
      schemaVersion: 1,
      sourceInquiryId: id,
      generatedAt: now(),
      business: {
        contactName: item.contactName,
        businessName: item.businessName,
        country: item.country,
        businessType: item.businessType
      },
      branches: arrayValue("locations"),
      services: arrayValue("services"),
      team: arrayValue("team"),
      equipment: arrayValue("equipment"),
      assessments: arrayValue("assessments"),
      therapy: arrayValue("therapy"),
      inventory: arrayValue("inventory"),
      website: objectValue("website"),
      customRequirements: arrayValue("customRequirements")
    };
  }

  async listSitePages(scope: TenantScope): Promise<import("@fitos/contracts").SitePageResponse[]> {
    return [...this.sitePages.values()].filter((page) => page.tenantId === scope.tenantId);
  }
  async saveSitePage(
    scope: TenantScope,
    input: import("@fitos/contracts").SaveSitePageRequest
  ): Promise<import("@fitos/contracts").SitePageResponse> {
    if (input.pageId) {
      const selected = this.sitePages.get(input.pageId);
      if (!selected || selected.tenantId !== scope.tenantId)
        throw new Error("Site page not found.");
      const updated = {
        ...selected,
        slug: input.slug,
        title: input.title,
        status: "draft" as const,
        sections: input.sections,
        seo: input.seo ?? {},
        version: selected.version + 1,
        updatedAt: now()
      };
      this.sitePages.set(updated.id, updated);
      return updated;
    }
    const existing = [...this.sitePages.values()].find(
      (page) => page.tenantId === scope.tenantId && page.slug === input.slug
    );
    const ts = now();
    const page = {
      id: existing?.id ?? randomUUID(),
      tenantId: scope.tenantId,
      slug: input.slug,
      title: input.title,
      status: "draft" as const,
      sections: input.sections,
      seo: input.seo ?? {},
      version: (existing?.version ?? 0) + 1,
      publishedAt: existing?.publishedAt ?? null,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts
    };
    this.sitePages.set(page.id, page);
    return page;
  }
  async publishSitePage(
    scope: TenantScope,
    pageId: string
  ): Promise<import("@fitos/contracts").SitePageResponse | null> {
    const page = this.sitePages.get(pageId);
    if (!page || page.tenantId !== scope.tenantId) return null;
    const published = {
      ...page,
      status: "published" as const,
      publishedAt: now(),
      updatedAt: now()
    };
    this.sitePages.set(pageId, published);
    return published;
  }
  async getPublicSitePage(
    tenantSlug: string,
    pageSlug = "home"
  ): Promise<import("@fitos/contracts").SitePageResponse | null> {
    const tenant = [...this.tenants.values()].find((item) => item.slug === tenantSlug);
    return tenant
      ? ([...this.sitePages.values()].find(
          (page) =>
            page.tenantId === tenant.id && page.slug === pageSlug && page.status === "published"
        ) ?? null)
      : null;
  }
  async listOccurrenceEquipmentAllocations(
    scope: TenantScope,
    occurrenceId: string
  ): Promise<import("@fitos/contracts").EquipmentAllocationResponse[]> {
    return [...this.equipmentAllocations.values()].filter(
      (item) => item.tenantId === scope.tenantId && item.occurrenceId === occurrenceId
    );
  }
  async reserveOccurrenceEquipment(
    scope: TenantScope,
    occurrenceId: string,
    assetId: string
  ): Promise<import("@fitos/contracts").EquipmentAllocationResponse> {
    const occurrence = this.occurrences.get(occurrenceId);
    const asset = this.equipmentAssets.get(assetId);
    if (
      !occurrence ||
      !asset ||
      occurrence.tenantId !== scope.tenantId ||
      asset.tenantId !== scope.tenantId ||
      occurrence.branchId !== asset.branchId ||
      asset.status !== "available"
    )
      throw new Error("Equipment asset is unavailable for this occurrence.");
    for (const allocation of this.equipmentAllocations.values()) {
      const other = this.occurrences.get(allocation.occurrenceId);
      if (
        allocation.assetId === assetId &&
        allocation.status === "reserved" &&
        other &&
        other.startsAt < occurrence.endsAt &&
        other.endsAt > occurrence.startsAt
      )
        throw new Error("Equipment asset is already reserved for an overlapping occurrence.");
    }
    const item = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      occurrenceId,
      assetId,
      status: "reserved" as const,
      createdAt: now()
    };
    this.equipmentAllocations.set(item.id, item);
    return item;
  }
  async releaseOccurrenceEquipment(
    scope: TenantScope,
    allocationId: string
  ): Promise<import("@fitos/contracts").EquipmentAllocationResponse | null> {
    const item = this.equipmentAllocations.get(allocationId);
    if (!item || item.tenantId !== scope.tenantId) return null;
    const updated = { ...item, status: "released" as const };
    this.equipmentAllocations.set(allocationId, updated);
    return updated;
  }
  async listServiceInventoryRequirements(
    scope: TenantScope,
    serviceId: string
  ): Promise<import("@fitos/contracts").ServiceInventoryRequirement[]> {
    const service = this.services.get(serviceId);
    return service?.tenantId === scope.tenantId
      ? (this.serviceInventoryRequirements.get(serviceId) ?? [])
      : [];
  }
  async replaceServiceInventoryRequirements(
    scope: TenantScope,
    serviceId: string,
    requirements: import("@fitos/contracts").ServiceInventoryRequirement[]
  ): Promise<import("@fitos/contracts").ServiceInventoryRequirement[]> {
    const service = this.services.get(serviceId);
    if (!service || service.tenantId !== scope.tenantId) throw new Error("Service not found.");
    this.serviceInventoryRequirements.set(serviceId, requirements);
    return requirements;
  }
  async consumeInventory(
    scope: TenantScope,
    input: {
      branchId: string;
      serviceId?: string;
      referenceType: string;
      referenceId: string;
      items: import("@fitos/contracts").ServiceInventoryRequirement[];
    }
  ): Promise<import("@fitos/contracts").InventoryConsumptionResponse[]> {
    const result: import("@fitos/contracts").InventoryConsumptionResponse[] = [];
    for (const req of input.items) {
      const key = `${scope.tenantId}:${req.itemId}:${input.referenceType}:${input.referenceId}`;
      if (this.inventoryConsumptions.has(key)) continue;
      const item = this.inventoryItems.get(req.itemId);
      if (
        !item ||
        item.tenantId !== scope.tenantId ||
        item.branchId !== input.branchId ||
        item.stockOnHand < req.quantityPerSession
      )
        throw new Error("Insufficient inventory stock.");
      item.stockOnHand -= req.quantityPerSession;
      const row = {
        id: randomUUID(),
        tenantId: scope.tenantId,
        branchId: input.branchId,
        itemId: req.itemId,
        serviceId: input.serviceId ?? null,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        quantity: req.quantityPerSession,
        createdAt: now()
      };
      this.inventoryConsumptions.set(key, row);
      result.push(row);
    }
    return result;
  }

  // ─── Equipment & Resource Scheduling ─────────────────────────────────────────
  async listEquipmentAssets(
    scope: TenantScope,
    branchId?: string
  ): Promise<EquipmentAssetResponse[]> {
    return [...this.equipmentAssets.values()].filter((asset) => {
      if (asset.tenantId !== scope.tenantId) return false;
      if (branchId && asset.branchId !== branchId) return false;
      if (scope.branchIds.length && !scope.branchIds.includes(asset.branchId)) return false;
      return true;
    });
  }

  async findEquipmentAssetById(
    scope: TenantScope,
    assetId: string
  ): Promise<EquipmentAssetResponse | null> {
    const asset = this.equipmentAssets.get(assetId);
    if (!asset || asset.tenantId !== scope.tenantId) return null;
    return asset;
  }

  async createEquipmentAsset(
    scope: TenantScope,
    input: CreateEquipmentAssetRequest
  ): Promise<EquipmentAssetResponse> {
    const id = randomUUID();
    const ts = now();
    const branch = this.branches.get(input.branchId);
    const room = input.roomId ? this.rooms.get(input.roomId) : null;
    const asset: EquipmentAssetResponse = {
      id,
      tenantId: scope.tenantId,
      branchId: input.branchId,
      poolId: input.poolId ?? null,
      roomId: input.roomId ?? null,
      branchName: branch?.name ?? null,
      roomName: room?.name ?? null,
      name: input.name,
      assetCode: input.assetCode,
      serialNumber: input.serialNumber ?? null,
      modelName: input.modelName,
      category: input.category,
      status: input.status ?? "available",
      purchaseDate: input.purchaseDate ?? null,
      warrantyEndsAt: input.warrantyEndsAt ?? null,
      lastServicedAt: null,
      nextServiceDueAt: input.nextServiceDueAt ?? null,
      lastCalibratedAt: null,
      nextCalibrationDueAt: input.nextCalibrationDueAt ?? null,
      notes: input.notes ?? null,
      createdAt: ts,
      updatedAt: ts
    };
    this.equipmentAssets.set(id, asset);
    return asset;
  }

  async updateEquipmentAsset(
    scope: TenantScope,
    assetId: string,
    input: UpdateEquipmentAssetRequest
  ): Promise<EquipmentAssetResponse | null> {
    const asset = this.equipmentAssets.get(assetId);
    if (!asset || asset.tenantId !== scope.tenantId) return null;
    if (input.branchId !== undefined) {
      asset.branchId = input.branchId;
      asset.branchName = this.branches.get(input.branchId)?.name ?? null;
    }
    if (input.poolId !== undefined) asset.poolId = input.poolId;
    if (input.roomId !== undefined) {
      asset.roomId = input.roomId;
      asset.roomName = input.roomId ? (this.rooms.get(input.roomId)?.name ?? null) : null;
    }
    if (input.name !== undefined) asset.name = input.name;
    if (input.assetCode !== undefined) asset.assetCode = input.assetCode;
    if (input.serialNumber !== undefined) asset.serialNumber = input.serialNumber;
    if (input.modelName !== undefined) asset.modelName = input.modelName;
    if (input.category !== undefined) asset.category = input.category;
    if (input.status !== undefined) asset.status = input.status;
    if (input.purchaseDate !== undefined) asset.purchaseDate = input.purchaseDate;
    if (input.warrantyEndsAt !== undefined) asset.warrantyEndsAt = input.warrantyEndsAt;
    if (input.nextServiceDueAt !== undefined) asset.nextServiceDueAt = input.nextServiceDueAt;
    if (input.nextCalibrationDueAt !== undefined)
      asset.nextCalibrationDueAt = input.nextCalibrationDueAt;
    if (input.notes !== undefined) asset.notes = input.notes;
    asset.updatedAt = now();
    return asset;
  }

  async listEquipmentPools(
    scope: TenantScope,
    branchId?: string
  ): Promise<EquipmentPoolResponse[]> {
    return [...this.equipmentPools.values()].filter((pool) => {
      if (pool.tenantId !== scope.tenantId) return false;
      if (branchId && pool.branchId !== branchId) return false;
      if (scope.branchIds.length && !scope.branchIds.includes(pool.branchId)) return false;
      return true;
    });
  }

  async createEquipmentPool(
    scope: TenantScope,
    input: CreateEquipmentPoolRequest
  ): Promise<EquipmentPoolResponse> {
    const id = randomUUID();
    const branch = this.branches.get(input.branchId);
    const pool: EquipmentPoolResponse = {
      id,
      tenantId: scope.tenantId,
      branchId: input.branchId,
      branchName: branch?.name ?? null,
      name: input.name,
      category: input.category,
      totalQuantity: input.assetIds.length || 1,
      availableQuantity: input.assetIds.length || 1,
      assetIds: input.assetIds
    };
    this.equipmentPools.set(id, pool);
    return pool;
  }

  async listEquipmentMaintenance(
    scope: TenantScope,
    assetId?: string
  ): Promise<EquipmentMaintenanceRecordResponse[]> {
    return [...this.equipmentMaintenance.values()].filter((record) => {
      if (record.tenantId !== scope.tenantId) return false;
      if (assetId && record.assetId !== assetId) return false;
      return true;
    });
  }

  async createEquipmentMaintenance(
    scope: TenantScope,
    input: CreateMaintenanceRecordRequest
  ): Promise<EquipmentMaintenanceRecordResponse> {
    const asset = this.equipmentAssets.get(input.assetId);
    if (!asset || asset.tenantId !== scope.tenantId) throw new Error("Equipment asset not found.");
    const id = randomUUID();
    const ts = now();
    const record: EquipmentMaintenanceRecordResponse = {
      id,
      tenantId: scope.tenantId,
      assetId: input.assetId,
      assetName: asset.name,
      type: input.type,
      performedAt: ts,
      performedBy: input.performedBy,
      costMinor: input.costMinor ?? null,
      notes: input.notes,
      nextDueAt: input.nextDueAt ?? null,
      createdAt: ts
    };
    this.equipmentMaintenance.set(id, record);

    if (input.type === "maintenance" || input.type === "repair") {
      asset.lastServicedAt = ts;
      if (input.nextDueAt) asset.nextServiceDueAt = input.nextDueAt;
      asset.status = "available";
    } else if (input.type === "calibration") {
      asset.lastCalibratedAt = ts;
      if (input.nextDueAt) asset.nextCalibrationDueAt = input.nextDueAt;
      asset.status = "available";
    }
    asset.updatedAt = ts;
    return record;
  }

  async listServiceEquipmentRequirements(
    scope: TenantScope,
    serviceId: string
  ): Promise<import("@fitos/contracts").ServiceEquipmentRequirement[]> {
    const service = this.services.get(serviceId);
    if (!service || service.tenantId !== scope.tenantId) return [];
    return this.serviceEquipmentRequirements.get(serviceId) ?? [];
  }

  async replaceServiceEquipmentRequirements(
    scope: TenantScope,
    serviceId: string,
    requirements: import("@fitos/contracts").ServiceEquipmentRequirement[]
  ): Promise<import("@fitos/contracts").ServiceEquipmentRequirement[]> {
    const service = this.services.get(serviceId);
    if (!service || service.tenantId !== scope.tenantId) throw new Error("Service not found.");
    for (const r of requirements) {
      const pool = this.equipmentPools.get(r.poolId);
      if (
        !pool ||
        pool.tenantId !== scope.tenantId ||
        (service.branchId && pool.branchId !== service.branchId)
      )
        throw new Error("Equipment pool is not available for this service.");
    }
    this.serviceEquipmentRequirements.set(serviceId, requirements);
    return requirements;
  }

  // ─── Inventory & Consumables ────────────────────────────────────────────────
  async listInventoryItems(
    scope: TenantScope,
    branchId?: string
  ): Promise<InventoryItemResponse[]> {
    return [...this.inventoryItems.values()].filter((item) => {
      if (item.tenantId !== scope.tenantId) return false;
      if (branchId && item.branchId !== branchId) return false;
      if (scope.branchIds.length && !scope.branchIds.includes(item.branchId)) return false;
      return true;
    });
  }

  async findInventoryItemById(
    scope: TenantScope,
    itemId: string
  ): Promise<InventoryItemResponse | null> {
    const item = this.inventoryItems.get(itemId);
    if (!item || item.tenantId !== scope.tenantId) return null;
    return item;
  }

  async createInventoryItem(
    scope: TenantScope,
    input: CreateInventoryItemRequest
  ): Promise<InventoryItemResponse> {
    const id = randomUUID();
    const ts = now();
    const branch = this.branches.get(input.branchId);
    const item: InventoryItemResponse = {
      id,
      tenantId: scope.tenantId,
      branchId: input.branchId,
      branchName: branch?.name ?? null,
      sku: input.sku,
      name: input.name,
      category: input.category,
      unit: input.unit ?? "unit",
      unitCostMinor: input.unitCostMinor,
      retailPriceMinor: input.retailPriceMinor ?? 0,
      stockOnHand: input.initialStock ?? 0,
      reorderPoint: input.reorderPoint ?? 10,
      reorderQuantity: input.reorderQuantity ?? 20,
      isRetail: input.isRetail ?? true,
      isConsumable: input.isConsumable ?? false,
      createdAt: ts,
      updatedAt: ts
    };
    this.inventoryItems.set(id, item);

    if (input.initialStock && input.initialStock > 0) {
      this.inventoryMovements.push({
        id: randomUUID(),
        tenantId: scope.tenantId,
        branchId: input.branchId,
        itemId: id,
        itemName: input.name,
        movementType: "adjustment",
        quantity: input.initialStock,
        referenceType: "initial_stock",
        referenceId: null,
        costMinor: input.initialStock * input.unitCostMinor,
        notes: "Opening inventory balance",
        recordedByUserId: scope.userId,
        recordedByName: "Staff",
        recordedAt: ts
      });
    }

    return item;
  }

  async updateInventoryItem(
    scope: TenantScope,
    itemId: string,
    input: UpdateInventoryItemRequest
  ): Promise<InventoryItemResponse | null> {
    const item = this.inventoryItems.get(itemId);
    if (!item || item.tenantId !== scope.tenantId) return null;
    if (input.name !== undefined) item.name = input.name;
    if (input.category !== undefined) item.category = input.category;
    if (input.unit !== undefined) item.unit = input.unit;
    if (input.unitCostMinor !== undefined) item.unitCostMinor = input.unitCostMinor;
    if (input.retailPriceMinor !== undefined) item.retailPriceMinor = input.retailPriceMinor;
    if (input.reorderPoint !== undefined) item.reorderPoint = input.reorderPoint;
    if (input.reorderQuantity !== undefined) item.reorderQuantity = input.reorderQuantity;
    if (input.isRetail !== undefined) item.isRetail = input.isRetail;
    if (input.isConsumable !== undefined) item.isConsumable = input.isConsumable;
    item.updatedAt = now();
    return item;
  }

  async listInventoryMovements(
    scope: TenantScope,
    itemId?: string
  ): Promise<InventoryMovementResponse[]> {
    return this.inventoryMovements.filter((m) => {
      if (m.tenantId !== scope.tenantId) return false;
      if (itemId && m.itemId !== itemId) return false;
      return true;
    });
  }

  async createInventoryMovement(
    scope: TenantScope,
    input: CreateInventoryMovementRequest,
    recordedByUserId: string
  ): Promise<InventoryMovementResponse> {
    const item = this.inventoryItems.get(input.itemId);
    if (!item || item.tenantId !== scope.tenantId) throw new Error("Inventory item not found.");
    const id = randomUUID();
    const ts = now();

    const isIncoming = input.movementType === "purchase_in" || input.movementType === "adjustment";
    item.stockOnHand = isIncoming
      ? item.stockOnHand + input.quantity
      : Math.max(0, item.stockOnHand - input.quantity);
    item.updatedAt = ts;

    const user = this.users.get(recordedByUserId);
    const movement: InventoryMovementResponse = {
      id,
      tenantId: scope.tenantId,
      branchId: input.branchId,
      itemId: input.itemId,
      itemName: item.name,
      movementType: input.movementType,
      quantity: input.quantity,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      costMinor: input.costMinor ?? null,
      notes: input.notes ?? null,
      recordedByUserId,
      recordedByName: user?.displayName ?? "Staff",
      recordedAt: ts
    };
    this.inventoryMovements.push(movement);
    return movement;
  }

  async listPurchaseOrders(
    scope: TenantScope,
    branchId?: string
  ): Promise<PurchaseOrderResponse[]> {
    return [...this.purchaseOrders.values()].filter((po) => {
      if (po.tenantId !== scope.tenantId) return false;
      if (branchId && po.branchId !== branchId) return false;
      return true;
    });
  }

  async createPurchaseOrder(
    scope: TenantScope,
    input: CreatePurchaseOrderRequest
  ): Promise<PurchaseOrderResponse> {
    const id = randomUUID();
    const ts = now();
    const branch = this.branches.get(input.branchId);
    let totalMinor = 0;
    const items = input.items.map((i) => {
      const item = this.inventoryItems.get(i.itemId);
      const lineTotal = i.quantity * i.unitCostMinor;
      totalMinor += lineTotal;
      return {
        itemId: i.itemId,
        itemName: item?.name ?? "Item",
        quantity: i.quantity,
        unitCostMinor: i.unitCostMinor,
        totalMinor: lineTotal
      };
    });

    const po: PurchaseOrderResponse = {
      id,
      tenantId: scope.tenantId,
      branchId: input.branchId,
      branchName: branch?.name ?? null,
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      supplierName: input.supplierName,
      status: "ordered",
      items,
      totalMinor,
      orderedAt: ts,
      receivedAt: null,
      notes: input.notes ?? null,
      createdAt: ts,
      updatedAt: ts
    };
    this.purchaseOrders.set(id, po);
    return po;
  }

  // ─── FITOS Assess & Performance Profiles ────────────────────────────────────
  async listAssessmentDefinitions(scope: TenantScope): Promise<AssessmentDefinitionResponse[]> {
    return [...this.assessmentDefinitions.values()].filter((d) => d.tenantId === scope.tenantId);
  }

  async createAssessmentDefinition(
    scope: TenantScope,
    input: CreateAssessmentDefinitionRequest
  ): Promise<AssessmentDefinitionResponse> {
    const id = randomUUID();
    const ts = now();
    const def: AssessmentDefinitionResponse = {
      id,
      tenantId: scope.tenantId,
      name: input.name,
      category: input.category,
      description: input.description,
      deviceVendor: input.deviceVendor,
      metrics: input.metrics,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    };
    this.assessmentDefinitions.set(id, def);
    return def;
  }

  async listAssessmentSessions(
    scope: TenantScope,
    memberId?: string,
    branchId?: string
  ): Promise<AssessmentSessionResponse[]> {
    return [...this.assessmentSessions.values()].filter((s) => {
      if (s.tenantId !== scope.tenantId) return false;
      if (memberId && s.memberId !== memberId) return false;
      if (branchId && s.branchId !== branchId) return false;
      if (scope.branchIds.length && !scope.branchIds.includes(s.branchId)) return false;
      return true;
    });
  }

  async createAssessmentSession(
    scope: TenantScope,
    input: CreateAssessmentSessionRequest,
    assessorStaffId: string
  ): Promise<AssessmentSessionResponse> {
    const def = this.assessmentDefinitions.get(input.definitionId);
    if (!def || def.tenantId !== scope.tenantId)
      throw new Error("Assessment definition not found.");
    const member = this.members.get(input.memberId);
    if (!member || member.tenantId !== scope.tenantId) throw new Error("Member not found.");
    const contact = this.contacts.get(member.contactId);
    const branch = this.branches.get(input.branchId);
    const assessor = this.users.get(assessorStaffId);

    const id = randomUUID();
    const ts = now();
    const session: AssessmentSessionResponse = {
      id,
      tenantId: scope.tenantId,
      branchId: input.branchId,
      branchName: branch?.name ?? null,
      memberId: input.memberId,
      memberName: contact ? `${contact.firstName} ${contact.lastName}` : "Member",
      assessorStaffId,
      assessorName: assessor?.displayName ?? "Staff Assessor",
      definitionId: def.id,
      definitionName: def.name,
      category: def.category,
      status: "completed",
      conductedAt: input.conductedAt || ts,
      summary: input.summary,
      metrics: input.metrics,
      provenance: input.provenance ?? { source: "manual" },
      notes: input.notes ?? null,
      createdAt: ts,
      updatedAt: ts
    };
    this.assessmentSessions.set(id, session);
    return session;
  }

  async getMemberPerformanceProfile(
    scope: TenantScope,
    memberId: string
  ): Promise<MemberPerformanceProfileResponse> {
    const member = this.members.get(memberId);
    if (!member || member.tenantId !== scope.tenantId) throw new Error("Member not found.");
    const contact = this.contacts.get(member.contactId);
    const memberName = contact ? `${contact.firstName} ${contact.lastName}` : "Member";

    const sessions = [...this.assessmentSessions.values()]
      .filter((s) => s.tenantId === scope.tenantId && s.memberId === memberId)
      .sort((a, b) => new Date(a.conductedAt).getTime() - new Date(b.conductedAt).getTime());

    const latestSession = sessions[sessions.length - 1];

    return {
      memberId,
      memberName,
      totalAssessments: sessions.length,
      lastAssessedAt: latestSession?.conductedAt ?? null,
      latestMetrics: latestSession?.metrics ?? {},
      timeline: sessions
    };
  }

  // ─── FITOS Therapy & Recovery ───────────────────────────────────────────────
  async listTherapyModalities(scope: TenantScope): Promise<TherapyModalityResponse[]> {
    return [...this.therapyModalities.values()].filter((m) => m.tenantId === scope.tenantId);
  }

  async createTherapyModality(
    scope: TenantScope,
    input: import("@fitos/contracts").CreateTherapyModalityRequest
  ): Promise<TherapyModalityResponse> {
    const ts = now();
    const modality: TherapyModalityResponse = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      ...input,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    };
    this.therapyModalities.set(modality.id, modality);
    return modality;
  }

  async listTherapyProtocols(
    scope: TenantScope,
    modalityCode?: string
  ): Promise<TherapyProtocolResponse[]> {
    return [...this.therapyProtocols.values()].filter((p) => {
      if (p.tenantId !== scope.tenantId) return false;
      if (modalityCode && p.modalityCode !== modalityCode) return false;
      return true;
    });
  }

  async createTherapyProtocol(
    scope: TenantScope,
    input: CreateTherapyProtocolRequest
  ): Promise<TherapyProtocolResponse> {
    const id = randomUUID();
    const ts = now();
    const proto: TherapyProtocolResponse = {
      id,
      tenantId: scope.tenantId,
      modalityCode: input.modalityCode,
      modalityName: input.modalityName,
      name: input.name,
      indication: input.indication,
      targetArea: input.targetArea,
      parameters: input.parameters,
      safetyChecklist: input.safetyChecklist,
      clinicalNotes: input.clinicalNotes,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    };
    this.therapyProtocols.set(id, proto);
    return proto;
  }

  async listTherapySessions(
    scope: TenantScope,
    memberId?: string,
    branchId?: string
  ): Promise<TherapySessionResponse[]> {
    return [...this.therapySessions.values()].filter((s) => {
      if (s.tenantId !== scope.tenantId) return false;
      if (memberId && s.memberId !== memberId) return false;
      if (branchId && s.branchId !== branchId) return false;
      if (scope.branchIds.length && !scope.branchIds.includes(s.branchId)) return false;
      return true;
    });
  }

  async createTherapySession(
    scope: TenantScope,
    input: CreateTherapySessionRequest,
    staffUserId: string
  ): Promise<TherapySessionResponse> {
    const proto = this.therapyProtocols.get(input.protocolId);
    if (!proto || proto.tenantId !== scope.tenantId) throw new Error("Therapy protocol not found.");
    const member = this.members.get(input.memberId);
    if (!member || member.tenantId !== scope.tenantId) throw new Error("Member not found.");
    const contact = this.contacts.get(member.contactId);
    const branch = this.branches.get(input.branchId);
    const staff = this.users.get(staffUserId);
    const asset = input.assetId ? this.equipmentAssets.get(input.assetId) : null;

    const id = randomUUID();
    const ts = now();
    const session: TherapySessionResponse = {
      id,
      tenantId: scope.tenantId,
      branchId: input.branchId,
      branchName: branch?.name ?? null,
      memberId: input.memberId,
      memberName: contact ? `${contact.firstName} ${contact.lastName}` : "Member",
      staffUserId,
      staffName: staff?.displayName ?? "Clinical Staff",
      protocolId: proto.id,
      protocolName: proto.name,
      modalityCode: proto.modalityCode,
      assetId: input.assetId ?? null,
      assetName: asset?.name ?? null,
      status: input.status ?? "completed",
      startedAt: ts,
      completedAt: ts,
      prePainScore: input.prePainScore ?? null,
      postPainScore: input.postPainScore ?? null,
      actualDosage: input.actualDosage,
      adverseReaction: input.adverseReaction ?? false,
      sessionNotes: input.sessionNotes ?? null,
      createdAt: ts,
      updatedAt: ts
    };
    this.therapySessions.set(id, session);
    return session;
  }

  // ─── Inventory Lots & Stocktakes (In-Memory) ────────────────────────────────
  private readonly inventoryLotsMap = new Map<
    string,
    import("@fitos/contracts").InventoryLotResponse
  >();
  private readonly stocktakesMap = new Map<string, import("@fitos/contracts").StocktakeResponse>();

  async listInventoryLots(
    scope: TenantScope,
    itemId?: string
  ): Promise<import("@fitos/contracts").InventoryLotResponse[]> {
    return [...this.inventoryLotsMap.values()].filter(
      (l) => l.tenantId === scope.tenantId && (!itemId || l.itemId === itemId)
    );
  }

  async createInventoryLot(
    scope: TenantScope,
    input: import("@fitos/contracts").CreateInventoryLotRequest
  ): Promise<import("@fitos/contracts").InventoryLotResponse> {
    const id = randomUUID();
    const ts = new Date().toISOString();
    const item = this.inventoryItems.get(input.itemId);
    const lot: import("@fitos/contracts").InventoryLotResponse = {
      id,
      tenantId: scope.tenantId,
      branchId: input.branchId ?? item?.branchId ?? null,
      itemId: input.itemId,
      lotCode: input.lotCode ?? `LOT-${Date.now().toString().slice(-6)}`,
      purchaseOrderId: input.purchaseOrderId ?? null,
      quantityReceived: input.quantityReceived,
      quantityOnHand: input.quantityReceived,
      unitCostMinor: input.unitCostMinor ?? item?.unitCostMinor ?? 0,
      expiresOn: input.expiresOn ?? null,
      receivedAt: ts,
      notes: input.notes ?? null,
      createdAt: ts
    };
    this.inventoryLotsMap.set(id, lot);
    if (item) {
      item.stockOnHand += Math.round(input.quantityReceived);
      this.inventoryItems.set(item.id, item);
    }
    return lot;
  }

  async listExpiringInventoryLots(
    scope: TenantScope,
    daysAhead: number
  ): Promise<import("@fitos/contracts").InventoryLotResponse[]> {
    const targetDate = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);
    return [...this.inventoryLotsMap.values()].filter(
      (l) =>
        l.tenantId === scope.tenantId &&
        l.expiresOn &&
        l.expiresOn <= targetDate &&
        l.quantityOnHand > 0
    );
  }

  async listStocktakes(
    scope: TenantScope,
    branchId?: string
  ): Promise<import("@fitos/contracts").StocktakeResponse[]> {
    return [...this.stocktakesMap.values()].filter(
      (s) => s.tenantId === scope.tenantId && (!branchId || s.branchId === branchId)
    );
  }

  async createStocktake(
    scope: TenantScope,
    input: import("@fitos/contracts").CreateStocktakeRequest,
    createdByUserId: string
  ): Promise<import("@fitos/contracts").StocktakeResponse> {
    const id = randomUUID();
    const ts = new Date().toISOString();
    const items = [...this.inventoryItems.values()].filter(
      (i) => i.tenantId === scope.tenantId && (!input.branchId || i.branchId === input.branchId)
    );
    const lines = items.map((i) => ({
      id: randomUUID(),
      stocktakeId: id,
      itemId: i.id,
      itemName: i.name,
      expectedQuantity: i.stockOnHand,
      countedQuantity: null,
      variance: null
    }));

    const stocktake: import("@fitos/contracts").StocktakeResponse = {
      id,
      tenantId: scope.tenantId,
      branchId: input.branchId ?? null,
      status: "draft",
      notes: input.notes ?? null,
      lines,
      createdByUserId,
      createdAt: ts,
      completedAt: null
    };
    this.stocktakesMap.set(id, stocktake);
    return stocktake;
  }

  async getStocktake(
    scope: TenantScope,
    stocktakeId: string
  ): Promise<import("@fitos/contracts").StocktakeResponse | null> {
    const st = this.stocktakesMap.get(stocktakeId);
    return st && st.tenantId === scope.tenantId ? st : null;
  }

  async recordStocktakeCount(
    scope: TenantScope,
    stocktakeId: string,
    input: import("@fitos/contracts").RecordStocktakeCountRequest
  ): Promise<import("@fitos/contracts").StocktakeResponse> {
    const st = this.stocktakesMap.get(stocktakeId);
    if (!st || st.tenantId !== scope.tenantId) throw new Error("Stocktake not found.");
    const line = st.lines.find((l) => l.itemId === input.itemId);
    if (!line) throw new Error("Stocktake line item not found.");
    line.countedQuantity = input.countedQuantity;
    line.variance = input.countedQuantity - line.expectedQuantity;
    return st;
  }

  async completeStocktake(
    scope: TenantScope,
    stocktakeId: string,
    _actorUserId: string
  ): Promise<import("@fitos/contracts").StocktakeResponse> {
    const st = this.stocktakesMap.get(stocktakeId);
    if (!st || st.tenantId !== scope.tenantId) throw new Error("Stocktake not found.");
    st.status = "completed";
    st.completedAt = new Date().toISOString();
    for (const line of st.lines) {
      if (line.countedQuantity !== null) {
        const item = this.inventoryItems.get(line.itemId);
        if (item) {
          item.stockOnHand = line.countedQuantity;
          this.inventoryItems.set(item.id, item);
        }
      }
    }
    return st;
  }

  async getImplementationInquiryByToken(
    id: string,
    _token: string
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse | null> {
    return this.getImplementationInquiry(id);
  }

  async resolvePlatformAdminByTokenHash(
    tokenHash: string
  ): Promise<{ userId: string; displayName: string; email: string | null } | null> {
    const token = this.platformAdminTokens.get(tokenHash);
    if (!token || token.revokedAt || new Date(token.expiresAt) <= new Date()) return null;
    const user = this.users.get(token.userId);
    if (
      !user ||
      user.status !== "active" ||
      !(user as { isPlatformAdmin?: boolean }).isPlatformAdmin
    )
      return null;
    return { userId: user.id, displayName: user.displayName, email: user.email };
  }

  async findUserById(userId: string): Promise<{
    id: string;
    displayName: string;
    email: string | null;
    isPlatformAdmin: boolean;
  } | null> {
    const user = this.users.get(userId);
    return user
      ? {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          isPlatformAdmin: Boolean((user as { isPlatformAdmin?: boolean }).isPlatformAdmin)
        }
      : null;
  }

  async createPlatformAdminToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<void> {
    this.platformAdminTokens.set(input.tokenHash, { ...input, revokedAt: null });
  }

  async revokePlatformAdminToken(tokenHash: string, at: string): Promise<void> {
    const token = this.platformAdminTokens.get(tokenHash);
    if (token) token.revokedAt = at;
  }

  async revokeAllPlatformAdminTokens(userId: string, at: string): Promise<void> {
    for (const token of this.platformAdminTokens.values()) {
      if (token.userId === userId && !token.revokedAt) token.revokedAt = at;
    }
  }
}
