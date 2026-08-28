# FITOS Non-Payment Product and UX Gap-Resolution Plan

## Summary

FITOS already contains substantial domain screens and backend foundations, but many areas behave like disconnected feature demonstrations. The program will complete the non-payment product as one coherent operating system, prioritizing SaaS acquisition, onboarding, account management, and Platform administration before improving tenant, specialist, public, and member workflows.

The implementation will:

- Evolve the established carbon/jet, energy-lime FITOS visual language.
- Replace page-local styling and generic card grids with shared workflow-oriented components.
- Complete the API, persistence, and worker behavior required by each redesigned journey.
- Preserve the modular monolith, shared data model, separate authentication modes, and role-specific cockpits.
- Exclude payments, billing providers, invoices, revenue reporting, PWA/offline work, deployment infrastructure, observability expansion, and unrelated security hardening.
- Keep existing payment functionality unchanged and remove it from the active redesign roadmap.

## Product and UX Foundation

### Shared design system

- Expand `@fitos/ui` into the authoritative system for typography, spacing, surfaces, buttons, forms, search, tabs, badges, tables, cards, drawers, dialogs, steppers, timelines, filters, pagination, skeletons, empty states, errors, confirmations, and unsaved-change warnings.
- Preserve FITOS energy lime for primary action and focus, using semantic success, warning, danger, and information colors only for state.
- Introduce documented density modes: executive, operational, touch-friendly, specialist-record, and consumer.
- Replace page-local `<style>` blocks, hard-coded slate/blue values, inline layout styling, and CSS selectors that infer styling from inline values.
- Standardize page anatomy: context header, primary action, status/exception summary, filters, working area, secondary detail, and contextual help.
- Standardize mutation behavior: pending state, duplicate-submit prevention, inline validation, success feedback, recoverable error, query invalidation, and focus restoration.
- Add reusable responsive patterns: desktop tables and split panes, tablet drawers, mobile cards/filter sheets, sticky actions, bottom sheets, and agenda views.

### Application coherence

- Introduce route metadata defining title, workspace, navigation group, permission, capability, branch behavior, breadcrumb, primary action, and mobile presentation.
- Move all navigation into surface manifests instead of embedding unrelated links in page components.
- Keep four isolated authentication modes: public, tenant staff, member, and Platform.
- Preserve the intended destination across expired sessions; distinguish session expiry, unauthorized access, missing capability, missing branch access, and concealed/not-found resources.
- Make branch and date context persistent and visible. Branch-aware queries must use shared query-key factories and invalidate consistently.
- Add a global notification center, task tray, recent items, command search, and permission-filtered Quick Create.
- Make workspace switching persistent for multi-role staff while leaving server authorization authoritative.
- Replace dead controls with a real action, an explicitly explained unavailable state, or removal.

## Delivery Waves

### Wave 1 — SaaS acquisition, signup, onboarding, and account

This is the first shippable release.

- Complete the public information architecture: `/features`, `/solutions`, solution-specific pages, `/pricing`, `/contact`, `/configure`, `/signup`, and completion/resume routes.
- Build a shared marketing shell with responsive navigation, footer, SEO metadata, capability maturity labels, and three clear paths: self-service signup, assisted configuration, and contact.
- Source feature and plan claims from the capability registry so beta or unavailable functionality is never presented as live.
- Redesign assisted configuration as an adaptive journey with grouped sections, conditional questions, autosave, resumable drafts, progress, review, consent, and reliable network recovery.
- Redesign signup as a concise account-creation journey: business identity, locale, first branch, owner account, confirmation, then authenticated onboarding.
- Turn onboarding into a server-derived checklist with real completion criteria, role-specific tasks, resumability, and direct links to the exact incomplete configuration.
- Add an authenticated `/account/*` surface for profile, organization preferences, plan and capability visibility, usage, data export requests, cancellation, and deletion requests.
- Preserve redirects from existing account/subscription settings routes.
- Plan changes remain non-financial: tenants can compare plans and submit an upgrade/downgrade request; Platform staff can approve an assignment with an audit reason. No checkout or payment collection is introduced.
- Show lifecycle states—trial, active, grace, suspended, cancelled, archived—with clear consequences, recovery actions, and preserved tenant data.

### Wave 2 — Platform administration and implementation operations

- Replace the minimal Platform header with a complete responsive control-plane shell: Overview, Tenants, Implementations, Plans, Capabilities, Feature Flags, Support, Notices, and Audit.
- Redesign Overview around actionable control-plane signals: lifecycle counts, trials requiring action, quota pressure, implementation workload, recent control changes, and existing service-health summaries. Do not expand infrastructure monitoring.
- Replace tenant cards with a searchable, filterable, sortable tenant directory supporting lifecycle, plan, usage pressure, onboarding state, and capability filters.
- Build tenant detail tabs for Summary, Lifecycle, Plan and Usage, Capabilities, Support Notes, Account Recovery, Notices, and Activity.
- Persist plan definitions, quotas, plan-capability assignments, and global/plan/tenant/pilot feature-flag scopes. Every override records actor, reason, previous value, and effective dates.
- Replace raw inquiry JSON with structured discovery sections, completion summary, priorities, branches, services, specialist requirements, uploads, and custom workflow notes.
- Complete the inquiry workflow: assign owner, add internal notes, request clarification, qualify, approve, preview deterministic seed manifest, validate, attach to an existing tenant or create a tenant, record import handoff, and mark converted.
- Add account-recovery cases that verify metadata, record actions, revoke sessions or issue approved recovery steps, and preserve audit history.
- Keep support metadata-first: no tenant impersonation or access to private operational records.
- Add targeted system notices assignable globally, by plan, or by tenant, with scheduling, acknowledgement state, and expiry.
- Present audit history as a filterable timeline with readable before/after summaries instead of isolated event cards.

### Wave 3 — Role workspaces and daily operating workflows

- Complete the Command shell as the owner/founder environment: executive overview, real trends, acquisition, retention, visits, booking pressure, exceptions, and drill-downs.
- Complete Ops as a six-hour operational board with current/next sessions, expected arrivals, staff coverage, capacity pressure, overdue follow-ups, resource conflicts, and action queue.
- Complete Front Desk as a touch- and keyboard-friendly search-first workspace for arrivals, check-in, entitlement review, walk-ins, booking, rescheduling, and upcoming visits.
- Complete Coach as “My Day”: assigned sessions, roster status, member context, restrictions, permitted progress information, notes, and session completion.
- Complete Practice around appointments, assessments, therapy documentation, incomplete records, follow-ups, required checklists, credentials, and equipment.
- Give each workspace its own navigation and density while sharing branch context, contracts, notifications, tasks, and domain rules.
- Add role-specific onboarding and sensible empty states that teach the next usable action.

### Wave 4 — Core tenant journeys

- Members: add tags, segments, saved views, bulk actions, task/note creation, lifecycle cues, and a coherent detail workspace covering membership, bookings, attendance, assessments, therapy, progress, notes, and activity.
- CRM: provide a real pipeline and list switcher, assignee workload, overdue follow-ups, lead detail, trial booking, conversion, loss reasons, tasks, notes, and source attribution.
- Memberships: complete activation, hold, resume, renewal, cancellation, expiry, unused-credit, inactive-member, and retention workflows. Price fields remain reference data only.
- Schedule: unify calendar and agenda modes, recurring-template management, occurrence detail, cancellation, override, resource constraints, and mobile agenda behavior.
- Bookings: add responsive detail, contextual preselection, rescheduling, waitlist state, cancellation explanation, entitlement/resource feedback, and safe staff override.
- Attendance and Reception: align expected arrivals, roster, walk-in, checked-in state, actual occupancy, entitlement warnings, and no-show follow-up around one shared attendance model.
- Services, rooms, staff, branches, and credentials become connected setup journeys rather than separate CRUD pages.

### Wave 5 — Advanced facility workflows

- Equipment: split the monolithic screen into dashboard, assets, asset detail, pools, maintenance, calibration, downtime, and allocation views; connect resource state to scheduling and effective capacity.
- Inventory: provide stock dashboard, item detail, movements, lots/expiry, suppliers, purchase orders, receiving, stocktakes, reorder rules, service BOM, and confirmed session consumption.
- Assess: provide Performance Lab dashboard, definition/protocol management, new assessment, structured result entry, review/completion, attachments, provenance, member history, batteries, retest planning, and progress comparison.
- Therapy: provide modality/protocol management, versioned protocols, session workspace, parameters, safety checklist, consent linkage, equipment, outcomes, completion, and follow-up.
- Credentials: add credential types, staff records, expiry/document tracking, service requirements, scheduling feedback, and actionable expiry queues.
- Replace oversized all-in-one components with routed list/detail/workspace views while preserving current working APIs and behavior.

### Wave 6 — Public sites and member experience

- Complete FITOS Sites with configuration, controlled block library, pages, navigation, theme, media, SEO, preview, publish, recoverable versions, domain settings, and safe rendering failures.
- Use the documented controlled blocks; do not build unrestricted free-form page design.
- Build specialty public discovery and booking for classes, consultations, assessments, therapy, recovery, and facilities.
- Availability must account for branch, practitioner, credential, room, equipment, capacity, buffers, intake requirements, and entitlement. Payment-required cases stop at a clearly explained reservation/request state.
- Complete the mobile-first Member shell with Home, Book, My Schedule, Membership, Progress, and Profile.
- Add member rescheduling, cancellation, attendance, selected assessment results, progress, permitted therapy history, notification preferences, and deep links.
- Ensure all public and member surfaces use their dedicated APIs and identities and never reuse staff-oriented tables or terminology.

### Wave 7 — Productivity, automation, analytics, imports, and integrations

- Add cross-domain tasks with assignee, priority, due date, status, resource link, comments, and appearance in Today and relevant records.
- Add a notification inbox with read/unread state, category filters, deep links, preferences, and workspace-aware presentation.
- Complete automations with persisted trigger, condition, delay, action, branch scope, template, test mode, activation validation, run history, failure detail, and retry.
- Add operational triggers for follow-ups, inactivity, membership expiry, retests, therapy follow-up, maintenance, calibration, low stock, and credential expiry.
- Complete analytics with authoritative branch/date-filtered operational, growth, performance, therapy, equipment, and inventory metrics. Exclude revenue and payment metrics.
- Add saved report presets, accessible chart/table alternatives, metric definitions, zero-data explanations, and exports matching active filters.
- Build a reusable import workspace: upload, column mapping, preview, validation, duplicate resolution, import, progress, and downloadable failure report for members, leads, memberships, staff, and specialist results.
- Complete the integration framework UI for connection state, provider configuration references, health, sync checkpoints, mapping versions, subject matching, duplicate review, quarantine, imports, and errors.
- Deliver real CSV/file imports with provenance. Live InBody, VALD, COSMED, PNOE, or therapy-device APIs are added only when approved vendor access and documentation exist; their absence does not block this program.

## Public Interfaces and Data Changes

- Extend shared contracts for route/workspace metadata, lifecycle consequences, plan administration, scoped feature flags, support notes, recovery cases, system notices, tasks, notifications, import jobs, mapping results, credentials, saved views, assessment batteries, retest plans, protocol checklists, and published site versions.
- Keep `starter`, `pro`, and `business` as canonical SaaS plan keys; move editable names, descriptions, quotas, and capability assignments into persisted Platform records.
- Add owner-account endpoints for preferences, plan-change requests, export requests, cancellation requests, and deletion requests.
- Add Platform endpoints for plan/capability management, scoped flags, support notes, recovery cases, notices, inquiry assignment/notes/conversion, and lifecycle history.
- Add booking reschedule and waitlist operations; membership hold/resume/renew; task and notification APIs; generic import/mapping APIs; credential APIs; assessment battery/retest APIs; therapy checklist/completion APIs; and complete Sites draft/version/publish APIs.
- All mutations return canonical updated resources or durable job identifiers, not fabricated success responses.
- Branch and date scope must be explicit in requests and React Query keys. Member identity remains server-derived; capability and permission enforcement remains server-side.
- Add forward-only migrations; never rewrite existing migrations.

## Test and Acceptance Plan

- Add component tests for shared controls, responsive navigation, steppers, dialogs, validation, loading/error/empty states, focus management, and unsaved changes.
- Add contract and PostgreSQL integration tests for every new lifecycle transition, capability gate, import state, reschedule, membership transition, task, notification, specialist completion, and publishing workflow.
- Expand Playwright coverage across public acquisition, signup, onboarding, account management, Platform inquiry conversion, tenant lifecycle, each staff cockpit, public booking, member booking, and Sites publish.
- Test owner, manager, reception, coach, practitioner, member, and Platform accounts with rich fixtures and multi-role workspace switching.
- Validate representative widths at 360, 390, 768, 1024, and 1440 pixels, including keyboard-only use, visible focus, touch targets, zoom, reduced motion, and table alternatives.
- Add screenshot regression baselines for shells, SaaS funnel, Platform directory/detail, Front Desk, Coach, Practice, member navigation, and Sites builder.
- Verify empty, loading, partial-data, validation, permission-denied, capability-disabled, quota-exceeded, offline/network-error, retry, and stale-session states.
- Require real persistence across reloads for every completion claim; typechecks or rendered pages alone do not qualify.
- A workflow is complete only when a seeded user can discover it, perform it, receive clear feedback, reload and retain the result, find it in history/audit where applicable, and recover from expected failure.

## Assumptions and Explicit Deferrals

- The current `v2` branch at `94a5646` is the implementation baseline; documentation describes intent but is not assumed to reflect current completion.
- Existing functional modules will be evolved, not rebuilt as a parallel application.
- The first production-facing increment is SaaS plus Platform; subsequent waves reuse its design and interaction system.
- Payment providers, checkout, invoices, recurring billing, financial analytics, and SaaS billing remain fully deferred.
- Existing payment-ledger screens remain untouched and may be hidden from redesigned navigation until the final payment phase.
- Metadata-first Platform support is included; impersonation/support access is deferred.
- PWA/offline caching, deployment, backups, infrastructure observability, performance optimization, and unrelated security programs remain outside this initiative.
- Accessibility, responsive behavior, authorization correctness, auditability of new control actions, and regression testing are required parts of UX/workflow completion, not deferred non-functional extras.
