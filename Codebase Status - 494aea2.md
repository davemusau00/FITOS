# FITOS Codebase Status

**Repository:** `davemusau00/FITOS`  
**Branch reviewed:** `main`  
**Snapshot commit:** `494aea2ab7a570ba15e0ada5e656aa82b7b25a00`  
**Snapshot date:** 20 August 2026  
**Previous snapshot:** `8eec3e4e6ad4b9c2600062b94ddb03a51ebdeb75`  
**Commits since previous snapshot:** 9  
**Current stage:** Foundation + CRM + early fitness operations

---

## Executive Summary

FITOS has materially advanced since the previous status snapshot. The repository is no longer only a multi-tenant CRM foundation. At `494aea2`, it contains the beginnings of the actual fitness-business operating engine.

The implemented operational path now reaches:

> **Lead → Follow-up → Member → Service → Schedule → Booking**

New work includes tenant-safe leads, notes/tasks, lead conversion, services, rooms/resources, schedule occurrences, room/trainer conflict checks, bookings, booking cancellation, booking idempotency, booking-capacity protection, membership schema/contracts, database-backed tenant tests, HTTP security tests, and stronger CI.

The commercial loop is still incomplete:

> **Booking → Membership entitlement → Payment → Attendance → Renewal**

Membership foundations exist, but no registered MembershipsController or routed membership UI was observed at this snapshot. Payments, M-Pesa, attendance, public booking, and member self-service remain incomplete.

---

## Readiness Scores

| Capability | Estimate |
|---|---:|
| Architecture/Foundation | 90–95% |
| Authentication/Security spine | 90% |
| Core Member CRM | 75–80% |
| Lead CRM | 65–75% |
| Services | 55–65% |
| Scheduling | 50–60% |
| Booking | 50–60% |
| Membership | 25–35% |
| Payments | 0–5% |
| Attendance | 0–5% |
| Automation | 10–15% |
| Reporting | ~10% |
| Public booking | 0–5% |
| Sellable MVP | 35–40% |
| Pilot readiness | ~35% |

These are engineering/product estimates, not GitHub-generated metrics.

---

## Backend Module Map

Registered NestJS controllers now include:

```text
HealthController
AuthController
OrganizationsController
BranchesController
MembersController
UsersController
AuditController
LeadsController
ServicesController
ScheduleController
BookingsController
```

Common infrastructure remains strong:

- server-side session guard;
- permission/capability guard;
- request actor and tenant context;
- request IDs;
- rate limiting;
- idempotency;
- structured errors and logging;
- in-memory repository;
- Drizzle/PostgreSQL repository;
- audit events and domain-event publication.

**Verdict:** the modular-monolith architecture remains appropriate. No microservice split is justified.

---

## Frontend Status

Current routed surfaces:

```text
/login

/app
├── /overview
├── /members
├── /members/new
├── /members/:memberId
├── /leads
├── /leads/new
├── /staff
├── /settings
├── /settings/organization
├── /settings/branches
├── /settings/branches/new
├── /settings/team
└── /settings/security

/onboarding
```

New since the previous snapshot:

```text
/app/leads
/app/leads/new
```

Not yet routed:

```text
/services
/schedule or /calendar
/bookings
/memberships
/payments
/attendance
```

### Key conclusion

The backend is now materially ahead of the operator-facing frontend. The next major product milestone should be UI catch-up rather than another broad backend domain.

---

## Lead CRM

Lead management is now first-class.

Implemented:

- lead creation;
- lead listing/detail;
- stage management;
- lost-reason validation;
- notes;
- tasks;
- source tracking;
- tenant-safe access;
- lead-to-member conversion;
- repeat-conversion safety;
- contact reuse during conversion;
- Leads and New Lead pages.

A converted lead reuses the same underlying contact record instead of creating duplicate identity.

**Status: ✅ Core implemented and tested**

Remaining:

- richer lead-detail UX;
- assignee/task scheduling UX;
- pipeline view if useful;
- trial booking linkage;
- automated follow-ups;
- conversion analytics.

---

## Services

Current service types:

```text
class
appointment
facility
access
```

Service contracts support:

- tenant and optional branch scope;
- name/slug;
- service type;
- duration;
- default capacity;
- price;
- public visibility;
- active status.

Backend behavior includes list/get/create/update, branch validation, duplicate-slug handling, audit, and events.

**Status: ✅ Backend core implemented**

Remaining:

- operator UI;
- service-specific booking/cancellation policies;
- membership-entitlement rules;
- public descriptions/media;
- reporting.

---

## Rooms and Resources

Current resource foundation supports:

- tenant;
- branch;
- name;
- optional capacity;
- active status;
- schedule assignment.

**Status: ✅ Backend core implemented**

Future resource specialization should be driven by pilot needs, e.g. reformers, courts, treatment stations, lanes, or equipment pools.

---

## Scheduling

Schedule occurrences now contain:

- tenant;
- branch;
- service;
- optional trainer;
- optional room;
- start/end;
- capacity;
- status.

Current statuses:

```text
scheduled
cancelled
```

Backend behavior includes:

- list/filter;
- get;
- create;
- cancel;
- branch-access checks;
- service/branch compatibility;
- room validation;
- trainer/branch validation;
- conflict handling;
- audit/events.

HTTP tests verify conflicting resource schedules are rejected.

**Status: ✅ Backend core implemented**

Remaining:

- recurring templates;
- recurrence materialization;
- exceptions;
- trainer availability;
- closures/holidays;
- rescheduling;
- operator calendar UI;
- occupancy visualization.

---

## Bookings

Current booking statuses:

```text
confirmed
cancelled
```

Current booking sources:

```text
staff
public
member_portal
```

Observed endpoints:

```text
GET  /bookings
POST /bookings
GET  /bookings/:bookingId
POST /bookings/:bookingId/cancel
```

Booking creation includes:

- permission enforcement;
- member validation;
- occurrence validation;
- idempotency;
- capacity enforcement;
- duplicate prevention;
- audit trail;
- domain events.

Cancellation records a reason and persistent cancellation history while reopening capacity.

**Status: ✅ Backend core implemented**

---

## Critical Booking Concurrency Test

The critical final-slot race test now exists.

Scenario:

1. create a class with capacity 1;
2. create two members;
3. fire two booking requests concurrently;
4. expect exactly one success and one conflict;
5. reject duplicates;
6. cancel the successful booking;
7. preserve cancellation history;
8. allow another member to take the released slot.

Expected statuses:

```text
[201, 409]
```

**Status: ✅ Implemented and tested at HTTP boundary**

Still required before public booking:

- equivalent concurrency proof against real PostgreSQL.

---

## Membership Foundations

Membership work has started but is not end-to-end.

Current membership statuses:

```text
scheduled
active
paused
expired
cancelled
exhausted
```

Credit reasons:

```text
purchase
booking
cancellation
manual_adjustment
expiry
```

Contracts include:

- plans;
- branch scope;
- price;
- duration;
- included credits;
- public visibility;
- member membership;
- plan snapshot;
- credit ledger entries;
- booking-linked credit movements.

Migration present:

```text
0004_memberships.sql
```

However, no registered `MembershipsController` or routed membership UI was observed.

**Status breakdown:**

- schema: ✅
- contracts: ✅
- repository/core groundwork: 🟡
- API surface: 🟡
- operator UI: ⛔
- booking entitlement enforcement: incomplete

**Overall: 🟡 Foundation implemented**

---

## Database and Migrations

Current migration chain:

```text
0000_foundation.sql
0001_crm_leads.sql
0002_services_scheduling.sql
0003_bookings.sql
0004_memberships.sql
```

This is healthy vertical-slice migration discipline.

---

## Tenant Safety

Tenant-isolation controls now include:

- tenant context from authenticated server session;
- mandatory repository scope;
- branch access lists;
- tenant-aware constraints;
- permission guards;
- audit history;
- in-memory tenancy tests;
- HTTP cross-tenant tests;
- Drizzle/PostgreSQL tenancy tests.

Database-backed tests now cover member isolation, invalid cross-tenant branch references, lead isolation, contact reuse, and repeated conversion.

**Status: ✅ Strong for current stage**

Every new tenant-owned domain should continue shipping the regression:

```text
Tenant A creates resource
→ Tenant B knows UUID
→ read rejected
→ mutation rejected
```

---

## Security and HTTP Tests

The new HTTP suite covers:

- unauthenticated requests;
- request IDs;
- CSRF enforcement;
- idempotent writes;
- cross-tenant member access;
- lead creation/staging/notes/tasks/conversion;
- service creation;
- room creation;
- schedule conflict;
- occurrence cancellation;
- booking capacity race;
- duplicate booking;
- booking cancellation.

**Status: ✅ Major improvement**

Remaining:

- full browser E2E;
- membership tests;
- Postgres booking concurrency;
- staff privilege/final-owner tests.

---

## CI

CI now provisions:

- PostgreSQL 18;
- Redis 8;
- Node 24.

Important environment:

```text
FITOS_REPOSITORY=drizzle
RUN_DATABASE_TESTS=true
```

Current flow:

```text
npm ci
format check
lint
typecheck
migrate
seed
tests
build
production Compose validation
dependency audit
secret scan
```

Production Compose validation:

```text
docker compose -f compose.yaml -f compose.production.yaml config --quiet
```

**Status: ✅ CI definition strong**

The combined-status API returned no statuses for `494aea2`, so latest green CI remains **unverified**.

---

## Operational Architecture

```text
Authentication
      ↓
Tenant Context
      ↓
Branches / Staff / Audit
      ↓
Contacts
      ↓
Leads
      ↓
Members
      ↓
Services
      ↓
Rooms / Trainers
      ↓
Schedule
      ↓
Bookings
      ↓
Memberships       ← foundation
      ↓
Payments          ← not implemented
      ↓
Attendance        ← not implemented
```

---

## Revised MVP Loop

```text
Lead          ✅
Member        ✅
Service       ✅ backend
Schedule      ✅ backend
Book          ✅ backend
Entitlement   🟡 foundation
Pay           ⛔
Attend        ⛔
Renew         ⛔
```

**Sellable MVP readiness: 35–40%**

---

## Immediate Priority 1: Operator UX Catch-up

Build:

1. Services list/create/edit;
2. Rooms/resources;
3. Calendar/Schedule;
4. occurrence create/cancel;
5. booking list;
6. booking create;
7. booking cancellation;
8. roster/capacity display.

Exit criterion:

```text
Create service
→ schedule class
→ find member
→ book member
→ capacity changes
→ cancel booking
→ slot reopens
```

all from the UI.

---

## Immediate Priority 2: Membership Entitlements

Complete:

- MembershipsController;
- plan CRUD;
- membership activation;
- status transitions;
- immutable credit ledger;
- booking debit;
- cancellation credit restoration;
- expiry;
- manual adjustment with reason/permission;
- tenant tests;
- audit;
- operator UI;
- member-profile integration.

**Design rule:** do not use only mutable `remainingCredits` as financial/entitlement truth. Derive balance from ledger movements.

---

## Immediate Priority 3: FITOS Pay

Recommended order:

1. payment intent;
2. cash;
3. bank;
4. allocation;
5. receipts;
6. unmatched payments;
7. reconciliation;
8. refunds;
9. idempotent callbacks;
10. M-Pesa after internal payment truth is stable.

---

## Immediate Priority 4: Attendance

Build:

- member search;
- entitlement verification;
- class roster;
- check-in;
- duplicate prevention;
- no-show;
- reasoned overrides;
- QR-ready member identity;
- attendance audit;
- branch-aware reception mode.

---

## Main Risks

### Feature velocity outrunning acceptance
Feature growth is fast. Staging, restore, operator UX, and deployment proof must keep pace.

### Backend outrunning frontend
The largest immediate product imbalance.

### Membership truth complexity
Credits, expiry, cancellation, and manual adjustment need ledger semantics and transactions.

### Booking DB concurrency
HTTP coverage is strong, but real PostgreSQL concurrency proof is still needed.

### Tenant isolation regression
Every domain table adds leakage risk.

### GitHub execution tracking
No open issues or PRs were returned during the review, so implementation velocity is not represented by an active execution board.

### Operational proof
Staging, backup execution, restore drill, and release-tag evidence remain incomplete.

---

## Technical Debt

### Large `pages.tsx`
Split frontend by domain before adding Services/Schedule/Bookings UI.

Suggested:

```text
features/
├── overview/
├── members/
├── leads/
├── services/
├── schedule/
├── bookings/
├── memberships/
├── staff/
├── settings/
└── shared/
```

### Growing `CoreService`
Consider eventual domain services:

```text
MemberService
LeadService
ServiceCatalogService
SchedulingService
BookingService
MembershipService
```

This is an internal modularity refactor, not a microservice move.

### Growing repositories
Domain-specific repository interfaces may become useful before payments and attendance arrive.

---

## Recommended Milestones

```text
M01 — Foundation & Tenant Core
M02 — CRM & Leads
M03 — Services & Scheduling
M04 — Booking
M05 — Memberships & Credits
M06 — FITOS Pay
M07 — Attendance
M08 — Automation
M09 — Reporting & Public Site
M10 — Nairobi Pilot
```

| Milestone | Status |
|---|---|
| M01 | 🟢 implementation strong / operational closure pending |
| M02 | 🟢 core implemented |
| M03 | 🟡 backend implemented, UI incomplete |
| M04 | 🟡 backend implemented/tested, UI incomplete |
| M05 | 🟡 foundation |
| M06 | 🔴 not started |
| M07 | 🔴 not started |
| M08 | 🟡 worker foundation |
| M09 | 🔴 mostly not started |
| M10 | 🔴 not ready |

---

## Pilot Readiness

Do not begin a real daily-operation pilot until this works:

```text
Lead
→ Member
→ Service
→ Schedule
→ Booking
→ Membership entitlement
→ Payment
→ Attendance
```

Minimum gates:

- tenant isolation;
- green CI;
- deployed environment;
- successful restore drill;
- booking concurrency against real DB;
- membership ledger;
- payment reconciliation;
- attendance;
- staff permissions;
- audit history;
- basic operational reporting;
- rollback/support procedure.

**Current pilot readiness: ~35%**

---

## Known Unknowns

Not yet proven:

- latest CI green;
- staging online;
- HTTPS staging end to end;
- clean production image build at this exact commit;
- real encrypted backup created;
- restore drill succeeded;
- Postgres booking concurrency;
- full browser E2E;
- staff-access acceptance;
- branch update/deactivate acceptance;
- complete accessibility QA.

---

## Final Verdict

FITOS at `494aea2` is a **credible multi-tenant fitness SaaS alpha backend with a real CRM and emerging booking engine**.

The project has crossed from:

> application foundation

into:

> **Lead → Member → Service → Schedule → Booking**

The strongest technical achievement is that booking is already being treated as an idempotent, auditable, tenant-scoped, concurrency-sensitive domain.

The next move should not be another large backend feature burst. It should be:

1. operator UI for Services/Scheduling/Bookings;
2. complete membership entitlements;
3. staging/restore/CI operational proof;
4. payment truth;
5. attendance.

Once FITOS can reliably execute:

> **Lead → Member → Book → Entitle → Pay → Attend**

on a deployed environment, it will be in genuine design-partner territory.

### Snapshot Scorecard

**Architecture:** 🟢 Strong  
**Security/Tenancy:** 🟢 Strong for stage  
**CRM:** 🟢 Strong early core  
**Services:** 🟡 Backend ready, UX pending  
**Scheduling:** 🟡 Backend ready, UX pending  
**Booking:** 🟡 Strong backend core, UX/DB concurrency proof pending  
**Memberships:** 🟠 Foundation only  
**Payments:** 🔴 Not started  
**Attendance:** 🔴 Not started  
**Operational deployment proof:** 🟠 Incomplete  
**Sellable MVP readiness:** **35–40%**  
**Pilot readiness:** **~35%**  
**Direction:** 🟢 Correct

---

**End of `494aea2` Codebase Status Snapshot**
