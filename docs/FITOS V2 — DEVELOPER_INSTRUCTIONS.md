# FITOS V2 — DEVELOPER_INSTRUCTIONS.md

## Scope

These instructions apply to **all coding agents, developers, reviewers, and automated contributors working on FITOS V2**.

They override informal implementation shortcuts and should be treated as repository-level engineering policy.

---

# 1. PRIMARY RULE

Do not optimize for the number of features implemented.

Optimize for:

**complete, persistent, testable, truthful workflows.**

A feature is not complete because:

- a page exists;
- a component renders;
- an API route exists;
- a database table exists;
- TypeScript passes;
- a button changes React state;
- a mock success message appears;
- a server returns HTTP 200.

A workflow is complete only when the user can:

1. discover it;
2. perform it;
3. receive correct feedback;
4. reload and retain the result;
5. see history/audit where applicable;
6. recover from expected failures;
7. repeat the workflow through automated tests.

---

# 2. BEFORE MODIFYING CODE

Before implementing any task, inspect the relevant:

- roadmap item;
- existing route;
- existing UI;
- shared contracts;
- controller/API;
- repository interface;
- Drizzle implementation;
- migrations;
- permissions;
- capabilities;
- existing tests.

Do not implement a parallel abstraction without first confirming the existing one cannot be extended.

---

# 3. CLASSIFY THE GAP FIRST

Every task should be mentally classified as one or more of:

- Functional but incomplete
- UI-only
- Backend-only
- Partially wired
- Missing persistence
- Missing authorization
- Missing tests
- Dead control
- Contract mismatch
- New capability

Prefer fixing existing incomplete functionality before expanding scope.

---

# 4. SOURCE OF TRUTH

Server-side persisted state is authoritative.

Do not use:

- React state;
- browser storage;
- static arrays;
- fake timeout success states;

as the authoritative record of business activity.

Local storage may be used only for appropriate UX preferences such as:

- active branch;
- workspace;
- temporary resumability token;
- harmless display preferences.

---

# 5. SHARED CONTRACTS ARE MANDATORY

Frontend and backend must use shared FITOS contracts.

Do not maintain separate frontend/backend copies of:

- enums;
- statuses;
- DTOs;
- capability keys;
- lifecycle definitions;
- block types;
- permission keys.

Do not bypass mismatched contracts using:

`as unknown as ...`

or broad `any`.

If the contract is wrong, change the contract.

---

# 6. API MUTATION RULE

Every mutation must:

- validate input;
- authorize server-side;
- verify tenant;
- verify branch where applicable;
- verify capability where applicable;
- enforce domain rules;
- persist transactionally where needed;
- return canonical updated state or durable job ID;
- create audit/history where applicable;
- handle duplicate requests where needed.

Never fabricate success.

---

# 7. TENANT ISOLATION

Tenant isolation is non-negotiable.

Every tenant-owned record must be tenant-scoped.

Cross-tenant references must be impossible through:

- repository filtering;
- validation;
- foreign keys;
- database constraints/triggers where appropriate;
- tests.

Frontend filtering is not tenant security.

---

# 8. BRANCH RULES

Every branch-aware feature must explicitly define whether it supports:

- one branch;
- all accessible branches;
- no branch context.

Do not silently default a mutation to the first branch.

Branch-aware query keys must include branch scope.

Changing branch must not leave stale data from the previous branch visible.

---

# 9. ALL LOCATIONS

Where read operations support aggregate tenant data, implement a real All Locations mode.

Do not display “All Locations” unless the API/query model actually supports it.

Mutations requiring a branch must force the user to choose a concrete branch.

---

# 10. PERMISSIONS

Permissions must be enforced by the API.

Frontend UI should additionally hide or disable inaccessible actions.

Do not rely on hidden buttons for security.

Quick Create, command actions, context menus, tables, and mobile actions must respect permissions.

---

# 11. CAPABILITIES

Features controlled by SaaS capability must be gated consistently.

Gating should exist at:

- navigation;
- route;
- action;
- server-side operation.

Never advertise unavailable functionality as active.

---

# 12. AUTHENTICATION MODES

Preserve strict separation between:

- Public
- Tenant staff
- Member
- Platform administrator

Do not reuse staff-facing APIs for member/public experiences.

Do not make Platform support equivalent to tenant impersonation.

---

# 13. DEAD CONTROLS ARE BUGS

A visible control must:

1. perform the stated action;
2. be explicitly disabled with explanation; or
3. not exist.

Never leave:

- unused state toggles;
- buttons that open unrelated interfaces;
- fake notification badges;
- controls routing to unfinished screens;
- save actions that only mutate local state.

---

# 14. UI COPY MUST TELL THE TRUTH

Do not write:

- “Full access”
- “Automatic”
- “Live”
- “Real-time”
- “Integrated”
- “Notifications”
- “Search everything”

unless the system actually does it.

Product copy is part of engineering correctness.

---

# 15. QUERY MANAGEMENT

Use predictable shared query keys.

Recommended structure:

`[domain, tenant, branchScope, dateRange, filters, pagination]`

Mutations must invalidate the correct related queries.

Do not use random string query keys across pages for the same domain.

---

# 16. DATE SCOPE

Date-sensitive operating screens should use shared date semantics where appropriate.

Avoid independent implementations of “today” scattered throughout:

- Ops
- Attendance
- Schedule
- Analytics
- Coach
- Practice
- Equipment
- Inventory

---

# 17. DOMAIN OPERATIONS

Important lifecycle operations should be server operations.

Do not simulate domain transitions from the client.

Examples:

- booking reschedule;
- waitlist promotion;
- membership hold;
- membership renewal;
- inquiry conversion;
- stock receiving;
- therapy completion.

---

# 18. TRANSACTIONS

Use database transactions when one business operation changes multiple related records.

Examples include:

- inventory receiving + lot + movement;
- inquiry conversion + tenant linkage + audit;
- booking reschedule + entitlement effects;
- membership renewal + credit issuance;
- waitlist promotion;
- therapy completion where checklist/outcome records are involved.

---

# 19. IMMUTABLE HISTORY

Business history should not be silently rewritten.

Prefer append-only records for:

- audit events;
- inventory movements;
- credit ledgers;
- automation runs/results;
- lifecycle history;
- future payment events.

---

# 20. IDEMPOTENCY

Use idempotency for retry-sensitive operations.

Examples:

- booking;
- reservation;
- import jobs;
- automation actions;
- future payment events.

---

# 21. ERROR HANDLING

Expected failure modes need explicit UX.

Distinguish at least:

- unauthenticated;
- session expired;
- forbidden;
- validation error;
- capability unavailable;
- branch unavailable;
- quota reached;
- conflict;
- duplicate;
- resource unavailable;
- not found.

Do not require the UI to parse arbitrary English messages to understand error type.

---

# 22. LOADING / EMPTY / ERROR STATES

Every remote screen must define:

- loading state;
- empty state;
- error state.

Complex mutations must define:

- pending;
- success;
- recoverable failure.

---

# 23. FORM RULES

Forms must have:

- validation;
- pending state;
- duplicate-submit prevention;
- clear errors;
- canonical reload after mutation.

Complex editors should warn about unsaved changes.

---

# 24. DESIGN SYSTEM

Prefer `@fitos/ui`.

Do not create another page-local miniature design system.

Avoid adding:

- hardcoded palettes;
- duplicate buttons;
- duplicate drawers;
- duplicate tables;
- repeated inline style systems.

When touching an old page-local pattern, migrate reusable pieces toward shared primitives where practical.

Static layout, spacing, typography, and state colors belong in shared semantic CSS classes. Keep inline styles only for values that are genuinely data-driven at render time, such as chart dimensions or calculated opacity.

---

# 25. RESPONSIVE QUALITY

Validate significant UI at:

- 360
- 390
- 768
- 1024
- 1440 px

Do not shrink desktop tables into unusable mobile tables.

Use:

- cards;
- drawers;
- bottom sheets;
- agenda views;

where appropriate.

---

# 26. ACCESSIBILITY

Every changed screen must preserve:

- keyboard operability;
- visible focus;
- semantic labels;
- usable touch targets;
- modal focus behavior;
- status meaning beyond color alone.

Accessibility failures are product defects.

---

# 27. GLOBAL SEARCH

Until genuine domain search exists, call the current launcher:

**Command / Navigation Search**

Do not imply it searches members, bookings, or classes unless it actually queries those entities.

---

# 28. NOTIFICATIONS

Do not display notification controls unless backed by notification state.

A notification centre requires persisted:

- recipient;
- category;
- message;
- resource link;
- read state;
- created date.

Notification preferences alone do not constitute a notification centre.

---

# 29. AUTOMATIONS

An automation is only “automatic” if the application performs:

`domain event → rule match → conditions → delay → queue → action → result`

Manual trigger endpoints do not satisfy this definition.

All runs must preserve execution history.

---

# 30. IMPORTS

Do not write one-off CSV parsers for every domain.

Build the reusable import workflow:

`upload → map → preview → validate → duplicates → import → report`

Imports must be durable jobs.

---

# 31. VENDOR INTEGRATIONS

Never invent or approximate external vendor APIs.

Live integration requires:

- approved vendor access;
- documentation;
- known authentication;
- legal/licensing viability.

Otherwise implement L0/L1 support:

- manual entry;
- CSV/file import;
- provenance.

---

# 32. SPECIALIST DATA

Assessment and therapy architecture should remain vendor-neutral.

Do not hardcode the system around one diagnostic device or modality.

Vendor raw payloads may be stored separately from normalized FITOS data.

---

# 33. SPECIALIST SAFETY

Displaying a checklist is not equivalent to completing it.

Therapy/clinical-style workflows requiring safety steps must persist completed responses.

FITOS must not automatically:

- diagnose;
- prescribe;
- determine regulated device dosage;
- control medical devices.

---

# 34. DATABASE MIGRATIONS

All database changes must use forward-only migrations.

Never edit committed historical migrations.

Migrations must work:

- on a fresh database;
- sequentially from the previous release.

---

# 35. TEST EXPECTATIONS

Every important change should include the correct test level.

### Unit

Pure domain logic.

### Integration

Persistence, tenancy, constraints, lifecycle.

### Component

Forms, dialogs, responsive controls, errors.

### E2E

Business-critical workflows.

---

# 36. DO NOT WEAKEN TESTS TO PASS CI

Never obtain green CI by:

- disabling tests;
- skipping a failing flow;
- removing meaningful assertions;
- replacing real persistence with mocks;
- suppressing console/runtime errors.

Fix the defect.

---

# 37. CI IS A RELEASE GATE

No feature/release is complete while required CI is red.

Expected pipeline:

- install;
- format;
- lint;
- typecheck;
- migrate;
- seed;
- API tests;
- security/tenancy tests;
- Playwright;
- build;
- production config validation;
- smoke validation;
- dependency audit;
- secret scan.

---

# 38. CURRENT ACTIVE BLOCKERS

Before broad feature expansion, prioritize:

1. Restore Playwright CI.
2. Repair Sites block contract mismatch.
3. Enable editing of persisted Site pages.
4. Fix Inventory Receive Lot.
5. Replace fake notification bell behavior.
6. Correct misleading global-search wording or implement true search.
7. Implement true All Locations branch scope.
8. Complete booking reschedule.
9. Complete booking waitlist.
10. Complete membership hold/resume/renew.

The Sites contract, persisted-page editing, and Inventory Receive Lot foundations are now implemented and PostgreSQL-verified in the roadmap evidence ledger. They still require hosted/browser acceptance where noted; the next active product blockers are Playwright CI, notification inbox, all-location semantics, and account/workflow completion.

---

# 39. DO NOT REBUILD WORKING MODULES

Existing modules with solid persistence should be evolved rather than rewritten.

Examples include:

- memberships;
- booking core;
- attendance;
- scheduling;
- inventory core;
- equipment core;
- assessment foundation;
- therapy foundation;
- Platform tenant lifecycle;
- member identity.

Prefer surgical completion.

---

# 40. PR EXPECTATION

Every PR must answer:

**What gap is being closed?**

**What was incomplete before?**

**What server-side behavior changed?**

**What persistence changed?**

**What authorization/capability behavior applies?**

**What tests prove it?**

---

# 41. FINAL ENGINEERING PRINCIPLE

Every FITOS interface element is a promise.

If the system cannot keep the promise:

- implement it;
- disable it truthfully;
- or remove it.

## Build what the UI promises.

## Persist what users change.

## Test what businesses depend on.

# 42. EVIDENCE LEDGER

Current verified slices include membership hold/resume/renewal, durable account export/plan-change/cancellation/deletion requests with Platform metadata and review decisions, and shared recoverable query failures across Ops, Insights, Bookings, Members, Attendance, Memberships, Schedule, Services, Equipment, and Platform overview/directory. Each slice has explicit roadmap evidence and local verification; hosted browser coverage remains separate.

For every gap-resolution change, update `docs/FITOS V2 — ROADMAP GAP MATRIX.md` with the verified scope and test evidence. Use `docs/FITOS V2 — DEFINITION OF DONE.md` as the completion gate. Local checks must be labeled as local; they do not substitute for hosted CI, Playwright, production-image, or deployment evidence.
