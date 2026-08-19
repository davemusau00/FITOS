# FITOS Codebase Status

**Repository:** `davemusau00/FITOS`  
**Primary branch reviewed:** `main`  
**Snapshot date:** 19 August 2026  
**Latest observed commit:** `8eec3e4e6ad4b9c2600062b94ddb03a51ebdeb75`  
**Latest observed commit message:** `refactor: change imports to type imports for better clarity and performance`  
**Latest observed commit time:** 2026-08-19 18:07:34 UTC / 21:07:34 EAT  
**Product:** FITOS — Fitness Business Operating System  
**Current development stage:** Foundation / Tenant Core / Early Member CRM  
**Document purpose:** Provide an evidence-based engineering snapshot of what is implemented, what is partially implemented, what remains unverified, what is not started, and what should be built next.

---

## 1. Executive Summary

FITOS has progressed beyond a greenfield scaffold. The repository now contains a coherent multi-application TypeScript monorepo with:

- a React/Vite web application;
- a NestJS REST API;
- a BullMQ/Redis worker;
- a PostgreSQL/Drizzle data layer;
- shared contracts, authentication utilities, UI primitives, and shared helpers;
- Docker and production deployment assets;
- CI automation;
- encrypted database backup tooling;
- deployment and restore runbooks;
- tenant-aware authentication and authorization;
- organization and branch management;
- staff visibility and access-related backend support;
- a functioning member CRM slice;
- audit history;
- initial tenant-isolation testing.

The current codebase is therefore best described as a **strong application spine with the first operational vertical slice implemented**.

It is not yet a sellable fitness-business operating system because the fitness-specific operating loop is still missing:

> Lead → Member → Service → Schedule → Booking → Membership → Payment → Attendance → Renewal

At present, FITOS reliably reaches roughly:

> Authentication → Tenant → Branch → Staff Context → Member CRM → Audit

The next meaningful transition is to implement **services, scheduling, and booking**. That is the point at which FITOS stops looking primarily like a well-architected CRM foundation and begins behaving like fitness-business software.

### Current high-level assessment

| Area | Status | Assessment |
|---|---:|---|
| Repository/tooling | ✅ | Strong |
| Application architecture | ✅ | Strong |
| Multi-tenancy foundation | ✅ | Strong design, more production verification required |
| Authentication | ✅ | Implemented, E2E verification still required |
| Authorization / capabilities | ✅ | Implemented |
| Organization management | ✅ | Implemented |
| Branch management | 🟡 | Core implemented; full lifecycle parity should be verified |
| Staff visibility | ✅ | Implemented |
| Staff access management | 🟡 | Backend support exists; complete UI/acceptance flow unfinished |
| Member CRM | ✅ | First usable product slice |
| Audit trail | ✅ | Implemented |
| Database migrations / seeding | ✅ | Implemented |
| UI design system | ✅ | Strong first version |
| Worker infrastructure | ✅ | Operational skeleton implemented |
| Business worker processors | 🟡 | Early |
| Automated testing | 🟡 | Framework exists; key Sprint 01 E2E gates remain unverified |
| CI pipeline | ✅ | Workflow implemented; latest successful run not verified in this review |
| Production Docker | ✅ | Assets present |
| Deployment automation | ✅ | Assets present |
| Staging deployment | ⚪ | Not verified |
| Backups | ✅ | Encrypted backup script present |
| Restore drill | ⚪ | Procedure documented; completed drill not evidenced |
| Leads | ⛔ | Not implemented |
| Services | ⛔ | Not implemented |
| Scheduling | ⛔ | Not implemented |
| Booking | ⛔ | Not implemented |
| Memberships / credits | ⛔ | Not implemented |
| Payments / M-Pesa | ⛔ | Not implemented |
| Attendance | ⛔ | Not implemented |
| Notifications / WhatsApp | ⛔ | Provider architecture planned; product flow not implemented |
| Reporting | ⛔ | Not implemented beyond basic overview counts |
| Public booking portal | ⛔ | Not implemented |
| Member portal | ⛔ | Not implemented |
| AI / intelligence | ⛔ | Intentionally future scope |

### Evidence-weighted progress estimate

These percentages are engineering assessments against the documented roadmap, not GitHub-generated statistics.

- **Sprint 01 implementation completeness:** approximately **70–80%**
- **Sprint 01 operational verification:** approximately **40–50%**
- **Core CRM readiness:** approximately **40–50%**
- **Sellable FITOS MVP readiness:** approximately **20–25%**
- **Full documented Phase 0–12 vision:** still early

The largest gap is not architecture. The largest gap is **fitness-domain behavior**.

---

## 2. Status Legend

This document uses the following status vocabulary.

| Marker | Meaning |
|---|---|
| ✅ Implemented | Code/artifact is present and materially implements the intended capability |
| 🟡 Partial | Substantial implementation exists, but acceptance criteria or user flow is incomplete |
| ⚪ Unverified | Artifact may exist, but runtime/deployment/acceptance success was not proven in this review |
| 🔵 Specified | Detailed documentation exists, but implementation has not begun or was not observed |
| ⛔ Not Started | No corresponding product module was observed in the active implementation |
| ⚠ Risk | Requires attention before pilot or production use |

A capability can be implemented in source code while remaining operationally unverified. FITOS should preserve that distinction.

---

## 3. Product and Engineering Intent

The implementation specification locks FITOS around the following baseline:

- React + TypeScript + Vite;
- React Router;
- TanStack Query;
- React Hook Form + Zod;
- NestJS + TypeScript REST API;
- PostgreSQL;
- Redis;
- background worker;
- Docker / Docker Compose;
- Nginx;
- S3-compatible storage abstraction;
- M-Pesa adapters;
- WhatsApp adapters;
- modular-monolith backend.

The documented primary surfaces are:

1. Admin application
2. Reception/front-desk mode
3. Public tenant booking portal
4. Member self-service portal
5. Platform administration later

The intended implementation order is:

1. Foundation and tenancy
2. Authentication/authorization
3. Branches and staff access
4. CRM/member core
5. Services/scheduling
6. Booking
7. Memberships/credits
8. Payments
9. Attendance
10. Notifications
11. Reporting
12. Public tenant website

The current repository is correctly following this sequence. It has not prematurely added payment, AI, inventory, or marketplace complexity before the tenant/member spine is stable.

---

## 4. Repository Architecture

### 4.1 Monorepo

The root project is configured as an npm-workspaces monorepo.

Current workspace pattern:

```text
apps/*
packages/*
```

Primary root scripts include:

```text
dev
build:packages
build
typecheck
lint
format
format:check
test
test:unit
test:integration
test:e2e
test:tenancy
db:generate
db:migrate
db:seed
db:status
db:reset:test
check
```

The root `check` command is especially useful because it provides one developer-facing gate:

```text
format:check
→ lint
→ typecheck
→ test
→ build
```

### 4.2 Application layout

Observed application structure:

```text
apps/
├── api/
├── web/
└── worker/
```

This matches the documented target architecture.

### 4.3 Shared packages

Observed shared packages:

```text
packages/
├── auth/
├── contracts/
├── database/
├── shared/
└── ui/
```

This separation is healthy.

#### `packages/auth`

Owns authentication-oriented utilities such as password/session primitives.

#### `packages/contracts`

Owns shared domain/API types, permissions, and contracts consumed across server and client.

#### `packages/database`

Owns Drizzle configuration, schema, migrations, seeding, migration tooling, test reset tooling, and operator provisioning.

#### `packages/shared`

Owns cross-application helpers that do not belong to a narrower domain package.

#### `packages/ui`

Owns reusable UI primitives and design tokens.

### Architecture verdict

**Status: ✅ Strong**

The current separation is appropriate for a modular monolith and avoids premature microservice fragmentation.

---

## 5. Frontend Status

### 5.1 Technology

Observed frontend stack:

- React;
- TypeScript;
- Vite;
- React Router;
- TanStack Query;
- React Hook Form;
- shared `@fitos/ui` components;
- shared `@fitos/contracts` types.

### 5.2 Current routes

The active router currently exposes:

```text
/login

/app
├── /overview
├── /members
├── /members/new
├── /members/:memberId
├── /staff
├── /settings
├── /settings/organization
├── /settings/branches
├── /settings/branches/new
├── /settings/team
└── /settings/security

/onboarding
```

Protected routes are wrapped with authenticated route handling.

### 5.3 Login experience

Implemented behavior includes:

- FITOS-branded login;
- email/password form;
- authenticated redirect;
- loading state;
- API error handling;
- demo credentials in the development UI;
- no dependency on client-side localStorage tokens in the observed architecture.

**Status: ✅ Implemented**

### 5.4 Overview dashboard

The current overview displays:

- total members;
- active members;
- branch count;
- staff count when permission allows;
- recent members;
- setup progress.

This is an appropriate Sprint 01 overview.

It should not yet be treated as the final operational dashboard. Revenue, occupancy, renewals, attendance, booking utilization, lead conversion, and churn metrics do not yet exist.

**Status: ✅ Sprint 01 overview implemented**

### 5.5 Members list

Observed functionality:

- member listing;
- search by name/phone/email through API query parameters;
- branch filtering;
- member-status filtering;
- row navigation;
- loading state;
- error state;
- empty state;
- filtered-empty state.

**Status: ✅ Core implemented**

Items that still require acceptance verification:

- pagination under larger datasets;
- compact-mobile ergonomics under realistic datasets;
- accessibility testing;
- response time under pilot-scale data.

### 5.6 Create member

Observed fields:

- first name;
- last name;
- phone;
- email;
- date of birth;
- home branch.

Observed behavior:

- field validation;
- API submission;
- mapped API field errors;
- redirect to member detail after creation;
- member-query invalidation.

**Status: ✅ Implemented**

Outstanding acceptance concerns:

- duplicate-member warning strategy should be explicitly verified;
- phone normalization should be verified with Kenyan input variants;
- realistic recovery behavior after network errors should be E2E tested.

### 5.7 Member detail

Observed functionality:

- member status;
- joined date;
- phone;
- email;
- home branch;
- member number;
- audit timeline;
- edit mode.

**Status: 🟡 Mostly implemented**

Missing or not observed from Sprint 01 acceptance:

- permission-gated deactivate flow;
- richer detail tabs are intentionally future scope;
- memberships/bookings/payments/attendance do not yet exist.

### 5.8 Staff screen

Observed functionality:

- staff list;
- staff email/name;
- role;
- branch access;
- status.

The UI explicitly notes that invitation and branch-access APIs are active while secure invitation acceptance will arrive with the automation/email slice.

**Status: 🟡 Partial**

The current staff screen is primarily visibility-oriented. It is not yet a complete administration experience for role and branch assignment.

### 5.9 Organization settings

Observed functionality:

- business name;
- default timezone;
- default currency;
- update through API;
- local query-cache update.

**Status: ✅ Implemented**

### 5.10 Branch settings

Observed functionality:

- list accessible branches;
- show active/inactive status;
- create a branch;
- city;
- timezone.

**Status: 🟡 Core implemented**

Still verify or complete:

- branch edit flow;
- deactivation flow;
- restrictions around historical data;
- permission behavior for users with limited branch access.

### 5.11 Security screen

The current screen communicates:

- opaque HttpOnly server sessions;
- server-side revocation;
- server-resolved tenant scope;
- audit logging.

This is currently explanatory rather than a full security administration console.

**Status: ✅ Appropriate for Sprint 01**

### 5.12 Onboarding

The onboarding flow currently covers:

1. business;
2. first branch;
3. team;
4. services as a future step.

This accurately communicates current product readiness.

**Status: ✅ Implemented**

---

## 6. UI Design System

Recent repository work added reusable UI primitives and design tokens.

Observed/mentioned components include:

- Button;
- IconButton;
- Input;
- TextArea;
- Select;
- Checkbox;
- FormField;
- Alert;
- badges/status badges;
- Modal;
- AlertDialog;
- Drawer;
- Skeleton;
- EmptyState;
- PageHeader;
- DataTable;
- SearchBar;
- Icon.

The Sprint 01 design specification establishes the following core palette:

- Energy `#C6FF00`
- Pure `#FFFFFF`
- Steel `#6B6F76`
- Carbon `#121417`
- Jet `#0A0A0A`

The UI package is already serving as a design-system boundary instead of allowing feature code to become a pile of one-off components.

### Status

**✅ Implemented as a strong first version**

### Still required

- dedicated component tests;
- accessibility verification;
- visual regression strategy;
- responsive QA across all primitives;
- eventual documentation/storybook equivalent if the component inventory expands materially.

---

## 7. Backend/API Status

### 7.1 Framework

The backend is a NestJS modular monolith.

Observed active controllers/modules:

```text
health
auth
organizations
branches
members
users
audit
core
```

Observed common infrastructure includes:

- session guard;
- permission guard;
- request context;
- rate limiting service;
- idempotency service;
- API exception filter;
- request logging interceptor;
- repository abstraction.

### 7.2 Repository abstraction

The API can select between:

- in-memory repository;
- Drizzle/PostgreSQL repository.

Production is explicitly documented to require:

```text
FITOS_REPOSITORY=drizzle
```

The in-memory repository is development-oriented.

This abstraction is useful for fast tests while preserving a real persistence implementation.

### 7.3 Authentication

Observed implementation architecture includes:

- password hashing through `ScryptPasswordHasher`;
- server session storage;
- session guard;
- logout/revocation-oriented architecture;
- opaque cookie-session model;
- authenticated request actor;
- rate limiting.

**Status: ✅ Implemented**

### Verification still required

- login E2E;
- expired-session rejection;
- session rotation acceptance;
- cookie flags under deployed HTTPS;
- logout revocation in deployed environment;
- generic invalid-login response;
- brute-force/rate-limit behavior.

### 7.4 Authorization

Observed architecture includes:

- shared permission keys;
- capability guard;
- `RequirePermission(...)` style checks;
- tenant and branch context resolved server side;
- permission-aware UI.

**Status: ✅ Implemented**

### 7.5 Organization API

Observed module and frontend integration indicate organization read/update is active.

**Status: ✅ Implemented**

### 7.6 Branch API

Branch creation/read behavior is clearly active.

The exact full parity of:

```text
GET /branches
POST /branches
GET /branches/:id
PATCH /branches/:id
POST /branches/:id/deactivate
```

should be explicitly audited against controller source before declaring FITOS-010 completely closed.

**Status: 🟡 Mostly implemented / endpoint parity verification required**

### 7.7 Member API

Observed frontend usage and backend module structure support:

- list;
- create;
- detail;
- update;
- timeline;
- search;
- filters;
- audit.

**Status: ✅ Core implemented**

### 7.8 Staff/user API

Staff listing exists, and the UI states invitation/branch-access APIs are active.

**Status: 🟡 Partial as an end-to-end product workflow**

Invitation acceptance and secure email delivery are intentionally deferred.

### 7.9 Audit API

Audit events are represented in schema and exposed in application modules. Member timelines already consume audit-style activity.

**Status: ✅ Implemented**

### 7.10 Idempotency

An `idempotency_keys` table and `IdempotencyService` are present before payments/bookings are introduced.

This is excellent sequencing because future financial and booking endpoints can adopt idempotency instead of retrofitting it after duplicate side effects occur.

**Status: ✅ Foundation implemented**

---

## 8. Database Status

### 8.1 Database technology

- PostgreSQL
- Drizzle ORM/migrations
- UUID identifiers
- timezone-aware timestamps
- explicit tenant scoping
- migration tooling
- seed tooling
- test reset tooling

### 8.2 Current implemented schema

Observed tables:

```text
tenants
branches
users
roles
permissions
role_permissions
tenant_users
user_branch_access
sessions
contacts
members
audit_events
idempotency_keys
```

This is explicitly a **foundation schema only**. The source states that new domain tables should be added with the vertical slice that owns their invariants.

That is the correct approach.

The repository does not pre-create speculative booking/payment/membership tables before their business rules are implemented.

### 8.3 Tenant model

Tenant ownership is explicit across relevant tables.

Examples:

- `branches.tenant_id`
- `tenant_users.tenant_id`
- `contacts.tenant_id`
- `members.tenant_id`
- `audit_events.tenant_id`
- `idempotency_keys.tenant_id`

The shared `TenantScope` type makes tenant ID non-optional:

```text
tenantId
branchIds
```

This is an important safety property.

### 8.4 Branch model

Branches include:

- tenant;
- name;
- slug;
- timezone;
- phone;
- email;
- address lines;
- city;
- country code;
- latitude/longitude;
- active state;
- timestamps.

This is sufficient for the operating foundation and future scheduling/location behavior.

### 8.5 User/access model

The schema separates:

- global `users`;
- tenant membership via `tenant_users`;
- role assignments;
- permissions;
- role permissions;
- branch access.

This is preferable to embedding a single global role on the user record.

### 8.6 Session model

Sessions include:

- user;
- tenant user;
- token hash;
- expiry;
- last seen;
- optional hashed IP context;
- user-agent summary;
- revocation time.

This supports server-side revocation and future security visibility.

### 8.7 Contact/member split

The schema separates `contacts` from `members`.

This is strategically important.

It allows FITOS to later support:

- leads that are contacts but not members;
- former members;
- prospects;
- guardians or corporate contacts;
- duplicate-safe lead conversion;
- member lifecycle without conflating identity and membership.

This structure is well aligned with the future CRM roadmap.

### 8.8 Money model

The shared money type uses string-form minor units to avoid JavaScript precision problems.

This should be retained when payment tables arrive.

### 8.9 Missing domain tables

Not yet implemented:

```text
leads
lead_tasks
lead_notes
services
trainers / staff-domain assignments
resources / rooms / equipment
schedule_templates
schedule_occurrences
booking records
waitlists
membership_plans
member_memberships
credit_ledger
payment_intents
payment_transactions
payment_allocations
refunds
reconciliation records
attendance/checkins
notification jobs/logs
reporting projections
```

**Status: intentionally not started**

---

## 9. Seed and Demo Data

The current seed process creates stable permission keys and the following default roles:

- Owner
- Manager
- Reception
- Trainer
- Finance

It also provisions two demo tenants:

1. `FITOS Demo Gym`
   - branch: Kilimani
   - owner account: `owner@gym.fitos.test`

2. `FITOS Demo Pilates`
   - branch: Westlands
   - owner account: `owner@pilates.fitos.test`

This is particularly useful for tenancy testing because the seed already creates two separate organizations.

### Status

**✅ Implemented**

### Recommended improvement

Use these two demo tenants as mandatory actors in database-backed cross-tenant integration/E2E tests.

---

## 10. Multi-Tenancy and Isolation

Multi-tenancy is one of the strongest architectural areas in the current codebase.

### Existing controls

- tenant context resolved from authenticated server session;
- browser does not select tenant by arbitrary tenant ID;
- tenant ID is mandatory in persistence scope;
- branch access is modeled separately;
- tenant-aware unique constraints;
- capability guards;
- explicit audit records;
- at least one dedicated in-memory tenancy test;
- two seeded demo tenants.

### Important limitation

PostgreSQL Row Level Security is intentionally deferred in the current plan. Isolation therefore depends heavily on:

- repository discipline;
- service discipline;
- test coverage;
- authorization guard correctness.

That is acceptable for an early modular monolith, but it makes cross-tenant automated testing a release blocker.

### Status

**✅ Strong design**

**🟡 Production proof incomplete**

### Required before pilot

- database-backed cross-tenant read tests;
- database-backed cross-tenant mutation tests;
- known-UUID attacks against all tenant resources;
- branch-scope tests;
- staff permission escalation tests;
- audit isolation tests;
- regression test for every new tenant-owned domain module.

---

## 11. Background Worker Status

### 11.1 Infrastructure

The worker is not an empty placeholder.

Observed behavior includes:

- BullMQ Worker;
- Redis connection;
- runtime environment validation with Zod;
- concurrency setting;
- completion logging;
- failure logging;
- graceful SIGINT/SIGTERM shutdown;
- defined queue/job schema;
- processor directory.

### Status

**✅ Worker runtime foundation implemented**

### 11.2 Business processors

The business processor layer remains early.

Future documented responsibilities include:

- transactional notifications;
- booking reminders;
- membership-expiry workflows;
- receipts;
- imports;
- exports;
- payment reconciliation;
- retries;
- dead-letter visibility.

### Status

**🟡 Infrastructure ready, product workload early**

---

## 12. CI Status

The repository contains `.github/workflows/ci.yml`.

The current CI job provisions:

- PostgreSQL 18;
- Redis 8;
- Node 24.

It then executes:

```text
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run db:migrate
npm run db:seed
npm test
npm run build
npm audit --omit=dev --audit-level=high
gitleaks secret scan
```

Environment configuration also selects the Drizzle repository for CI.

### Strengths

- real PostgreSQL is part of CI;
- Redis is available;
- migrations run in CI;
- seeding runs in CI;
- build and typecheck are distinct;
- dependency audit exists;
- secret scanning exists.

### Current verification limitation

A combined-status query for the latest observed commit did not return commit statuses during this review.

Therefore:

> The CI workflow is implemented, but this document does **not** claim the latest `main` commit has a verified green CI run.

### Status

**✅ Pipeline implemented**

**⚪ Latest run success unverified**

---

## 13. Docker and Deployment Status

### 13.1 Development compose

Docker Compose configuration is present for local dependencies.

### 13.2 Production assets

Observed production artifacts include:

```text
compose.production.yaml
infra/docker/api.Dockerfile
infra/docker/worker.Dockerfile
infra/docker/nginx.Dockerfile
infra/nginx/
infra/scripts/deploy.sh
```

### Status

**✅ Production packaging assets implemented**

### What remains unverified

- image build success on latest commit;
- actual remote image publication;
- hardened VPS state;
- active public staging URL;
- HTTPS certificate state;
- production-like secrets;
- readiness endpoint behavior behind Nginx;
- rollback rehearsal.

---

## 14. Backup and Restore

### 14.1 Backup

`infra/scripts/backup-postgres.sh` currently:

- requires database URL;
- requires backup directory;
- requires encryption recipient;
- uses restrictive `umask`;
- creates timestamped dumps;
- streams `pg_dump` into `age` encryption;
- uses a temporary file;
- atomically renames completed backup;
- removes expired backups according to retention days;
- fails on shell errors.

This is a credible backup implementation for Sprint 01.

**Status: ✅ Implemented**

### 14.2 Restore documentation

The restore runbook documents:

- clean PostgreSQL target;
- backup decryption;
- `pg_restore`;
- reviewed migrations;
- API startup;
- test authentication;
- tenant/branch/member validation;
- future booking/payment-history verification;
- RTO recording;
- sanitization restrictions.

**Status: ✅ Procedure documented**

### 14.3 Restore drill

No evidence from the inspected repository proves that a real restore drill has been successfully completed and recorded.

**Status: ⚪ Unverified**

This remains a Sprint 01 exit criterion.

---

## 15. Documentation Quality

FITOS currently has unusually strong engineering documentation for its stage.

Observed developer specification files cover areas including:

- implementation overview;
- product and scope;
- repository tree;
- database schema/ERD;
- UX/UI design system;
- API catalogue;
- frontend architecture;
- backend architecture;
- route/screen map;
- data model and multi-tenancy;
- shared types/events/permissions;
- Sprint 01 implementation;
- bootstrap/environment;
- codebase conventions;
- phased delivery backlog;
- acceptance test matrix.

Operational runbooks also exist for:

- deployment;
- restore.

### Strength

The repository contains both:

1. **what FITOS should become**, and
2. **how the codebase should be constructed**.

### Risk

Specification maturity can create the illusion that a feature exists because it is thoroughly documented.

For this reason, future codebase reviews should continue separating:

- documented;
- coded;
- tested;
- deployed;
- pilot-proven.

---

## 16. Sprint 01 Ticket-by-Ticket Status

Sprint 01 is defined as:

> Foundation + Tenant Core + Member Core

Its stated outcome is that an owner can deploy FITOS, sign in, configure an organization and branches, manage staff access, create/search/edit members, and see audit history, while Tenant A cannot read or mutate Tenant B.

### Epic A — Repository and Tooling

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-001 | Monorepo Bootstrap | ✅ | Apps/packages/workspaces/scripts are present |
| FITOS-002 | Local Docker Dependencies | ✅ / ⚪ | Compose assets present; runtime health not independently verified |

### Epic B — Database Foundation

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-003 | Migration Framework | ✅ | Drizzle config, migrations, migrate/status/reset tooling present |
| FITOS-004 | Permission and Role Seed | ✅ | Stable permissions plus Owner/Manager/Reception/Trainer/Finance seed |

### Epic C — Authentication

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-005 | Session Authentication | ✅ / ⚪ | Architecture implemented; full E2E acceptance remains to be proven |
| FITOS-006 | Login UI | ✅ | Route and responsive form flow present |

### Epic D — Tenant and Authorization Core

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-007 | Request Context | ✅ | Server-side actor/tenant/branch context architecture present |
| FITOS-008 | Capability Guard | ✅ | Permission guard and permission decorator architecture present |
| FITOS-009 | Organization API | ✅ | Read/update integrated with UI |
| FITOS-010 | Branch CRUD API | 🟡 | Core branch behavior active; verify complete endpoint/deactivation parity |
| FITOS-011 | Organization and Branch UI | ✅ / 🟡 | Org + branch list/create present; full branch lifecycle should be completed |

### Epic E — Design System and Shell

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-012 | Tokens | ✅ | Design tokens implemented |
| FITOS-013 | UI Primitives | ✅ / ⚪ | Component set implemented; dedicated interaction tests not verified |
| FITOS-014 | Admin Shell | ✅ | Protected shell/routes/nav structure present |

### Epic F — Member Core

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-015 | Contact and Member Repository | ✅ | In-memory + Drizzle persistence model present |
| FITOS-016 | Members API | ✅ / ⚪ | CRUD/search/timeline integrated; pagination and full acceptance need explicit verification |
| FITOS-017 | Members List UI | ✅ / ⚪ | Search/filter/states present; pagination/mobile QA unverified |
| FITOS-018 | Create Member UI | ✅ / 🟡 | Core complete; duplicate-warning acceptance not confirmed |
| FITOS-019 | Member Detail UI | 🟡 | Overview/timeline/edit present; deactivate flow not observed |

### Epic G — Staff Access

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-020 | Tenant User List | ✅ | Staff list is consumed by web UI |
| FITOS-021 | Staff UI | ✅ | View role/branches/status |
| FITOS-022 | Role/Branch Access Management | 🟡 | API support indicated; complete management/acceptance UI not finished |

### Epic H — Audit and Logging

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-023 | Audit Service | ✅ | Schema/module/timeline behavior present |
| FITOS-024 | Structured Logging | ✅ / ⚪ | Request/worker structured logging present; production redaction must be verified |

### Epic I — Testing

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-025 | Tenant Isolation Suite | 🟡 | Dedicated tenancy test exists; DB-backed breadth should be expanded |
| FITOS-026 | Auth E2E | ⚪ | Test script architecture exists; complete E2E suite not confirmed |
| FITOS-027 | Member E2E | ⚪ | Required flow not confirmed as complete automated E2E |

### Epic J — CI and Deployment

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-028 | CI | ✅ / ⚪ | Workflow implemented; latest green run not verified |
| FITOS-029 | Production Docker Images | ✅ / ⚪ | API/worker/Nginx Dockerfiles present; current build runtime not verified |
| FITOS-030 | Staging VPS | ⚪ | Deployment tooling exists; public HTTPS staging deployment not evidenced |

### Epic K — Backup and Restore

| ID | Ticket | Status | Notes |
|---|---|---:|---|
| FITOS-031 | Database Backup | ✅ / ⚪ | Encrypted backup script implemented; scheduled/off-server execution not evidenced |
| FITOS-032 | Restore Drill | ⚪ | Runbook exists; completed restore drill not evidenced |

---

## 17. Sprint 01 Exit-Criteria Status

Documented Sprint 01 exit criteria:

| Exit criterion | Current status |
|---|---:|
| CI green | ⚪ Not verified |
| Staging deployed over HTTPS | ⚪ Not verified |
| Two demo tenants | ✅ Implemented |
| Separate branches and members | ✅ Foundation available |
| Cross-tenant IDs rejected | 🟡 Tests exist; production-depth proof incomplete |
| Owner login/session/logout works | ✅ Code present / ⚪ deployed E2E unverified |
| Member CRUD desktop and compact mobile | 🟡 Core UI present; full acceptance QA unverified |
| Staff role/branch changes audited | 🟡 Backend foundations present; complete flow not verified |
| No P0/P1 bug | ⚪ Cannot be established from repository inspection alone |
| Production-style Docker images built | ⚪ Dockerfiles exist; successful build not verified |
| DB backup created | ⚪ Script exists; actual generated backup not evidenced |
| Backup restored successfully | ⚪ Not evidenced |
| Release tag identifies deployed commit | ⚪ Not evidenced |

### Sprint 01 conclusion

Sprint 01 is **not yet formally closed**, even though much of its implementation is present.

The remaining work is primarily:

- acceptance;
- E2E testing;
- access-management completion;
- staging;
- backup/restore proof;
- release discipline.

That is a healthy situation. It means the remaining Sprint 01 work is less about architecture invention and more about proving the architecture behaves correctly.

---

## 18. Current Product Capability Map

### 18.1 Tenant administration

```text
Login
→ organization
→ branches
→ staff visibility
→ security context
```

**Readiness: good**

### 18.2 Member CRM

```text
Create
→ list
→ search
→ filter
→ open profile
→ edit
→ audit timeline
```

**Readiness: good for early internal demonstration**

### 18.3 Fitness operations

```text
Service
→ schedule
→ class occurrence
→ resource
→ trainer
→ capacity
→ booking
```

**Readiness: not implemented**

### 18.4 Membership operations

```text
Plan
→ entitlement
→ member membership
→ credits
→ renewal
→ freeze/cancel
```

**Readiness: not implemented**

### 18.5 Payment operations

```text
Payment intent
→ M-Pesa/manual payment
→ allocation
→ receipt
→ refund
→ reconciliation
```

**Readiness: not implemented**

### 18.6 Front desk

```text
Search member
→ verify entitlement
→ check in
→ roster
→ no-show
→ override
```

**Readiness: not implemented**

### 18.7 Customer self-service

```text
Public timetable
→ booking
→ payment
→ member portal
→ reschedule/cancel
```

**Readiness: not implemented**

---

## 19. What Should Be Built Next

The next development milestone should not be payments, dashboards, AI, inventory, or a marketing website.

It should be:

# Milestone 02 — CRM to Booking Spine

Build a complete operational path:

> Lead → Member → Service → Schedule → Booking

### 19.1 Contacts and leads

Add:

- lead status;
- lead source;
- owner/assignee;
- tasks;
- notes;
- follow-up date;
- conversion into member;
- duplicate-safe identity handling;
- audit trail.

Recommended lifecycle:

```text
new
→ contacted
→ trial_booked
→ trial_completed
→ offer
→ won
→ lost
```

Do not overfit the initial pipeline. Keep states configurable later.

### 19.2 Services

Add service definitions for:

- group class;
- personal training;
- consultation;
- physiotherapy;
- Pilates;
- yoga;
- HIIT;
- swimming;
- future resource booking.

Core fields:

- tenant;
- branch availability;
- name;
- category;
- duration;
- capacity;
- price;
- active status;
- booking policy.

### 19.3 Trainers and resources

Model:

- trainer/staff eligibility;
- rooms;
- studios;
- reformers;
- equipment;
- pools/courts where applicable.

Resource constraints should be explicit before booking is implemented.

### 19.4 Scheduling

Implement:

- recurring templates;
- materialized occurrences;
- exceptions;
- timezone-safe dates;
- trainer conflict checks;
- room/resource conflict checks;
- branch closures;
- immutable historical occurrence behavior.

### 19.5 Booking

Implement:

- staff-created booking;
- public-ready booking service boundary;
- capacity-safe transaction;
- cancel;
- reschedule;
- audit history;
- optional waitlist;
- idempotency;
- concurrency tests.

Critical acceptance test:

> When one slot remains and two clients attempt to reserve simultaneously, exactly one reservation succeeds.

This is a release gate.

---

## 20. Milestone 03 — Membership to Attendance Spine

After booking stabilizes:

> Member → Membership → Payment → Attendance

### 20.1 Memberships

Implement:

- plans;
- membership snapshots;
- start/end dates;
- entitlement rules;
- session packs;
- immutable credit ledger;
- renewal;
- cancellation;
- authorized override.

### 20.2 Payments

Start with:

- manual cash;
- manual bank;
- payment intent;
- allocation;
- receipt;
- refund;
- unmatched payment reconciliation.

Only then enable live M-Pesa for approved pilots.

### 20.3 Attendance

Implement:

- front desk search;
- class roster;
- check-in;
- no-show;
- duplicate prevention;
- reasoned override;
- QR-ready member pass.

At the end of Milestone 03, FITOS should support a real business day.

---

## 21. Technical Risks

### ⚠ 21.1 Tenant isolation regression

Every new domain table increases the risk that a developer omits a tenant constraint.

Mitigation:

- tenant-scoped repository interfaces;
- mandatory tenant ownership;
- cross-tenant integration tests for every module;
- code-review checklist;
- eventual RLS review after pilot.

### ⚠ 21.2 Specification outrunning implementation

FITOS has excellent documentation. That can make project status appear further advanced than runtime reality.

Mitigation:

Every feature should carry four independent states:

```text
Specified
Implemented
Acceptance-tested
Pilot-proven
```

### ⚠ 21.3 Insufficient E2E proof

Unit/integration scaffolding is not enough for Sprint 01.

Required E2E journeys:

```text
login → current session → logout

login
→ organization
→ branch
→ create member
→ search
→ open
→ edit
→ timeline

Tenant A
→ known Tenant B UUID
→ read rejected
→ mutation rejected
```

### ⚠ 21.4 Staff privilege escalation

Role and branch access are high-risk surfaces.

Before pilot:

- final owner cannot be removed accidentally;
- user cannot grant capabilities above their authority;
- branch restrictions are enforced server-side;
- all changes are audited.

### ⚠ 21.5 Booking race conditions

When booking arrives, ordinary CRUD patterns will be insufficient.

Capacity updates must be transaction-safe and concurrency tested.

### ⚠ 21.6 Financial truth

When payments arrive, immutable history and reconciliation matter more than UI polish.

Do not allow destructive updates to financial records.

### ⚠ 21.7 Premature AI

AI should not be allowed to mutate:

- payments;
- memberships;
- credits;
- attendance truth;
- bookings;

until deterministic workflows and auditability are mature.

The current roadmap correctly defers intelligence.

---

## 22. Technical Debt / Cleanup Observations

### 22.1 Large frontend feature file

`apps/web/src/features/pages.tsx` currently contains many major pages in one file.

This is acceptable during early Sprint 01 velocity, but it will become difficult to maintain as services, booking, payments, and attendance arrive.

Recommended refactor before Milestone 02 grows significantly:

```text
features/
├── overview/
├── members/
├── staff/
├── settings/
├── onboarding/
└── shared/
```

Move API query keys and feature-specific forms closer to their domain.

### 22.2 Runtime versus type-only imports

Recent commits are cleaning TypeScript imports into type-only imports.

This indicates the project is actively tightening ESM/TypeScript behavior.

Continue this consistently rather than allowing mixed module semantics to accumulate.

### 22.3 Staff UI is behind API intent

The staff screen currently exposes data but not the complete access-management experience.

Close that gap before considering Sprint 01 complete.

### 22.4 Test command presence should not be confused with test coverage

The root has good test scripts, but each named quality gate should be backed by concrete test suites and CI evidence.

### 22.5 Environment/security documentation

Environment contracts are present, but production secret rotation and operational ownership should be formalized before external pilots.

---

## 23. Recommended Immediate Priority Queue

The next work should be split into two tracks.

## Track A — Close Sprint 01

1. **Verify CI green on `main`.**
2. **Add/verify Auth E2E.**
3. **Add/verify Member E2E.**
4. **Expand Drizzle/PostgreSQL tenant-isolation tests.**
5. **Complete staff role/branch access management UI.**
6. **Add final-owner protection test.**
7. **Complete/verify branch update + deactivate lifecycle.**
8. **Complete member deactivate behavior if retained in Sprint 01 scope.**
9. **Build production images from clean checkout.**
10. **Deploy staging over HTTPS.**
11. **Run login/member smoke test on staging.**
12. **Generate encrypted DB backup.**
13. **Restore backup into clean isolated database.**
14. **Record restore RTO and verification result.**
15. **Tag the Sprint 01 release.**

## Track B — Prepare Milestone 02

In parallel, finalize domain rules for:

1. contacts/leads;
2. service types;
3. trainer eligibility;
4. rooms/resources;
5. recurring scheduling;
6. occurrence exceptions;
7. booking policy;
8. cancellation/reschedule policy;
9. waitlists;
10. capacity concurrency.

Do not write the booking tables until these invariants are agreed.

---

## 24. Suggested GitHub Project Hygiene

At review time, no open GitHub issues or pull requests were returned for the repository.

The codebase has a detailed backlog in Markdown, but GitHub itself is not yet acting as an executable project tracker.

Recommended GitHub milestones:

```text
M01 — Foundation
M02 — CRM & Leads
M03 — Services & Scheduling
M04 — Booking
M05 — Memberships
M06 — Payments
M07 — Attendance
M08 — Automation
M09 — Reporting & Public Site
M10 — Nairobi Pilot
```

Each Markdown ticket should become a GitHub issue with:

- milestone;
- acceptance criteria;
- dependencies;
- risk label;
- frontend/backend/database labels;
- test requirements.

Recommended labels:

```text
area:frontend
area:backend
area:database
area:infra
area:security
area:testing
area:design-system
domain:crm
domain:scheduling
domain:booking
domain:membership
domain:payments
domain:attendance
priority:P0
priority:P1
priority:P2
status:blocked
pilot-critical
```

This will make future automated milestone tracking substantially more accurate.

---

## 25. Recommended Definition of Done

A FITOS feature should not be considered complete because a page renders.

### Definition of Done

A feature is complete when:

- business rules are documented;
- API contract is stable;
- database migration is reviewed;
- tenant ownership is explicit;
- authorization is enforced server-side;
- audit requirements are implemented;
- idempotency/concurrency behavior is defined where relevant;
- unit tests pass;
- integration tests pass;
- cross-tenant tests pass;
- UI loading/error/empty states exist;
- keyboard accessibility is acceptable;
- mobile layout is verified;
- CI is green;
- staging smoke test passes;
- operational documentation is updated where relevant.

For financial, booking, membership, or attendance modules, require additional domain-specific acceptance tests.

---

## 26. Pilot Readiness Gate

FITOS should not onboard a real fitness business as a daily-operating pilot until the following loop is reliable:

```text
Member
→ service
→ schedule
→ booking
→ membership/entitlement
→ payment
→ attendance
```

Minimum pilot readiness:

- no known cross-tenant leakage;
- CI green;
- stable staging/production deployment;
- successful restore drill;
- reliable member import path;
- booking concurrency proof;
- payment reconciliation;
- attendance/check-in;
- audit history;
- staff permissions;
- daily operational report;
- support escalation path.

The pilot should initially involve controlled design partners rather than broad public self-service signup.

---

## 27. Current Architectural Strengths

The strongest parts of FITOS today are:

### 27.1 Correct sequencing

Foundation before payments and AI.

### 27.2 Tenant safety is treated as a first-class concern

This is uncommon in early SaaS builds and will pay off later.

### 27.3 Contact/member separation

This unlocks a real CRM instead of a simplistic gym member table.

### 27.4 Strong shared-package boundaries

Contracts, auth, database, and UI are separated cleanly.

### 27.5 Good operational instincts

CI, Docker, encrypted backup tooling, deployment scripts, and restore documentation already exist.

### 27.6 Idempotency before payment complexity

This reduces future financial/booking side-effect risk.

### 27.7 The worker exists before automation pressure arrives

Future reminders and reconciliation have somewhere appropriate to live.

### 27.8 Specification quality

The codebase has a strong reference model for future contributors.

---

## 28. Current Product Weaknesses

The weaknesses are primarily a consequence of development stage, not poor architecture.

### 28.1 Fitness-domain depth is still absent

No services, schedules, classes, bookings, memberships, payments, or attendance.

### 28.2 Sprint 01 is implemented more than it is proven

Deployment, E2E, backup restore, and production acceptance need evidence.

### 28.3 Staff administration is incomplete

View exists; complete secure management needs closure.

### 28.4 Current dashboard is setup-oriented

It does not yet provide operational business intelligence.

### 28.5 Public/customer experience does not yet exist

There is no tenant timetable, booking flow, payment flow, or member self-service.

---

## 29. Overall Verdict

FITOS is currently a **credible, well-structured SaaS foundation**, not yet a finished fitness platform.

The codebase has already solved several problems that are expensive to retrofit later:

- tenant architecture;
- permissions;
- branch scoping;
- server sessions;
- audit;
- database migrations;
- shared contracts;
- design-system primitives;
- CI;
- Docker;
- worker foundation;
- backup tooling.

That is valuable progress.

However, the repository has not yet crossed the line into the core commercial promise of FITOS.

That line is crossed when a real Nairobi studio can execute this without leaving FITOS:

> A prospect becomes a member, books a real class, consumes a valid entitlement, pays, checks in, and appears correctly in the business records.

Until then, the primary objective should be **operational depth, not feature breadth**.

### Current strategic status

**Architecture:** 🟢 Strong  
**Foundation:** 🟢 Strong  
**Tenant safety:** 🟢 Strong design / 🟡 more proof required  
**CRM:** 🟡 Emerging into usable  
**Fitness operations:** 🔴 Not implemented  
**Payments:** 🔴 Not implemented  
**Pilot readiness:** 🔴 Not ready  
**Development direction:** 🟢 Correct  

### Recommended immediate goal

> **Close Sprint 01 formally, then build Lead → Member → Service → Schedule → Booking as one uninterrupted vertical slice.**

---

## 30. Known Unknowns

This document intentionally does not guess about runtime conditions that were not proven during repository inspection.

The following remain unknown or unverified:

- whether the latest GitHub Actions run is green;
- whether a staging VPS is currently online;
- whether a public HTTPS staging URL exists;
- whether production Docker images have been successfully built from the latest commit;
- whether the deployment script has been executed successfully on a clean server;
- whether an encrypted backup has been created off-server;
- whether a restore drill has been completed;
- whether Auth E2E and Member E2E suites exist outside the inspected paths;
- whether all branch CRUD/deactivate endpoints exactly match the specification;
- whether all staff privilege-escalation cases are tested;
- whether all Drizzle repository paths have cross-tenant integration coverage;
- whether responsive/accessibility acceptance has been manually completed.

Future status documents should turn these unknowns into explicit evidence links.

---

## 31. Source Basis for This Status

This status was produced from the live `main` branch and the repository's current implementation/specification artifacts, including:

```text
PHASE 0 DEVPLAN.md

FITOS_Developer_Guidelines/
├── 00_IMPLEMENTATION_README.md
├── 01_PRODUCT_AND_SCOPE.md
├── 01_REPOSITORY_TREE.md
├── 02_DATABASE_SCHEMA_ERD.md
├── 02_UX_UI_DESIGN_SYSTEM.md
├── 03_API_ENDPOINT_CATALOGUE.md
├── 03_FRONTEND_REACT_ARCHITECTURE.md
├── 04_BACKEND_API_ARCHITECTURE.md
├── 04_FRONTEND_ROUTE_SCREEN_MAP.md
├── 05_DATA_MODEL_MULTI_TENANCY.md
├── 05_SHARED_TYPES_EVENTS_PERMISSIONS.md
├── 06_SPRINT_01_IMPLEMENTATION.md
└── additional implementation/backlog/acceptance documents

package.json
.github/workflows/ci.yml

apps/api/src/app.module.ts
apps/api/src/modules/
apps/api/test/

apps/web/src/app/router.tsx
apps/web/src/app/auth.tsx
apps/web/src/app/shell.tsx
apps/web/src/features/pages.tsx

apps/worker/src/main.ts
apps/worker/src/jobs.ts
apps/worker/src/processors/

packages/database/src/schema.ts
packages/database/src/seed.ts
packages/database/src/migrate.ts
packages/database/src/reset-test.ts
packages/database/src/status.ts

packages/auth/
packages/contracts/
packages/shared/
packages/ui/

compose.yaml
compose.production.yaml

infra/docker/
infra/nginx/
infra/scripts/deploy.sh
infra/scripts/backup-postgres.sh

docs/runbooks/deployment.md
docs/runbooks/restore.md
```

Recent commit history was also reviewed to distinguish current implementation work from older specification-only material.

---

## 32. Maintenance Rule for This Document

`Codebase Status.md` should be updated at each meaningful milestone.

Recommended triggers:

- Sprint close;
- production/staging deployment;
- new domain module lands;
- pilot begins;
- major architecture decision changes;
- security incident or major regression;
- payment integration enabled;
- first design partner goes live.

Each update should include:

```text
Snapshot commit
Date
Milestone
Newly implemented
Newly verified
New risks
Resolved risks
Current blockers
Next three priorities
Pilot readiness
```

This document should remain a **truth document**, not a marketing document.

If a capability is only specified, mark it specified.

If it is coded but untested, mark it coded but unverified.

If it passes CI but has never been used by a pilot, do not call it pilot-proven.

That discipline will keep FITOS development measurable as the system grows.

---

**End of Codebase Status**
