# FITOS V2 — ROADMAP GAP MATRIX

## Priority Definitions

### P0 — Release blocker

Must be resolved before release candidate.

### P1 — Core product gap

Does not always prevent build/release, but significantly compromises core product integrity or roadmap completion.

### P2 — Important completion/polish

Required for roadmap completeness but can follow core operating workflows.

---

# P0 TICKETS

## P0-001 — Restore V2 CI Green

**Area:** Engineering / Release  
**Current state:** The CI workflow declares the full required verification chain, including Playwright, build, production configuration/image/smoke, dependency audit, and secret scan. A current green hosted run remains unverified in this checkout.

**Implementation evidence (2026-08-31):** `.github/workflows/ci.yml` runs formatting, lint, typecheck, migrations/seeding, unit/integration tests, Playwright, build, Compose/Prometheus validation, production image and smoke checks, dependency audit, and Gitleaks in one job, so failures prevent later stages from being reported as passing. With PostgreSQL configured and `RUN_DATABASE_TESTS=true`, the complete API suite passes 13 files and 77 tests; web tests and the production web build also pass locally. Hosted CI status, Playwright execution, and production-image stages are still required to close P0-001.

### Acceptance

- All existing Playwright tests pass.
- Build stage executes.
- Production configuration validation executes.
- Production image/smoke stages execute.
- Dependency/security stages execute.
- Entire required CI workflow passes.

---

## P0-002 — Fix FITOS Sites Block Contract

**Area:** Sites  
**Current state:** Frontend block types now derive from the server/shared controlled block contract.

### Acceptance

- One authoritative Site block schema.
- Frontend builder uses shared types directly.
- Server validation accepts the exact controlled block set.
- No unsafe `as unknown as SiteSection[]` bridge.
- Existing default page saves successfully.

**Implementation evidence (2026-08-28):** `SitesPage.tsx` derives `SiteBlockType` from
`SiteSection["type"]`, uses canonical `hero`, `rich_text`, `cta`, `service_grid`, and `schedule`
types, and submits sections without an unsafe cast. Persisted pages populate the editor and dirty
draft replacement/unload guards are implemented; save/reload runtime verification remains open.

---

## P0-003 — Make Persisted Site Pages Editable

**Area:** Sites  
**Current state:** Persisted pages can be selected and loaded into the editor; edits are tracked and submitted through the existing save mutation.

**Implementation evidence (2026-08-28):** `SitesPage` selects the first persisted page, supports keyboard-accessible page selection, hydrates title/slug/sections/SEO/theme, sends the selected `pageId` on save, prevents accidental replacement of dirty drafts, guards browser unload, and invalidates the page query after save. Both in-memory and Drizzle repositories update the tenant-scoped selected page when `pageId` is supplied; otherwise legacy slug upsert behavior is preserved. The PostgreSQL regression path now creates a page when fixtures are empty, edits it by ID, reloads it, and verifies the persisted title, section, and incremented version; `drizzle-tenancy.test.ts` passes 12/12. Contracts, API, and web typechecks pass.

### Acceptance

- User can select persisted page.
- Draft loads into editor.
- User edits and saves.
- Reload preserves edit.
- Correct page is updated.
- Unsaved-change handling exists.

---

## P0-004 — Inventory Receive Lot Must Work

**Area:** Inventory  
**Current state:** The Receive Lot action opens a validated, persisted workflow and the Drizzle repository now transactionally creates the lot, stock movement, and item stock recalculation.

**Implementation evidence (2026-08-28):** `InventoryPage` renders a Receive Inventory Lot modal with required item and quantity validation, optional branch, lot/batch code, expiry, notes, pending/error feedback, and canonical reload after `POST /inventory/lots`. The Drizzle repository locks and validates the item, updates stock, inserts the lot and `purchase_in` movement in one transaction, and returns the canonical lot. API and web typechecks pass. Forward migrations `0031_guard_advanced_integrity_trigger.sql` and `0032_align_inventory_lots_schema.sql` repair the PostgreSQL trigger/schema drift found during verification. With PostgreSQL configured and `RUN_DATABASE_TESTS=true`, the focused tenancy suite passes 12/12 and the complete API suite passes 54/54.

### Acceptance

- Receive Lot opens actual workflow.
- Item required.
- Quantity required.
- Lot/batch supported.
- Expiry supported.
- Receipt creates lot and inventory movement atomically.
- Stock recalculates.
- UI refreshes canonical data.
- Tests cover persistence.

---

## P0-005 — Protect V2 Release Branch

**Area:** Engineering governance

### Acceptance

- Required CI is enforced before merge/release.
- Force push restricted.
- Release path documented.
- Direct bypass limited to authorized emergency use.

---

# P1 TICKETS

## P1-001 — True All Locations Branch Context

**Current state:** Branch context persists a concrete branch and the shell falls back to an “All Locations” label when no branch is selected, but there is no explicit all-location menu option or multi-branch read contract. Operational queries therefore correctly require a concrete branch.

**Implementation evidence (2026-08-28):** `branch-context.tsx` validates persisted branch IDs against server-provided branches and defaults to the first authorized branch; `shell.tsx` only renders “All Locations” as a fallback label. The current context deliberately does not make that label selectable because operational APIs and mutations still require a concrete branch. P1-001 remains open until explicit multi-branch reads and safe all-location query semantics exist.

### Acceptance

- Branch context supports concrete branch or `all`.
- Read APIs support multi-branch where appropriate.
- Query keys include branch scope.
- Branch switch updates every relevant screen.
- Mutations requiring branch demand concrete branch.

---

## P1-002 — Shared Branch Query-Key Strategy

**Current state:** A canonical branch query-key helper exists and core Ops, Insights, Attendance, Reception, Bookings, New Booking, Members, Memberships, Overview, Coach, and Schedule queries now use it; broader screen migration remains in progress.

**Implementation evidence (2026-08-28):** `apps/web/src/lib/query-keys.ts` emits stable `{ branchId }` scope segments (including explicit `all`), and `OpsDashboardPage`, `InsightsPage`, `AttendancePage`, `ReceptionPage`, `BookingsPage`, `NewBookingPage`, `MembersPage`, `MembershipsPage`, `OverviewPage`, `CoachDashboardPage`, `SchedulePage`, `ServicesPage`, and `LeadsPage` consume the factory for their branch-sensitive reads. New Booking now fetches services and rooms for the active branch rather than all locations. Membership member lookup now sends the selected branch to the API and keys it through the same factory. Booking, attendance, roster, membership, member-detail, schedule, services/rooms, and lead mutations now invalidate the factory's resource-root keys, preventing stale branch-scoped caches after writes. `apps/web/test/query-keys.test.ts` verifies null/undefined normalization and concrete suffix stability. Remaining branch-sensitive screens require migration and review.

### Acceptance

- Common query-key factories.
- No stale cross-branch cache.
- Core screens migrated.

---

## P1-003 — Shared Date Context

**Current state:** Shared local-time date helpers now power Reception and Schedule defaults, while Attendance supports operator-selected calendar-day filtering; operator-selected date context across Ops, Schedule, and Analytics remains open.

**Implementation evidence (2026-08-28):** `apps/web/src/lib/date-context.ts` derives an ISO date from the browser’s local timezone and computes local calendar-day bounds, while `ReceptionPage` plus the Schedule creation workflow use local dates instead of UTC string truncation, preventing near-midnight date drift. Reception’s schedule cache now keys by the actual local date rather than a static “today” token. Attendance now exposes a date selector, sends explicit local-day `from`/`to` bounds, and includes the selected date in its branch query key; Ops, Insights, and Schedule also include the local date in their operational cache keys. The contract and in-memory/Drizzle repositories enforce the range. The PostgreSQL tenancy suite verifies the date range and passes 12/12; `apps/web/test/date-context.test.ts` passes and web/API typechecks pass. Shared operator-selected date state across Ops, Schedule, and Analytics remains required.

### Acceptance

- Today/date-sensitive workflows share date context.
- Ops/Schedule/Attendance/Analytics honor it consistently.

---

## P1-004 — Global Search Truthfulness

### Option A

Rename current static command palette to Commands/Navigation.

### Option B

Implement actual permitted domain search.

### Acceptance

UI copy exactly reflects behavior. Current implementation is explicitly Commands/Navigation: it filters a static command registry and does not claim domain-record search.

**Implementation evidence (2026-08-28):** The command palette now says “Find a page or action…” and the shell labels its trigger as commands and navigation. `apps/web/src/app/navigation.ts` now exposes a combined `routeManifest` and `routeMetaForPath()` lookup; the main Command shell and command palette consume the manifest directly for grouped navigation and deduplicated command entries, while `AppRouter` applies metadata titles on navigation. `apps/web/test/navigation.test.ts` verifies unique route entries and query-bearing path resolution. Domain search remains a separate future capability.

---

## P1-005 — Real Notification Centre

**Current state:** Notification preferences and a persisted notification inbox now exist, with authenticated list/read routes, category filtering, unread state, and deep-link support. Lifecycle mutations emit durable user notifications. Producer coverage for all operational domains and a full notification preference center remain open.

**Implementation evidence (2026-08-28):** `notifications` is persisted by migration `0038_notifications`; `/users/me/notification-inbox` and its read mutation enforce user ownership. The authenticated shell links to `/account/notifications`, which supports category filters, unread counts, retryable errors, and deep links. Export, plan-change, cancellation, and deletion requests create notifications after durable request persistence.

### Acceptance

Persist:

- recipient;
- category;
- title/body;
- resource link;
- read/unread;
- timestamp.

UI supports:

- inbox;
- read state;
- deep links;
- preferences.

Notification bell opens notifications, not command palette.

---

## P1-006 — Permission-Aware Quick Create

**Current state:** Quick Create actions are now filtered by the authenticated actor’s create/check-in permissions; capability and branch enforcement remain server-authoritative.

**Implementation evidence (2026-08-28):** `shell.tsx` conditionally renders member, booking, lead, and attendance actions using `member:create`, `booking:create`, `lead:create`, and `attendance:checkin`; the command palette also filters manifest navigation by route permission before display. `filterCommandItems()` is covered by the web auth test suite for restricted-entry removal and duplicate-path handling. Route/API authorization remains the final enforcement layer.

### Acceptance

Actions filtered by:

- permission;
- capability;
- workspace;
- branch requirements.

---

## P1-007 — Account Export Request

**Current state:** Owner-account export request creation, persistence, status listing, metadata-only Platform visibility, and reasoned Platform lifecycle updates now exist; fulfillment processing remains open.

**Implementation evidence (2026-08-28):** Added `account_export_requests` forward migration/schema, shared request contract, tenant-scoped PostgreSQL/in-memory persistence, idempotent `GET/POST /users/me/export-requests`, audit event creation, Account Profile request/status UI, metadata-only `GET /platform/account-export-requests` with Platform Overview display, and reason-required Platform status updates for `processing`, `completed`, and `failed`. Requests still require a fulfillment worker to produce export data.

### Acceptance

- Persistent request.
- Lifecycle/status.
- Created date.
- Platform visibility.
- Audit/history.

---

## P1-008 — Account Cancellation Request

**Current state:** Durable tenant cancellation request creation/listing, audit emission, and Platform decision handling now exist; executing an approved cancellation remains a separate lifecycle action and payment collection remains deferred.

**Implementation evidence (2026-08-28):** Added `account_cancellation_requests` migration/schema, shared contract, tenant-scoped PostgreSQL/in-memory persistence, idempotent tenant create/list endpoints, audit emission, Platform listing, and reason-required Platform reviewing/approve/reject endpoint. Account Plan continues to explain that tenant data is preserved during review. Applying an approved cancellation to tenant lifecycle remains intentionally separate.

Same persistence/visibility requirements as above.

---

## P1-009 — Account Deletion Request

**Current state:** Durable deletion request creation/listing and Platform review decision handling now exist, with explicit confirmation safeguards; destructive execution remains open.

**Implementation evidence (2026-08-28):** Added `account_deletion_requests` migration/schema, shared contract, tenant-scoped PostgreSQL/in-memory persistence, idempotent tenant create/list endpoints requiring the exact `DELETE WORKSPACE` confirmation, audit emission, Platform listing, and reason-required reviewing/approve/reject decision endpoint. Account Plan continues to explain that automated deletion is not yet available; destructive execution remains open.

Same persistence/visibility requirements as above, with destructive-action safeguards.

---

**Additional evidence (2026-08-28):** Account Plan now submits cancellation/deletion requests directly, shows latest lifecycle status, protects duplicate submissions, and requires `DELETE WORKSPACE` confirmation for deletion.

## P1-010 — Durable Plan Change Requests

### Acceptance

**Current state:** Durable tenant plan-change requests and Platform decision handling now exist, including optional effective dates; richer plan administration and scheduled execution workers remain open.

**Implementation evidence (2026-08-28):** Added the `plan_change_requests` forward migration/schema, shared request contract, tenant-scoped PostgreSQL/in-memory persistence, idempotent tenant create/list endpoints, audit emission, Platform listing, and Platform approve/reject endpoint with required reason and optional `effectiveAt`. Immediate approval applies the requested non-financial plan assignment; future-dated approval persists the effective timestamp for worker execution. Rejection preserves the current plan. Account Plan retains an assisted “Request a plan change” contact CTA with no checkout/payment collection. Scheduled execution workers and richer plan administration remain open.

**Implementation evidence (2026-08-28):** Tenant request creation/listing and persisted `requested` status are implemented. Account Plan now loads recent requests, offers canonical Starter/Pro/Business selection, prevents duplicate submission, and displays returned status after reload. Platform decisions require an approved/rejected status and reason, persist actor/timestamp, optionally persist `effectiveAt`, emit an audit event, and apply the requested plan immediately when due; future-dated approvals await scheduled execution support.

When implemented, tenant can:

- compare;
- submit;
- view status.

When implemented, Platform can:

- approve/reject;
- provide reason;
- record before/after plan;
- apply effective plan.

---

**Additional evidence (2026-08-28):** Platform Overview now surfaces recent plan-change requests with retryable loading errors.

**Additional evidence (2026-08-28):** Account Plan now submits plan-change requests directly and renders persisted statuses; the earlier assisted-contact wording above is superseded by the direct request UI.

## P1-011 — Persist Platform Plan Definitions

Persist:

- canonical key;
- display name;
- description;
- quotas;
- active state.

---

**Additional evidence (2026-08-28):** Added shared `SaaSPlanDefinition` contract and permission-gated `GET /platform/plans`, exposing canonical Starter/Pro/Business names, quotas, availability, and capability registry projections.

**Additional evidence (2026-08-28):** Migration `0039_platform_plan_definitions` persists canonical plan definitions, quotas, availability, and capability assignments for Starter/Pro/Business. The Platform plans endpoint reads the persisted catalog through both Drizzle and in-memory adapters; the API plan-catalog regression verifies canonical keys, quotas, and stable capability claims. Scoped feature-flag overrides remain open.

**Additional evidence (2026-08-28):** Platform administrators can now update a canonical plan definition through reason-required `PATCH /platform/plans/:key`; quota and capability payloads are validated, persisted, and audited. The web client exposes the mutation through the shipped `/platform/plans` administration surface.

**Additional evidence (2026-08-28):** `/platform/plans` is now a responsive Platform administration surface with editable plan names, descriptions, quotas, availability state, registry-backed capability toggles (including maturity labels), reason-captured saves, pending/error feedback, and navigation metadata.

## P1-012 — Persist Plan Capability Assignments

### Acceptance

Capability plan defaults no longer depend on static frontend assumptions.

**Implementation evidence (2026-08-28):** Capability assignments are stored in the persisted plan catalog as JSON arrays and returned by `GET /platform/plans`; seeded assignments are limited to the stable capability registry. The Platform administration workflow edits these assignments with reason capture and audit history.

The update endpoint and dedicated Platform Plans screen now provide the editable assignment boundary; historical before/after assignment history and scoped feature-flag overrides remain open.

Capability update requests are runtime-validated against `PLATFORM_FEATURE_REGISTRY`; undeclared keys are rejected with `400 Bad Request`, covered by the Platform controller test path.

Plan-definition mutations now load the prior persisted definition and record it alongside the updated definition and reason in the Platform audit stream, satisfying the before/after audit requirement for this slice.

---

## P1-013 — Scoped Feature Flags

Scopes:

- global;
- plan;
- tenant;
- pilot.

Override history required.

**Current implementation boundary (2026-08-29):** Tenant-scoped capability overrides are persisted on tenant subscriptions and exposed through the Platform tenant capability mutation with reasoned audit events. Global, plan-default override records, pilot cohorts, effective dates, and a dedicated scoped-flag history model remain open.

**Additional evidence (2026-08-29):** Migration `0040_platform_feature_flag_overrides` and the shared `FeatureFlagOverrideResponse` contract establish durable global/plan/tenant/pilot scope, effective-window, actor, reason, and previous-value fields. Drizzle/in-memory adapters and authenticated Platform `GET/POST /platform/feature-flag-overrides` endpoints now validate registry keys, scope/value combinations, and temporal windows, with audit events. `/platform/feature-flags` provides the dedicated registry-backed create/history screen, and tenant feature evaluation applies active global/plan/tenant/pilot overrides in creation order within their effective windows; pilot cohorts are represented as comma-separated tenant IDs.

---

## P1-014 — Platform Support Notes

### Acceptance

Persist author, tenant, note, category and date.

No impersonation requirement.

**Implementation evidence (2026-08-31):** Migration `0041_platform_support_notes`, shared `PlatformSupportNoteResponse`, Drizzle/in-memory persistence, and authenticated Platform tenant-scoped `GET/POST /platform/tenants/:tenantId/support-notes` now persist author, tenant, category, note, and timestamp; creation records a Platform audit event. No impersonation or private operational-record access is introduced.

---

## P1-015 — Platform Account Recovery Cases

### Acceptance

Persist:

- subject;
- verification metadata;
- actions;
- session revocation;
- outcome;
- actor.

**Implementation evidence (2026-08-31):** Migration `0042_platform_account_recovery_cases`, shared recovery-case/action contracts, Drizzle/in-memory persistence, and authenticated Platform tenant recovery endpoints now retain subject identifiers, verification metadata, action history, session-revocation result, outcome, actor, and timestamps. Platform tenant detail includes a recovery workspace with JSON metadata validation, explicit action/outcome controls, optional revocation of all active staff sessions for a verified user, recoverable errors, and history. Recovery creation is recorded in the Platform audit projection; no impersonation or private operational-record access is introduced. In-memory controller coverage and PostgreSQL tenant-isolation coverage pass.

---

## P1-016 — Platform System Notices

### Acceptance

Support:

- global;
- plan;
- tenant;
- schedule;
- expiry;
- acknowledgement.

**Implementation evidence (2026-08-31):** Migration `0043_platform_system_notices` persists global, plan-scoped, and tenant-scoped notices with scheduled start/expiry windows, acknowledgement requirement, actor, and audit timestamps. Platform `/platform/notices` provides scoped authoring and history; authenticated staff receive only active notices matching their tenant and plan through `/users/me/system-notices`, with durable per-user acknowledgement. In-memory and PostgreSQL tests cover scope filtering, schedule visibility, acknowledgement persistence, and Platform validation.

---

## P1-017 — Real Implementation Inquiry Conversion

### Acceptance

Conversion:

- validates manifest;
- chooses new/existing tenant;
- creates/links tenant;
- records handoff;
- audits conversion;
- only then marks converted.

**Implementation evidence (2026-08-31):** Added a guarded Platform `POST /platform/implementation-inquiries/:id/convert` workflow. It requires an approved inquiry and schema-validated deterministic seed manifest, supports attaching an existing tenant or creating a new tenant from the reviewed brief, revokes the generated signup session for new tenants, records a durable `conversion_handoff` event, then advances the inquiry to `converted` with `convertedTenantId` and a Platform audit record. The raw status endpoint rejects direct `converted` mutations. The Platform detail UI now exposes a conversion form with target selection, owner-password validation, reason capture, manifest counts, pending/error feedback, and persisted history. PostgreSQL persistence is covered by migration `0044_implementation_inquiry_resume_tokens` (closing the existing resume-token schema drift), Drizzle conversion/event tests, in-memory repository tests, and Platform controller tests; the API suite passes 13 files / 77 tests.

---

## P1-018 — Ops Six-Hour Board Completion

### Add

- staff coverage;
- resource conflicts;
- capacity pressure;
- action queue.

**Implementation evidence (2026-08-31):** The branch-scoped `GET /insights/ops/aggregate` now limits the working session board to the next six hours and derives staff coverage (assigned versus unassigned sessions), capacity constraints, capacity alerts, resource conflicts, and a permission-safe action queue linking no-shows, waitlist, follow-ups, unassigned coverage, resource conflicts, and capacity alerts to their existing workflows. `OpsDashboardPage` presents these signals alongside the existing KPI and session views, with an honest no-exception state. In-memory aggregate coverage passes and API/web typechecks pass; the full PostgreSQL-backed API suite passes 13 files / 77 tests.

---

## P1-019 — Front Desk Workflow Completion

### Add

- booking;
- reschedule;
- waitlist;
- walk-in;
- entitlement warnings.

**Partial implementation evidence (2026-08-31):** Front Desk now offers a contextual member-to-booking link, labels facility arrivals as walk-ins with an explicit no-booking explanation, surfaces confirmed and waitlisted sessions in the member quick view, links waitlisted members to the filtered booking queue, and shows session capacity/resource warnings. The bookings API now accepts the canonical `waitlisted` filter. Tenant-scoped reschedule validates target occurrence/service/branch/capacity, preserves the booking entitlement credit, and audits the move; tenant-scoped waitlist promotion validates availability and eligible membership credits, debits only on confirmation, and audits the promotion. Both operations are covered by in-memory and PostgreSQL tests, and the responsive booking workspace exposes reschedule, promote, and cancellation actions with pending/error feedback. Authorized staff can now submit a retained entitlement-override reason from New Booking; the server still enforces `booking:override`. This ticket is not marked complete.

---

## P1-020 — Coach My Day Completion

### Add

- assigned sessions;
- member context;
- restrictions;
- notes;
- completion.

**Partial implementation evidence (2026-09-01):** Coach My Day now receives server-derived roster signals for assigned sessions: confirmed and waitlisted totals, checked-in and attended counts, and pending attendance work. The dashboard presents these signals with branch context and links each session to its roster workspace, where member names, booking status, and check-in/attendance actions are available. Session notes, permitted progress context, restrictions, and durable completion records remain open.

---

## P1-021 — Practice Workflow Completion

### Add

- incomplete records;
- checklists;
- credentials;
- follow-ups;
- equipment requirements.

---

## P1-022 — Member Tags

Persist and expose CRUD.

**Implementation evidence (2026-09-01):** Migration `0045_member_tags` adds tenant-scoped tag definitions and member assignments with cascading cleanup and uniqueness constraints. Shared contracts, in-memory and Drizzle repositories, and permission-gated `/members/tags` plus `/:memberId/tags` endpoints support create, update, delete, assign, unassign, and reload-safe reads with audit events. Member Detail replaces fabricated static labels with persisted tags and assignment/create/remove controls, and the Members Directory can filter by a persisted tag. In-memory and PostgreSQL tenancy tests cover CRUD, tag filtering, and cross-tenant assignment isolation; the API suite passes 13 files / 79 tests. Full tag management browser coverage remains open.

---

## P1-023 — Member Segments

Support reusable filtered segment definitions.

**Implementation evidence (2026-09-01):** Migration `0046_member_segments` persists tenant-scoped named segment definitions with validated status, branch, and member-tag filters. Permission-gated `/members/segments` endpoints support idempotent create plus update/delete and audit events; Members Directory loads the definitions, applies selected filters, and can save the current filter state as a segment. In-memory and PostgreSQL tenancy tests cover persistence, tenant isolation, filter validation, and reload-safe definitions. Per-user saved views, richer boolean criteria, and full browser coverage remain open.

---

## P1-024 — Saved Member Views

Persist per user/tenant.

**Implementation evidence (2026-09-01):** Migration `0047_member_saved_views` persists named member-directory views per tenant and authenticated staff user, with tenant/user/name uniqueness and updated timestamps. Permission-gated `/members/views` CRUD returns canonical resources, records create/update/delete audit events, validates branch scope, and prevents cross-user or cross-tenant reads. Members Directory can save and restore query, status, tag, and branch context; in-memory and PostgreSQL tenancy tests cover persistence and isolation, contributing to the full API suite's 13 files / 83 tests. Rename/delete controls and richer view layouts remain open.

---

## P1-025 — Member Bulk Actions

Permission-safe bulk operations.

**Partial implementation evidence (2026-09-01):** Members Directory now supports selecting visible members and applying a permission-gated bulk status change with duplicate-submit protection, canonical updated-member results, skipped inaccessible IDs, per-member audit events, and recoverable pending/error feedback. Broader bulk actions (tags, tasks, membership transitions, cross-page selection, and browser coverage) remain open.

---

## P1-026 — Global Tasks Domain

Persist:

- assignee;
- priority;
- due date;
- status;
- linked resource.

Display in relevant records and Today.

**Partial implementation evidence (2026-09-01):** Migrations `0048_global_tasks` and `0049_task_comments` add tenant-scoped tasks with branch, assignee, priority, status, due date, resource link, completion, comments, and updated timestamps, and seed the `task:read` / `task:manage` permission namespace. Permission-gated `/tasks` CRUD, completion, and comment endpoints return canonical resources, validate branch and assignee scope, use idempotency for creation, and audit lifecycle changes. The responsive `/app/tasks` queue supports creation, assignment, filtering, completion, and expandable handoff comments with recoverable feedback. Server-side Today aggregation, richer cross-domain deep links, and browser coverage remain open.

---

## P1-027 — CRM Assignee Workload

### Acceptance

Real assignment and workload data.

**Partial implementation evidence (2026-09-01):** Branch-aware `GET /leads/workload` now aggregates persisted lead ownership, open lead tasks, overdue lead follow-ups, and overdue task work by assignee, with tenant isolation and inaccessible-branch handling. Leads workspace displays live workload cards and overdue task pressure, resolving the fabricated-summary gap. Assignment editing, broader task links, and browser coverage remain open.

---

## P1-028 — CRM Overdue Follow-Ups

Task/due-date based.

**Implementation evidence (2026-09-01):** The workload aggregate derives overdue follow-ups from non-terminal leads with persisted `nextFollowUpAt` and overdue open lead tasks from the lead-task store, scoped by tenant and active branch. Leads summary and assignee cards surface the resulting counts with warning states; persistence and PostgreSQL tenancy coverage pass.

---

## P1-029 — CRM Trial Booking

Lead trial should create/link a real booking.

**Partial implementation evidence (2026-09-01):** Converted leads can now select a future scheduled occurrence in the Leads detail workspace and call the idempotent `POST /leads/:id/trial-booking` workflow. The server enforces conversion and branch alignment, reuses booking capacity/entitlement rules, persists the booking, advances the lead to `trial_booked`, and records audit/event history. The drawer also reloads persisted member booking history from the bookings API. In-memory and PostgreSQL regression coverage verify the persisted booking and conversion prerequisite. Rescheduling, waitlist messaging, and browser acceptance remain open.

---

## P1-030 — Membership Hold

Persist real hold lifecycle.

**Implementation evidence (2026-08-28):** Added permission-gated hold endpoint, repository-backed active-to-paused transitions for in-memory and PostgreSQL, audit emission, and Member Detail Hold Plan action with pending protection. Integration coverage verifies the transition and duplicate rejection.

---

## P1-031 — Membership Resume

Server lifecycle operation.

**Implementation evidence (2026-08-28):** Added permission-gated resume endpoint, repository-backed paused-to-active transitions for in-memory and PostgreSQL, audit emission, and Member Detail Resume Plan action. Integration coverage verifies resume and duplicate rejection.

---

## P1-032 — Membership Renew

Server lifecycle operation including credits/dates.

**Implementation evidence (2026-08-28):** Added permission-gated renewal endpoint and transactional in-memory/PostgreSQL operations. Renewal extends from the later of the current end date or now, restores the active state, issues the plan’s reference credits, emits an audit event, and exposes a pending-safe Member Detail action. Integration coverage verifies renewed status and credit issuance; financial collection remains deferred.

---

## P1-033 — Booking Reschedule

Server operation.

Validate:

- capacity;
- entitlement;
- resources;
- timing;
- booking window.

**Implementation evidence (2026-08-31):** Tenant-scoped reschedule is available through the booking API and responsive booking workspace. It validates a scheduled same-service target, branch scope, duplicate active booking, and capacity while preserving the existing entitlement debit; successful moves are audited. In-memory and PostgreSQL integration coverage passes. Resource-specific capacity and member-safe reschedule remain follow-on work.

---

## P1-034 — Staff Booking Waitlist Lifecycle

Add:

- join;
- leave;
- reorder;
- promote;
- auto-promote.

**Partial implementation evidence (2026-09-01):** Staff can now select a full session in New Booking and submit an explicit waitlist intent. Migration `0050_booking_waitlist_positions` adds a durable one-based queue position, and the canonical booking contract plus both repositories persist waitlisted bookings without debiting credits, reject duplicate active bookings, compact the queue after cancellation/promotion, and support tenant-safe reorder operations. The responsive bookings workspace exposes Move up/Move down controls with pending/error feedback. Staff can promote a waitlisted booking when a scheduled occurrence has capacity and the member has an eligible active membership; cancellation-driven promotion now applies the same equipment-constrained effective capacity used during booking creation, so unavailable resources cannot be overbooked. Cancelling a confirmed staff booking automatically considers the reordered queue, audits the promotion, and preserves the credit rules. Authorized staff can capture a retained entitlement-override reason during New Booking. Member self-service messaging and browser coverage remain open.

---

## P1-035 — Public Waitlist Lifecycle Completion

Persistence exists. Finish product workflow.

---

## P1-036 — Attendance / Reception Model Alignment

One authoritative attendance/arrival state model.

**Partial implementation evidence (2026-09-01):** Reception now reads the branch- and local-day-scoped attendance records API and derives checked-in member and occurrence state from persisted `checked_in`/`attended` records. Walk-in check-in remains member-scoped, while booked-session check-in sends the occurrence ID so the attendance record is linked to the expected arrival. Successful mutations invalidate the shared attendance query root, so reloads and other reception views converge on server state instead of a page-local checked-in set. Full roster editing, no-show/follow-up actions, and browser coverage remain open.

---

## P1-037 — Equipment Pool Management UI

Backend exists. Expose complete management workflow.

---

## P1-038 — Service Equipment Requirements UI

Backend exists. Expose setup and scheduling feedback.

---

## P1-039 — Equipment Downtime

Persist unavailable windows and enforce scheduling impact.

---

## P1-040 — Equipment Calibration Workflow

Create due/completed/overdue lifecycle.

---

## P1-041 — Inventory Supplier Domain

Replace long-term free-text supplier dependency.

---

## P1-042 — Purchase Order Lifecycle

Support:

- draft;
- ordered;
- partially received;
- received;
- cancelled.

---

## P1-043 — PO Receiving → Lots/Movements

Transactional receiving workflow.

---

## P1-044 — Inventory Reorder Rules

Persist/edit and surface low-stock queue.

---

## P1-045 — Assessment Protocol Versions

Historic assessment sessions reference immutable protocol version.

---

## P1-046 — Assessment Review / Completion

Persist reviewer/status/history.

---

## P1-047 — Assessment Attachments

Controlled document/file association.

---

## P1-048 — Assessment Batteries

Persist groups of required assessments.

---

## P1-049 — Retest Planning

Persist due dates and member links.

---

## P1-050 — Therapy Protocol Versions

Sessions snapshot/reference protocol version.

---

## P1-051 — Therapy Safety Checklist Completion

Persist completed responses.

---

## P1-052 — Therapy Consent Linkage

Persist consent reference/status.

---

## P1-053 — Therapy Follow-Up

Persistent follow-up workflow.

---

## P1-054 — Credentials Domain

Persist credential types and staff credentials.

---

## P1-055 — Service Credential Requirements

Scheduling/assignment feedback required.

---

## P1-056 — Credential Expiry Queue

Expiring, expired and missing.

---

## P1-057 — Automation Domain Event Dispatcher

Implement:

`event → rules → condition → delay → run`

---

## P1-058 — Automation Branch Scope

Enforce persisted branch applicability.

---

## P1-059 — Automation Retry / Failure UX

Expose run failure details and safe retry.

---

## P1-060 — Generic Import Jobs

Durable import domain.

---

## P1-061 — Reusable Column Mapping

Reusable across members/leads/staff/etc.

---

## P1-062 — Duplicate Resolution

Persist and expose duplicate resolution.

---

## P1-063 — Import Failure Reports

Downloadable errors.

---

## P1-064 — Integration Connection Model

Provider/state/checkpoint/configuration reference.

---

## P1-065 — Integration Mapping Versions

Persist external → FITOS mapping definitions.

---

## P1-066 — Integration Quarantine / Error Queue

Operational review surface.

---

## P1-067 — Site Version History

Persistent publish versions.

---

## P1-068 — Site Navigation Model

Persist navigation separate from page bodies.

---

## P1-069 — Site Media Library

Controlled uploads and references.

---

## P1-070 — Specialty Public Booking

Support class/consult/assessment/therapy/recovery/facility flows.

---

## P1-071 — Member Reschedule

Dedicated member-safe reschedule operation.

---

## P1-072 — Member Progress

Expose approved assessment/performance history.

---

# P2 TICKETS

## P2-001 — Command Dashboard Trend Depth

Real historical trend comparisons.

---

## P2-002 — Platform Tenant Usage Pressure Filters

Quota pressure and onboarding filters.

---

## P2-003 — Platform Audit Timeline Improvements

Readable before/after summary views.

---

## P2-004 — Recent Items

Persistent/recently accessed resources where useful.

---

## P2-005 — Command Search Entity Expansion

Equipment/inventory/settings/etc.

---

## P2-006 — Saved Analytics Reports

Persistent report presets.

---

## P2-007 — Analytics Metric Definitions

Explain calculation source and semantics.

---

## P2-008 — Analytics Accessible Table Alternatives

Charts should have data-table alternatives.

---

## P2-009 — Analytics Export

Match active branch/date/filters exactly.

---

## P2-010 — Equipment Utilisation Analytics

---

## P2-011 — Equipment Downtime Analytics

---

## P2-012 — Inventory Consumption Analytics

---

## P2-013 — Inventory Expiry/Wastage Analytics

---

## P2-014 — Assessment Comparison Views

Baseline/current/delta.

---

## P2-015 — Pinned Performance Metrics

---

## P2-016 — Therapy Outcome Analytics

Avoid unsupported clinical claims.

---

## P2-017 — Custom Domains for Sites

Requires domain ownership verification.

---

## P2-018 — Sites Rollback

Recover a previous published version.

---

## P2-019 — Responsive Specialist Screens

Break oversized all-in-one modules into routed views.

---

## P2-020 — Shared Drawer Components

Reduce page-local drawer systems.

---

## P2-021 — Shared Data Tables

Migrate advanced modules toward `@fitos/ui`.

---

## P2-022 — Reduce Inline Style Systems

Progressively remove page-owned theme systems.

**Implementation evidence (2026-08-28):** The shared staff shell no longer uses inline positioning, icon color/margin, or mobile menu reset styles; Insights static KPI/note/chart styles and the Bookings cancellation-note display rule now use semantic classes. These are expressed in `apps/web/src/styles/app.css`. Web typecheck and the 4-file/10-test web suite pass. Dynamic chart dimensions and other feature-level inline styles remain; this ticket stays open for the broader migration.

---

**Additional evidence (2026-08-28):** The landing-page pricing subtitle now uses the shared semantic `landing-pricing-subtitle` CSS class instead of a static inline style.

## P2-023 — Accessibility Sweep

All major surfaces at keyboard/touch/zoom.

**Implementation evidence (2026-08-28):** Shared `ErrorNotice` now supports an accessible, keyboard-operable Retry action, wired into account profile/plan, organization, branches, audit, and staff reads, Member Portal reads, Ops, Insights, Bookings, Members, Attendance, Memberships, Schedule, Services, Equipment, Platform Overview, and Platform Tenants query failures. Equipment now clears stale errors on retry and surfaces initial-load failures instead of silently leaving an empty workspace. This is a targeted recovery/accessibility improvement; the full responsive and keyboard sweep remains open.

---

**Additional evidence (2026-08-28):** Equipment status summary cards now expose button semantics, Enter/Space activation, pressed state, and visible focus styling for keyboard users.

## P2-024 — Screenshot Regression

Baselines for key shells/workflows.

---

## P2-025 — Expanded Playwright Browser Matrix

Test critical widths and roles.

---

# DELIVERY SEQUENCE

# VERIFIED LOCAL GATES

As of 2026-08-28, the following gates are verified in this checkout:

- Full workspace typecheck passes across contracts, shared, auth, UI, database, API, worker, and web.
- Full repository lint and Prettier checks pass.
- PostgreSQL-backed API suite passes 14 files and 93 tests with `RUN_DATABASE_TESTS=true`.
- Web tests pass 4 files and 10 tests; the production Vite build passes.
- Sites persistence, inventory lot receipt, branch-scoped queries, local date filtering, and account lifecycle request persistence have direct regression coverage.

Hosted CI, Playwright browser execution, production image/smoke stages, and the remaining roadmap workflows are not implied by these local results. Worker queue schemas exist for generic exports, but no account-export fulfillment processor or future-dated plan executor is wired yet.

The Platform overview now provides reason-captured controls to start/complete export requests and approve/reject plan-change requests, with mutation pending/error feedback and query refresh. This is a control-plane UI slice; export fulfillment and persisted editable plan catalogs remain open.

## Sprint Group A

P0-001 through P0-005.

## Sprint Group B

P1-001 through P1-017.

## Sprint Group C

P1-018 through P1-036.

## Sprint Group D

P1-037 through P1-056.

## Sprint Group E

P1-057 through P1-072.

## Sprint Group F

P2 completion/polish.

---

# RULE

New large features should not jump ahead of unresolved P0s and high-impact P1s without explicit technical/product justification.
