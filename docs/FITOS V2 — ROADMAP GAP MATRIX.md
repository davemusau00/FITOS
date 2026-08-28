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

**Implementation evidence (2026-08-28):** `.github/workflows/ci.yml` runs formatting, lint, typecheck, migrations/seeding, unit/integration tests, Playwright, build, Compose/Prometheus validation, production image and smoke checks, dependency audit, and Gitleaks in one job, so failures prevent later stages from being reported as passing. Hosted CI status is still required to close P0-001.

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

**Implementation evidence (2026-08-28):** `SitesPage` selects the first persisted page, supports keyboard-accessible page selection, hydrates title/slug/sections/SEO/theme, sends the selected `pageId` on save, prevents accidental replacement of dirty drafts, guards browser unload, and invalidates the page query after save. Both in-memory and Drizzle repositories update the tenant-scoped selected page when `pageId` is supplied; otherwise legacy slug upsert behavior is preserved. Contracts, API, and web typechecks pass. Runtime reload verification remains open.

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

**Implementation evidence (2026-08-28):** `InventoryPage` renders a Receive Inventory Lot modal with required item and quantity validation, optional branch, lot/batch code, expiry, notes, pending/error feedback, and canonical reload after `POST /inventory/lots`. The Drizzle repository locks and validates the item, updates stock, inserts the lot and `purchase_in` movement in one transaction, and returns the canonical lot. API and web typechecks pass. A PostgreSQL integration regression test covers stock, lot, and movement consistency; it is gated by `RUN_DATABASE_TESTS=true` and was collected (skipped without the configured database) locally.

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

**Implementation evidence (2026-08-28):** `branch-context.tsx` validates persisted branch IDs against server-provided branches and defaults to the first authorized branch; `shell.tsx` only renders “All Locations” as a fallback label. P1-001 remains open until explicit multi-branch reads and safe all-location query semantics exist.

### Acceptance

- Branch context supports concrete branch or `all`.
- Read APIs support multi-branch where appropriate.
- Query keys include branch scope.
- Branch switch updates every relevant screen.
- Mutations requiring branch demand concrete branch.

---

## P1-002 — Shared Branch Query-Key Strategy

**Current state:** A canonical branch query-key helper exists and core Ops, Insights, Attendance, Reception, Bookings, New Booking, Members, Memberships, Overview, Coach, and Schedule queries now use it; broader screen migration remains in progress.

**Implementation evidence (2026-08-28):** `apps/web/src/lib/query-keys.ts` emits stable `{ branchId }` scope segments (including explicit `all`), and `OpsDashboardPage`, `InsightsPage`, `AttendancePage`, `ReceptionPage`, `BookingsPage`, `NewBookingPage`, `MembersPage`, `MembershipsPage`, `OverviewPage`, `CoachDashboardPage`, and `SchedulePage` consume the factory. Remaining branch-sensitive screens require migration and review.

### Acceptance

- Common query-key factories.
- No stale cross-branch cache.
- Core screens migrated.

---

## P1-003 — Shared Date Context

**Current state:** A shared local-time calendar helper now exists and Reception uses it for today’s schedule; operator-selected date context across Ops, Schedule, Attendance, and Analytics remains open.

**Implementation evidence (2026-08-28):** `apps/web/src/lib/date-context.ts` derives an ISO date from the browser’s local timezone, and `ReceptionPage` uses it instead of UTC string truncation, preventing near-midnight date drift. `apps/web/test/date-context.test.ts` passes. Full shared date selection and migration remain required.

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

**Implementation evidence (2026-08-28):** The command palette now says “Find a page or action…” and the shell labels its trigger as commands and navigation. Domain search remains a separate future capability.

---

## P1-005 — Real Notification Centre

**Current state:** Notification preferences exist, but there is no persisted notification inbox or notification route. The misleading shell bell has been removed until a real inbox exists; this ticket remains open.

**Implementation evidence (2026-08-28):** The API currently exposes only `/users/me/notifications` preference reads/updates. No inbox list, read-state mutation, deep-link surface, or notification route was found. `shell.tsx` no longer renders a misleading notification control while the capability is absent.

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

### Acceptance

Actions filtered by:

- permission;
- capability;
- workspace;
- branch requirements.

---

## P1-007 — Account Export Request

### Acceptance

- Persistent request.
- Lifecycle/status.
- Created date.
- Platform visibility.
- Audit/history.

---

## P1-008 — Account Cancellation Request

Same persistence/visibility requirements as above.

---

## P1-009 — Account Deletion Request

Same persistence/visibility requirements as above, with destructive-action safeguards.

---

## P1-010 — Durable Plan Change Requests

### Acceptance

Tenant can:

- compare;
- submit;
- view status.

Platform can:

- approve/reject;
- provide reason;
- record before/after plan;
- apply effective plan.

---

## P1-011 — Persist Platform Plan Definitions

Persist:

- canonical key;
- display name;
- description;
- quotas;
- active state.

---

## P1-012 — Persist Plan Capability Assignments

### Acceptance

Capability plan defaults no longer depend on static frontend assumptions.

---

## P1-013 — Scoped Feature Flags

Scopes:

- global;
- plan;
- tenant;
- pilot.

Override history required.

---

## P1-014 — Platform Support Notes

### Acceptance

Persist author, tenant, note, category and date.

No impersonation requirement.

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

---

## P1-018 — Ops Six-Hour Board Completion

### Add

- staff coverage;
- resource conflicts;
- capacity pressure;
- action queue.

---

## P1-019 — Front Desk Workflow Completion

### Add

- booking;
- reschedule;
- waitlist;
- walk-in;
- entitlement warnings.

---

## P1-020 — Coach My Day Completion

### Add

- assigned sessions;
- member context;
- restrictions;
- notes;
- completion.

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

---

## P1-023 — Member Segments

Support reusable filtered segment definitions.

---

## P1-024 — Saved Member Views

Persist per user/tenant.

---

## P1-025 — Member Bulk Actions

Permission-safe bulk operations.

---

## P1-026 — Global Tasks Domain

Persist:

- assignee;
- priority;
- due date;
- status;
- linked resource.

Display in relevant records and Today.

---

## P1-027 — CRM Assignee Workload

### Acceptance

Real assignment and workload data.

---

## P1-028 — CRM Overdue Follow-Ups

Task/due-date based.

---

## P1-029 — CRM Trial Booking

Lead trial should create/link a real booking.

---

## P1-030 — Membership Hold

Persist real hold lifecycle.

---

## P1-031 — Membership Resume

Server lifecycle operation.

---

## P1-032 — Membership Renew

Server lifecycle operation including credits/dates.

---

## P1-033 — Booking Reschedule

Server operation.

Validate:

- capacity;
- entitlement;
- resources;
- timing;
- booking window.

---

## P1-034 — Staff Booking Waitlist Lifecycle

Add:

- join;
- leave;
- reorder;
- promote;
- auto-promote.

---

## P1-035 — Public Waitlist Lifecycle Completion

Persistence exists. Finish product workflow.

---

## P1-036 — Attendance / Reception Model Alignment

One authoritative attendance/arrival state model.

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

---

## P2-023 — Accessibility Sweep

All major surfaces at keyboard/touch/zoom.

---

## P2-024 — Screenshot Regression

Baselines for key shells/workflows.

---

## P2-025 — Expanded Playwright Browser Matrix

Test critical widths and roles.

---

# DELIVERY SEQUENCE

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
