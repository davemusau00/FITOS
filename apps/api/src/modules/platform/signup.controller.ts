import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  BadRequestException,
  UnauthorizedException
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import type {
  ImplementationInquiryStatus,
  RequestActor,
  SaaSTenantSignupRequest,
  PlatformOverview
} from "@fitos/contracts";
import { PLATFORM_FEATURE_REGISTRY, canTransitionTenantStatus } from "@fitos/contracts";
import { createHash } from "node:crypto";
import { ScryptPasswordHasher, createOpaqueSessionToken } from "@fitos/auth";
import { Public } from "../../common/auth/public.decorator.js";
import { AuthMode } from "../../common/auth/auth-mode.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";
import { RequirePlatformAdmin } from "../../common/auth/require-platform-admin.decorator.js";
import type { FitosRequest } from "../../common/request-context/request-context.js";
import { RequestId } from "../../common/request-context/actor.decorator.js";

const signupSchema = z
  .object({
    gymName: z.string().trim().min(2).max(100),
    slug: z.string().trim().min(2).max(100),
    businessType: z.string().trim().min(1).max(50).default("gym"),
    country: z.string().trim().min(1).max(50).default("Kenya"),
    timezone: z.string().trim().min(1).max(50).default("Africa/Nairobi"),
    currency: z.string().trim().min(3).max(3).default("KES"),
    branchName: z.string().trim().min(1).max(100).default("Main Branch"),
    branchAddress: z.string().trim().max(200).optional(),
    ownerName: z.string().trim().min(2).max(100),
    ownerEmail: z.string().trim().email(),
    ownerPhone: z.string().trim().max(30).optional(),
    password: z.string().min(8).max(100)
  })
  .strict();

const inquirySchema = z
  .object({
    id: z.string().uuid().optional(),
    contactName: z.string().trim().max(160).optional(),
    businessName: z.string().trim().max(160).optional(),
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().max(60).optional(),
    country: z.string().trim().max(80).optional(),
    businessType: z.string().trim().max(80).optional(),
    payload: z.record(z.unknown())
  })
  .strict();

const platformLoginSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1)
  })
  .strict();

const hasher = new ScryptPasswordHasher();

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 28_800) * 1_000
});

@ApiTags("platform")
@Controller("platform")
export class PlatformController {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  @Public()
  @Post("signup")
  async signup(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = signupSchema.parse(body) as SaaSTenantSignupRequest;
    const passwordHash = await hasher.hash(input.password);
    const result = await this.repository.signupTenant(input, passwordHash);

    if (result.token) {
      response.cookie("fitos_session", result.token, cookieOptions());
      if (result.csrfToken) {
        response.cookie("fitos_csrf", result.csrfToken, {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 28_800) * 1_000
        });
      }
    }

    return result;
  }

  @Public()
  @AuthMode("public")
  @Post("auth/login")
  async platformAdminLogin(@Body() body: unknown) {
    const { email, password } = platformLoginSchema.parse(body);
    const identity = await this.repository.findLoginIdentity(email);
    if (!identity) throw new UnauthorizedException("Invalid credentials.");
    const verified = await hasher.verify(password, identity.passwordHash);
    if (!verified) throw new UnauthorizedException("Invalid credentials.");

    const platformUser = await this.repository.findUserById(identity.user.id);
    if (!platformUser || !platformUser.isPlatformAdmin) {
      throw new UnauthorizedException("Access denied: Not a platform administrator.");
    }

    // Generate a platform bearer token
    const rawToken = createOpaqueSessionToken();
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(
      Date.now() + Number(process.env.PLATFORM_TOKEN_TTL_SECONDS ?? 28_800) * 1_000
    ).toISOString();
    await this.repository.createPlatformAdminToken({
      userId: platformUser.id,
      tokenHash,
      expiresAt
    });
    return {
      token: rawToken,
      expiresAt,
      user: {
        id: platformUser.id,
        displayName: platformUser.displayName,
        email: platformUser.email
      }
    };
  }

  @Post("auth/logout")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async platformAdminLogout(@Req() request: FitosRequest) {
    const rawToken = request.header("x-platform-token");
    if (rawToken)
      await this.repository.revokePlatformAdminToken(
        createHash("sha256").update(rawToken).digest("hex"),
        new Date().toISOString()
      );
    return { ok: true };
  }

  @Post("auth/revoke-all")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async revokeAllPlatformTokens(@Req() request: FitosRequest) {
    if (request.platformActor)
      await this.repository.revokeAllPlatformAdminTokens(
        request.platformActor.userId,
        new Date().toISOString()
      );
    return { ok: true };
  }

  @Get("auth/me")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  platformAdminMe(@Req() request: FitosRequest) {
    return request.platformActor;
  }

  @Public()
  @Post("implementation-inquiries/draft")
  saveInquiryDraft(@Body() body: unknown) {
    return this.repository.saveImplementationInquiry(inquirySchema.parse(body), false);
  }

  @Public()
  @Post("implementation-inquiries/submit")
  submitInquiry(@Body() body: unknown) {
    const input = inquirySchema
      .extend({
        contactName: z.string().trim().min(2).max(160),
        businessName: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(255)
      })
      .parse(body);
    return this.repository.saveImplementationInquiry(input, true);
  }

  @Public()
  @Get("implementation-inquiries/:id/resume")
  async resumeInquiry(@Param("id") id: string, @Query("token") token: string) {
    if (!token) throw new UnauthorizedException("Resume token is required.");
    const inquiry = await this.repository.getImplementationInquiryByToken(id, token);
    if (!inquiry) throw new NotFoundException("Draft inquiry not found or resume token expired.");
    return inquiry;
  }

  @Public()
  @Post("implementation-inquiries/:id/email-link")
  async emailResumeLink(@Param("id") id: string, @Body() body: unknown) {
    const parsed = z.object({ email: z.string().email() }).parse(body);
    const inquiry = await this.repository.getImplementationInquiry(id);
    if (!inquiry) throw new NotFoundException("Inquiry not found.");
    throw new ServiceUnavailableException(
      `Resume email delivery is not configured for ${parsed.email}.`
    );
  }

  // ─── Platform Admin Protected Endpoints ─────────────────────────────────────
  @Get("implementation-inquiries")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  listInquiries(@Query("status") status?: string) {
    return this.repository.listImplementationInquiries(
      status as ImplementationInquiryStatus | undefined
    );
  }

  @Get("tenants")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  listTenants() {
    return this.repository.listPlatformTenantControls();
  }

  @Get("tenants/:tenantId")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async getTenant(@Param("tenantId") tenantId: string) {
    const tenant = (await this.repository.listPlatformTenantControls()).find(
      (record) => record.tenant.id === tenantId
    );
    if (!tenant) throw new NotFoundException("Tenant control record not found.");
    return tenant;
  }

  @Get("features")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  listPlatformFeatures() {
    return PLATFORM_FEATURE_REGISTRY;
  }

  @Get("plans")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async listPlatformPlans() {
    return this.repository.listPlatformPlanDefinitions();
  }

  @Patch("plans/:key")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async updatePlatformPlan(
    @Param("key") key: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().min(1).max(500),
        quotas: z
          .object({
            maxMembers: z.number().int().nonnegative(),
            maxStaff: z.number().int().nonnegative(),
            maxBranches: z.number().int().nonnegative(),
            maxAutomationRuns: z.number().int().nonnegative(),
            maxStorageMb: z.number().int().nonnegative()
          })
          .strict(),
        capabilities: z.array(z.string()).max(50),
        isActive: z.boolean().optional(),
        reason: z.string().trim().min(3).max(500)
      })
      .strict()
      .parse(body);
    const planKey = z
      .enum(["starter", "pro", "business"])
      .parse(key) as import("@fitos/contracts").SaaSPlan;
    const before =
      (await this.repository.listPlatformPlanDefinitions()).find((plan) => plan.key === planKey) ??
      null;
    const allowedCapabilities = new Set(PLATFORM_FEATURE_REGISTRY.map((feature) => feature.key));
    if (input.capabilities.some((capability) => !allowedCapabilities.has(capability as never))) {
      throw new BadRequestException("Plan capabilities must come from the FITOS feature registry.");
    }
    const updated = await this.repository.updatePlatformPlanDefinition(planKey, {
      ...input,
      capabilities: input.capabilities as import("@fitos/contracts").SaaSCapabilityKey[]
    });
    if (!updated) throw new NotFoundException("Plan definition not found or inactive.");
    await this.repository.recordAudit({
      tenantId: "",
      actorUserId: request.platformActor?.userId ?? null,
      action: "platform.plan_definition_updated",
      resourceType: "platform_plan_definition",
      resourceId: planKey,
      beforeSummary: before as Record<string, unknown> | null,
      afterSummary: { ...updated, reason: input.reason },
      requestId
    });
    return updated;
  }

  @Patch("tenants/:tenantId/status")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async transitionTenantStatus(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        status: z.enum(["trial", "active", "grace", "suspended", "cancelled", "archived"]),
        reason: z.string().trim().min(3).max(500)
      })
      .strict()
      .parse(body);
    const current = (await this.repository.listPlatformTenantControls()).find(
      (item) => item.tenant.id === tenantId
    );
    if (!current) throw new NotFoundException("Tenant not found.");
    if (!canTransitionTenantStatus(current.subscription.status, input.status)) {
      throw new BadRequestException(
        `Cannot transition tenant from ${current.subscription.status} to ${input.status}.`
      );
    }
    const updated = await this.repository.transitionTenantSubscriptionStatus(
      tenantId,
      input.status
    );
    if (!updated) throw new NotFoundException("Tenant subscription not found.");
    await this.repository.recordAudit({
      tenantId,
      actorUserId: request.platformActor?.userId ?? null,
      action: "tenant.subscription_status_changed",
      resourceType: "tenant_subscription",
      resourceId: tenantId,
      beforeSummary: { status: current.subscription.status },
      afterSummary: { status: input.status, reason: input.reason },
      requestId
    });
    return updated;
  }

  @Patch("tenants/:tenantId/capabilities")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async updateTenantCapabilities(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        capabilities: z.array(z.string()).max(100),
        reason: z.string().trim().min(3).max(500)
      })
      .strict()
      .parse(body);
    const allowed = new Set(PLATFORM_FEATURE_REGISTRY.map((feature) => feature.key));
    if (input.capabilities.some((key) => !allowed.has(key as never))) {
      throw new BadRequestException("Unknown platform capability.");
    }
    const current = (await this.repository.listPlatformTenantControls()).find(
      (item) => item.tenant.id === tenantId
    );
    if (!current) throw new NotFoundException("Tenant not found.");
    const updated = await this.repository.updateTenantCapabilities(
      tenantId,
      input.capabilities as import("@fitos/contracts").SaaSCapabilityKey[]
    );
    if (!updated) throw new NotFoundException("Tenant subscription not found.");
    await this.repository.recordAudit({
      tenantId,
      actorUserId: request.platformActor?.userId ?? null,
      action: "tenant.capabilities_changed",
      resourceType: "tenant_subscription",
      resourceId: tenantId,
      beforeSummary: { capabilities: current.subscription.capabilities },
      afterSummary: { capabilities: updated.capabilities, reason: input.reason },
      requestId
    });
    return updated;
  }

  @Get("audit")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async platformAudit() {
    return this.repository.listPlatformAuditEvents();
  }

  @Get("account-export-requests")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async accountExportRequests() {
    return this.repository.listPlatformAccountExportRequests();
  }
  @Patch("account-export-requests/:requestId")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async updateAccountExportRequest(
    @Param("requestId") requestId: string,
    @Body() body: unknown,
    @RequestId() requestIdHeader: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        status: z.enum(["requested", "processing", "completed", "failed"]),
        reason: z.string().trim().min(3).max(500)
      })
      .strict()
      .parse(body);
    const updated = await this.repository.updateAccountExportRequestStatus(requestId, input.status);
    if (!updated) throw new NotFoundException("Account export request not found.");
    await this.repository.recordAudit({
      tenantId: updated.tenantId,
      actorUserId: request.platformActor?.userId ?? null,
      action: "account.export_status_changed",
      resourceType: "account_export_request",
      resourceId: requestId,
      beforeSummary: { status: "requested" },
      afterSummary: { status: updated.status, reason: input.reason },
      requestId: requestIdHeader
    });
    return updated;
  }

  @Get("plan-change-requests")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async planChangeRequests() {
    return this.repository.listPlatformPlanChangeRequests();
  }

  @Get("cancellation-requests")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async cancellationRequests() {
    return this.repository.listPlatformAccountCancellationRequests();
  }
  @Get("deletion-requests")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async deletionRequests() {
    return this.repository.listPlatformAccountDeletionRequests();
  }

  @Patch("deletion-requests/:requestId")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async decideDeletionRequest(
    @Param("requestId") requestId: string,
    @Body() body: unknown,
    @RequestId() requestIdHeader: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        status: z.enum(["reviewing", "approved", "rejected"]),
        reason: z.string().trim().min(3).max(500)
      })
      .strict()
      .parse(body);
    const updated = await this.repository.decideAccountDeletionRequest(
      requestId,
      input.status,
      input.reason,
      request.platformActor?.userId ?? ""
    );
    if (!updated) throw new NotFoundException("Deletion request not found or already decided.");
    await this.repository.recordAudit({
      tenantId: updated.tenantId,
      actorUserId: request.platformActor?.userId ?? null,
      action: "account.deletion_decided",
      resourceType: "account_deletion_request",
      resourceId: requestId,
      beforeSummary: { status: "requested" },
      afterSummary: { status: updated.status, reason: input.reason },
      requestId: requestIdHeader
    });
    return updated;
  }

  @Patch("cancellation-requests/:requestId")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async decideCancellationRequest(
    @Param("requestId") requestId: string,
    @Body() body: unknown,
    @RequestId() requestIdHeader: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        status: z.enum(["reviewing", "approved", "rejected"]),
        reason: z.string().trim().min(3).max(500)
      })
      .strict()
      .parse(body);
    const updated = await this.repository.decideAccountCancellationRequest(
      requestId,
      input.status,
      input.reason,
      request.platformActor?.userId ?? ""
    );
    if (!updated) throw new NotFoundException("Cancellation request not found or already decided.");
    await this.repository.recordAudit({
      tenantId: updated.tenantId,
      actorUserId: request.platformActor?.userId ?? null,
      action: "account.cancellation_decided",
      resourceType: "account_cancellation_request",
      resourceId: requestId,
      beforeSummary: { status: "requested" },
      afterSummary: { status: updated.status, reason: input.reason },
      requestId: requestIdHeader
    });
    return updated;
  }

  @Patch("plan-change-requests/:requestId")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async decidePlanChangeRequest(
    @Param("requestId") requestId: string,
    @Body() body: unknown,
    @RequestId() requestIdHeader: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        status: z.enum(["approved", "rejected"]),
        reason: z.string().trim().min(3).max(500),
        effectiveAt: z.string().datetime().nullable().optional()
      })
      .strict()
      .parse(body);
    const updated = await this.repository.decidePlanChangeRequest(
      requestId,
      input.status,
      input.reason,
      request.platformActor?.userId ?? "",
      input.effectiveAt ? new Date(input.effectiveAt) : null
    );
    if (!updated) throw new NotFoundException("Plan change request not found or already decided.");
    await this.repository.recordAudit({
      tenantId: updated.tenantId,
      actorUserId: request.platformActor?.userId ?? null,
      action: "account.plan_change_decided",
      resourceType: "plan_change_request",
      resourceId: requestId,
      beforeSummary: { status: "requested", requestedPlan: updated.requestedPlan },
      afterSummary: { status: updated.status, reason: input.reason },
      requestId: requestIdHeader
    });
    return updated;
  }

  @Get("overview")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async overview(): Promise<PlatformOverview> {
    const [tenants, inquiries, databaseReady, exports, plans, cancellations, deletions] =
      await Promise.all([
        this.repository.listPlatformTenantControls(),
        this.repository.listImplementationInquiries(),
        this.repository.ping(),
        this.repository.listPlatformAccountExportRequests(),
        this.repository.listPlatformPlanChangeRequests(),
        this.repository.listPlatformAccountCancellationRequests(),
        this.repository.listPlatformAccountDeletionRequests()
      ]);
    const count = (status: string) =>
      tenants.filter((item) => item.subscription.status === status).length;
    const statuses = [
      "draft",
      "submitted",
      "qualified",
      "needs_clarification",
      "approved",
      "converted",
      "archived"
    ];
    const implementation = Object.fromEntries(
      statuses.map((status) => [status, inquiries.filter((item) => item.status === status).length])
    ) as PlatformOverview["implementation"];
    const attention: PlatformOverview["attention"] = tenants.flatMap(
      (item): PlatformOverview["attention"] => {
        const ratio = item.usage.maxMembers ? item.usage.activeMembers / item.usage.maxMembers : 0;
        if (item.subscription.status === "suspended")
          return [
            {
              key: `suspended:${item.tenant.id}`,
              severity: "critical" as const,
              label: `${item.tenant.name} is suspended`,
              count: 1
            }
          ] satisfies PlatformOverview["attention"];
        if (ratio >= 0.9)
          return [
            {
              key: `quota:${item.tenant.id}`,
              severity: "warning" as const,
              label: `${item.tenant.name} is nearing its member quota`,
              count: 1
            }
          ] satisfies PlatformOverview["attention"];
        return [];
      }
    );
    const pending = (items: Array<{ status: string }>) =>
      items.filter((item) => ["requested", "reviewing", "processing"].includes(item.status)).length;
    for (const [key, label, countValue] of [
      ["account-exports", "account export requests", pending(exports)],
      ["plan-changes", "plan-change requests", pending(plans)],
      ["cancellations", "cancellation requests", pending(cancellations)],
      ["deletions", "deletion requests", pending(deletions)]
    ] as const) {
      if (countValue)
        attention.push({
          key,
          severity: "warning",
          label: `${countValue} ${label} need review`,
          count: countValue
        });
    }
    return {
      tenants: {
        total: tenants.length,
        active: count("active"),
        trial: count("trial"),
        onboarding: 0,
        suspended: count("suspended"),
        cancelled: count("cancelled"),
        archived: count("archived")
      },
      activity: {
        activeMembers: tenants.reduce((sum, item) => sum + item.usage.activeMembers, 0),
        automationRunsToday: null,
        bookingsToday: null,
        sessionsToday: null
      },
      implementation,
      health: {
        api: "ok",
        database: databaseReady ? "ok" : "degraded",
        redis: "unknown",
        workers: "unknown",
        queues: "unknown"
      },
      attention
    };
  }

  @Get("implementation-inquiries/:id")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  getInquiry(@Param("id") id: string) {
    return this.repository.getImplementationInquiry(id);
  }

  @Patch("implementation-inquiries/:id/status")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  updateInquiry(@Param("id") id: string, @Body() body: unknown) {
    const input = z
      .object({
        status: z.enum([
          "draft",
          "submitted",
          "qualified",
          "needs_clarification",
          "approved",
          "converted",
          "archived"
        ])
      })
      .strict()
      .parse(body);
    return this.repository.updateImplementationInquiryStatus(id, input.status);
  }

  @Get("implementation-inquiries/:id/seed-manifest")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  seedManifest(@Param("id") id: string) {
    return this.repository.buildTenantSeedManifest(id);
  }

  // ─── Tenant Settings / Quotas ───────────────────────────────────────────────
  @Get("subscription")
  subscription(@Actor() actor: RequestActor) {
    return this.repository.getTenantSubscription(actor.tenantId);
  }

  @Get("usage")
  usage(@Actor() actor: RequestActor) {
    return this.repository.getTenantUsageQuotas(actor.tenantId);
  }

  @Get("feature-flags")
  featureFlags(@Actor() actor: RequestActor) {
    return this.repository.listFeatureFlags(actor.tenantId);
  }

  @Get("feature-flag-overrides")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  listFeatureFlagOverrides() {
    return this.repository.listPlatformFeatureFlagOverrides();
  }

  @Post("feature-flag-overrides")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async createFeatureFlagOverride(
    @Body() body: unknown,
    @RequestId() requestId: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        key: z.string(),
        scope: z.enum(["global", "plan", "tenant", "pilot"]),
        scopeValue: z.string().trim().min(1).max(160).nullable(),
        enabled: z.boolean(),
        reason: z.string().trim().min(3).max(500),
        previousEnabled: z.boolean().nullable().optional(),
        effectiveFrom: z.string().datetime().nullable().optional(),
        effectiveUntil: z.string().datetime().nullable().optional()
      })
      .strict()
      .parse(body);
    const definition = PLATFORM_FEATURE_REGISTRY.find((feature) => feature.key === input.key);
    if (!definition) throw new BadRequestException("Unknown feature flag key.");
    if (input.scope === "global" && input.scopeValue !== null)
      throw new BadRequestException("Global overrides cannot include a scope value.");
    if (input.scope !== "global" && !input.scopeValue)
      throw new BadRequestException("This override scope requires a scope value.");
    const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : null;
    const effectiveUntil = input.effectiveUntil ? new Date(input.effectiveUntil) : null;
    if (effectiveFrom && effectiveUntil && effectiveUntil <= effectiveFrom)
      throw new BadRequestException("effectiveUntil must be after effectiveFrom.");
    const created = await this.repository.createPlatformFeatureFlagOverride({
      key: definition.key,
      scope: input.scope,
      scopeValue: input.scopeValue,
      enabled: input.enabled,
      reason: input.reason,
      actorUserId: request.platformActor?.userId ?? null,
      previousEnabled: input.previousEnabled ?? null,
      effectiveFrom: effectiveFrom?.toISOString() ?? null,
      effectiveUntil: effectiveUntil?.toISOString() ?? null
    });
    await this.repository.recordAudit({
      tenantId: "",
      actorUserId: request.platformActor?.userId ?? null,
      action: "platform.feature_flag_override_created",
      resourceType: "platform_feature_flag_override",
      resourceId: created.id,
      beforeSummary: {
        enabled: created.previousEnabled,
        scope: created.scope,
        scopeValue: created.scopeValue
      },
      afterSummary: {
        enabled: created.enabled,
        scope: created.scope,
        scopeValue: created.scopeValue,
        reason: created.reason
      },
      requestId
    });
    return created;
  }

  @Get("tenants/:tenantId/support-notes")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  listSupportNotes(@Param("tenantId") tenantId: string) {
    return this.repository.listPlatformSupportNotes(tenantId);
  }

  @Post("tenants/:tenantId/support-notes")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async createSupportNote(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        category: z.enum(["implementation", "support", "account", "risk"]),
        note: z.string().trim().min(1).max(5000)
      })
      .strict()
      .parse(body);
    const created = await this.repository.createPlatformSupportNote({
      tenantId,
      authorUserId: request.platformActor?.userId ?? null,
      ...input
    });
    await this.repository.recordAudit({
      tenantId,
      actorUserId: request.platformActor?.userId ?? null,
      action: "platform.support_note_created",
      resourceType: "platform_support_note",
      resourceId: created.id,
      beforeSummary: null,
      afterSummary: { category: created.category, note: created.note },
      requestId
    });
    return created;
  }

  @Get("tenants/:tenantId/recovery-cases")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  listAccountRecoveryCases(@Param("tenantId") tenantId: string) {
    return this.repository.listPlatformAccountRecoveryCases(tenantId);
  }

  @Post("tenants/:tenantId/recovery-cases")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async createAccountRecoveryCase(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        subject: z
          .object({
            userId: z.string().uuid().nullable().optional(),
            email: z.string().email().nullable().optional(),
            phone: z.string().trim().min(3).max(40).nullable().optional(),
            displayName: z.string().trim().max(160).nullable().optional()
          })
          .strict()
          .refine(
            (subject) => Boolean(subject.userId || subject.email || subject.phone),
            "A user ID, email, or phone is required to identify the recovery subject."
          ),
        verificationMetadata: z.record(z.unknown()).default({}),
        actionType: z.enum(["verification", "recovery_step", "note"]).default("verification"),
        actionDetail: z.string().trim().min(3).max(1000),
        revokeSessions: z.boolean().default(false),
        outcome: z.enum(["pending", "resolved", "denied"]).default("pending")
      })
      .strict()
      .parse(body);
    if (input.revokeSessions && !input.subject.userId)
      throw new BadRequestException("Session revocation requires the subject user ID.");

    const at = new Date().toISOString();
    const revokedCount = input.revokeSessions
      ? await this.repository.revokeAllUserSessionsForTenant(input.subject.userId!, tenantId, at)
      : 0;
    const actions = [
      { type: input.actionType, detail: input.actionDetail, at },
      ...(input.revokeSessions
        ? [
            {
              type: "session_revocation" as const,
              detail: `Revoked ${revokedCount} active staff session(s).`,
              at
            }
          ]
        : [])
    ];
    const created = await this.repository.createPlatformAccountRecoveryCase({
      tenantId,
      subject: input.subject,
      verificationMetadata: input.verificationMetadata,
      actions,
      sessionRevocation: {
        requested: input.revokeSessions,
        revokedCount,
        completedAt: input.revokeSessions ? at : null
      },
      outcome: input.outcome,
      actorUserId: request.platformActor?.userId ?? null
    });
    await this.repository.recordAudit({
      tenantId,
      actorUserId: request.platformActor?.userId ?? null,
      action: "platform.account_recovery_case_created",
      resourceType: "platform_account_recovery_case",
      resourceId: created.id,
      beforeSummary: null,
      afterSummary: {
        subject: created.subject,
        outcome: created.outcome,
        sessionRevocation: created.sessionRevocation,
        actionCount: created.actions.length
      },
      requestId
    });
    return created;
  }

  @Get("notices")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  listSystemNotices() {
    return this.repository.listPlatformSystemNotices();
  }

  @Post("notices")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async createSystemNotice(
    @Body() body: unknown,
    @RequestId() requestId: string,
    @Req() request: FitosRequest
  ) {
    const input = z
      .object({
        scope: z.enum(["global", "plan", "tenant"]),
        scopeValue: z.string().trim().min(1).max(160).nullable(),
        title: z.string().trim().min(3).max(180),
        body: z.string().trim().min(3).max(10000),
        startsAt: z.string().datetime(),
        expiresAt: z.string().datetime().nullable().optional(),
        requiresAcknowledgement: z.boolean().default(false)
      })
      .strict()
      .parse(body);
    if (input.scope === "global" && input.scopeValue !== null)
      throw new BadRequestException("Global notices cannot include a scope value.");
    if (input.scope !== "global" && !input.scopeValue)
      throw new BadRequestException("Plan and tenant notices require a scope value.");
    if (input.scope === "plan" && !["starter", "pro", "business"].includes(input.scopeValue!))
      throw new BadRequestException("Plan notices require a canonical plan key.");
    if (input.scope === "tenant" && !z.string().uuid().safeParse(input.scopeValue).success)
      throw new BadRequestException("Tenant notices require a valid tenant ID.");
    const startsAt = new Date(input.startsAt);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt <= startsAt)
      throw new BadRequestException("expiresAt must be after startsAt.");
    const created = await this.repository.createPlatformSystemNotice({
      scope: input.scope,
      scopeValue: input.scopeValue,
      title: input.title,
      body: input.body,
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt?.toISOString() ?? null,
      requiresAcknowledgement: input.requiresAcknowledgement,
      actorUserId: request.platformActor?.userId ?? null
    });
    await this.repository.recordAudit({
      tenantId: "",
      actorUserId: request.platformActor?.userId ?? null,
      action: "platform.system_notice_created",
      resourceType: "platform_system_notice",
      resourceId: created.id,
      beforeSummary: null,
      afterSummary: {
        scope: created.scope,
        scopeValue: created.scopeValue,
        title: created.title,
        startsAt: created.startsAt,
        expiresAt: created.expiresAt,
        requiresAcknowledgement: created.requiresAcknowledgement
      },
      requestId
    });
    return created;
  }
}
