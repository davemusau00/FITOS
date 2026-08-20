# FITOS Developer Instructions: System Build Completion

**Repository:** `davemusau00/FITOS`  
**Completion baseline:** `da9206622c251466f0f2385a09e52f0fe240c87c`  
**Date:** 20 August 2026  
**Purpose:** Finish FITOS from advanced alpha into a deployable, pilot-ready fitness business operating system without destabilizing the architecture or adding unnecessary scope.

---

## 1. Completion Objective

The system already contains the main operating spine:

```text
Lead
→ Member
→ Service
→ Schedule
→ Booking
→ Membership / Credits
→ Payment
→ Attendance
```

The task is no longer to invent major new product areas. The task is to make this entire spine consistent, tenant-safe, transaction-safe, testable, usable through the UI, deployable, recoverable, observable, and ready for a controlled Nairobi design-partner pilot.

The system is "build complete for pilot" only when a real fitness business can operate a normal day without relying on spreadsheets, WhatsApp confirmations, notebooks, or manual reconciliation for supported workflows.

---

## 2. Current System Baseline

At `da92066`, active backend modules include:

```text
Auth
Organizations
Branches
Members
Users / Staff
Audit
Leads
Services
Schedule
Bookings
Memberships
Payments
Attendance
```

The routed operator application includes:

```text
Overview
Schedule
Attendance
Class Roster
Bookings
New Booking
Services
Memberships
Payments
Unmatched Payments
Members
Leads
Staff
Settings
```

The codebase also contains React/Vite, NestJS, PostgreSQL/Drizzle, Redis, BullMQ, opaque server sessions, signed CSRF, tenant-aware repositories, branch access, permissions, idempotency, audit logging, migrations, seeding, Docker, production Compose, Nginx, encrypted backups, deployment/restore runbooks, CI, HTTP security tests, Drizzle tenant tests, booking race tests, and membership-credit integration tests.

**Do not replace this architecture.**

---

## 3. Core Completion Rule

From this point onward:

> **Do not add a new broad product module unless it is required to complete an existing critical workflow.**

The priority is integration depth, not feature breadth.

Defer until after pilot unless proven essential:

- AI assistants
- marketplace
- nutrition
- payroll
- inventory
- advanced workouts
- corporate wellness
- website builders
- gamification
- advanced analytics

---

## 4. Target Pilot Workflow

The following must work end-to-end through the UI and real PostgreSQL:

```text
Create lead
→ add note/task
→ progress lead
→ convert to member
→ create/select service
→ schedule occurrence
→ activate membership
→ confirm credit balance
→ create booking
→ debit entitlement
→ record payment
→ allocate payment
→ check member in
→ update attendance
→ cancel/reschedule where applicable
→ restore credit where policy allows
→ inspect audit history
```

The system must preserve correct state after retries, duplicate submissions, browser refreshes, and concurrent actions.

---

## 5. Phase A: Freeze and Audit the Domain Model

Review:

```text
0001_crm_leads.sql
0002_services_scheduling.sql
0003_bookings.sql
0004_memberships.sql
0005_payments.sql
0006_attendance.sql
```

Confirm:

- all tenant-owned tables have `tenant_id`;
- cross-tenant foreign references are impossible;
- branch ownership is validated;
- financial and credit history is not destructively editable;
- cancellation history is preserved;
- indexes support tenant + branch + status + time queries;
- unique constraints enforce business invariants;
- migrations succeed from an empty database;
- migrations run in CI.

Once staging or pilot data exists, never silently rewrite applied migrations. Add a new migration.

---

## 6. Phase B: Membership and Entitlement Correctness

### Membership plans

Support:

- create/edit;
- activate/deactivate;
- tenant-wide or branch-scoped plans;
- duration;
- credits;
- price;
- public visibility;
- historical plan snapshots.

Editing a plan must never silently alter the historical terms of an already activated membership.

### Credit ledger

The ledger is the source of truth.

Do not use mutable `remainingCredits` as authoritative truth.

Example:

```text
purchase           +10
booking             -1
cancellation        +1
manual_adjustment   +/-N
expiry              -remaining
```

Every manual adjustment must have permission, reason, actor, timestamp, and audit record.

### Booking entitlement rules

Make explicit:

- credits consumed per service;
- services that require no credits;
- whether staff can override;
- override permission and reason;
- cancellation restoration;
- late-cancel behavior;
- no-show behavior;
- insufficient-credit behavior.

These rules belong in backend domain logic, not UI assumptions.

### Required tests

- activation;
- expiry calculation;
- cancellation;
- plan snapshot immutability;
- tenant/branch isolation;
- insufficient credits;
- booking debit;
- cancellation restoration;
- duplicate retry;
- manual adjustment;
- no negative balance unless explicitly allowed;
- concurrent credit use.

---

## 7. Phase C: Payment Ledger Hardening

Current payment methods:

```text
cash
bank_transfer
mpesa
card
other
```

Treat FITOS's internal ledger as primary truth.

Every payment must preserve tenant, branch, minor-unit amount, currency, member if known, method, reference, provider ref, allocation, actor, timestamp, status, and audit history.

Never use floating-point money.

### Define legal status transitions

Current states:

```text
pending
completed
refunded
voided
```

Do not allow arbitrary status mutation.

### Allocation rules

Supported allocations:

```text
membership
booking
walkIn
other
```

Verify:

- target belongs to same tenant;
- branch relationship is valid;
- double allocation cannot occur silently;
- refund/void updates financial truth correctly;
- unmatched payments remain visible;
- reconciliation is audited.

### Unmatched payments

Required flow:

```text
payment exists
→ member/allocation unknown
→ appears in Unmatched Payments
→ staff matches to member/booking/membership
→ reconciliation audited
```

---

## 8. Phase D: Real M-Pesa Integration

Live M-Pesa must sit behind a provider adapter.

Suggested port:

```text
PaymentProvider
├── requestCollection()
├── verifyCallback()
├── parseCallback()
├── queryTransaction()
└── normalizeProviderStatus()
```

The core payment domain must not depend directly on Safaricom response shapes.

### STK Push

```text
Create payment intent
→ request STK
→ persist provider request IDs
→ show pending
→ receive callback
→ validate callback
→ idempotently apply provider result
→ reconcile member/booking/membership
→ mark completed/failed
→ issue receipt/event
```

### Callback requirements

Callbacks must be:

- idempotent;
- safe under duplicate delivery;
- independent of browser state;
- validated;
- replay-testable;
- safe from secret leakage;
- capable of creating unmatched transactions.

### M-Pesa tests

Use provider fakes/fixtures for CI.

Cover:

- success;
- cancellation;
- timeout;
- duplicate callback;
- callback arriving before UI polling;
- unknown provider ID;
- amount mismatch;
- reconciliation failure;
- retry after provider failure.

---

## 9. Phase E: Attendance and Reception Completion

Current statuses:

```text
booked
checked_in
attended
no_show
late_cancel
```

Define allowed transitions explicitly.

Check-in must:

- be tenant and branch scoped;
- be idempotent;
- prevent duplicates;
- optionally link to occurrence;
- verify entitlement/policy;
- allow authorized override;
- require override reason;
- audit override.

The roster should show booked, checked-in, no-show, capacity, remaining slots, and relevant entitlement/payment warnings.

Reception target:

```text
Search name/phone
→ open member
→ see entitlement
→ check in
```

with minimal clicks.

---

## 10. Phase F: Scheduling and Booking Completion

### Recurring schedules

Implement:

- recurrence template;
- weekly recurrence;
- trainer;
- room;
- branch;
- service;
- capacity;
- effective start/end;
- exceptions;
- one-off override.

Materialize occurrences for a bounded future window.

### Conflicts

Prevent overlap for:

- rooms;
- trainers;
- modeled resources.

### Booking policies

Support a simple backend policy model for:

- booking open/close windows;
- cancellation cutoff;
- late cancellation;
- staff override;
- membership eligibility;
- waitlist later.

Do not add waitlist until normal booking is stable.

---

## 11. Phase G: Operator UX Completion

Keep the new domain feature split:

```text
features/
├── attendance/
├── auth/
├── bookings/
├── leads/
├── members/
├── memberships/
├── onboarding/
├── overview/
├── payments/
├── schedule/
├── services/
├── settings/
├── staff/
└── shared/
```

Every main page must have:

- loading;
- error;
- empty;
- permission-aware actions;
- responsive behavior;
- keyboard accessibility;
- confirmations for high-impact actions;
- useful success feedback.

### Member profile

Make it the operational hub with:

- overview;
- memberships;
- credits;
- bookings;
- payments;
- attendance;
- activity/audit.

---

## 12. Phase H: Public Booking and Member Self-Service

Do only after operator workflows are stable.

### Public booking MVP

```text
Tenant public page
→ choose branch
→ view schedule
→ choose occurrence
→ identify/create prospect/member
→ use entitlement or pay
→ confirm booking
```

Use tenant slug/domain context, not exposed internal tenant IDs.

### Member portal MVP

Support:

- upcoming bookings;
- cancel/reschedule;
- membership;
- credits;
- receipts/payment history;
- attendance history;
- profile basics.

Prefer responsive web/PWA over native apps for pilot.

---

## 13. Phase I: Worker and Automation

Use BullMQ for:

- booking confirmations;
- reminders;
- cancellations;
- membership expiry reminders;
- receipts;
- unmatched payment alerts;
- M-Pesa reconciliation retries;
- waitlist promotion later.

Every job must be typed, idempotent, retryable, tenant-scoped, observable, and bounded by max attempts.

Database remains source of truth.

---

## 14. Phase J: Minimum Reporting

Pilot dashboard should answer:

### Today

- revenue;
- payments needing attention;
- check-ins;
- upcoming classes;
- near-capacity classes;
- leads needing follow-up;
- expiring memberships.

### Period

- revenue trend;
- member growth;
- bookings;
- attendance rate;
- occupancy;
- lead conversion;
- renewals.

All reporting must be tenant scoped and branch filterable.

---

## 15. Phase K: Security Hardening

Before pilot verify:

- Secure/HttpOnly/SameSite cookies;
- session expiry/revocation/logout;
- CSRF;
- rate limiting behind proxy;
- generic login errors;
- least privilege;
- owner/manager/reception/trainer/finance boundaries;
- privilege escalation protection;
- final-owner lockout protection.

Audit:

- role/branch access changes;
- membership changes;
- credit adjustments;
- booking overrides/cancellations;
- payment record/void/refund/reconciliation;
- attendance overrides;
- critical settings changes.

---

## 16. Mandatory Cross-Tenant Matrix

For every tenant-owned resource:

```text
Tenant A creates resource
Tenant B knows exact UUID
Tenant B GET → non-leaking denial
Tenant B mutation → denied
```

Apply to:

- leads;
- members;
- services;
- rooms;
- occurrences;
- bookings;
- membership plans;
- memberships;
- credit ledger;
- payments;
- attendance.

Use both HTTP and Drizzle/PostgreSQL tests for critical records.

---

## 17. Mandatory PostgreSQL Concurrency Tests

### Booking

```text
1 remaining slot
2 concurrent booking transactions
→ exactly one succeeds
```

### Credits

```text
1 remaining credit
2 concurrent credit-consuming bookings
→ no negative balance
```

### Payments

```text
duplicate provider callback
→ one financial effect
```

### Attendance

```text
duplicate check-in
→ one attendance effect
```

---

## 18. Browser E2E

Add or complete Playwright-style browser journeys.

Required:

1. Lead create → note/task → convert → member.
2. Service create → schedule occurrence.
3. Membership activate → booking → debit → cancel → restore.
4. Record/allocate payment.
5. Roster → check in.
6. Reception role attempts restricted finance/admin action → blocked.

---

## 19. CI Release Gate

A release candidate must fail on any failure in:

```text
npm ci
format
lint
typecheck
migrations from empty DB
seed
unit tests
integration tests
DB tenancy tests
HTTP security tests
browser E2E
build
production Compose validation
dependency audit
secret scan
```

Do not let `--passWithNoTests` hide a required empty test category.

---

## 20. Deployment and Staging

Before pilot:

1. provision clean production-like staging;
2. use production Compose;
3. private Postgres/Redis networking;
4. HTTPS through Nginx;
5. externalized secrets;
6. migrations;
7. readiness checks;
8. worker verification;
9. smoke tests;
10. log verification;
11. backup job verification.

Do not claim deployability until this works from a clean environment.

---

## 21. Backup and Restore Proof

Backup:

- encrypted;
- off-server copy;
- retention;
- visible failures.

Restore into clean PostgreSQL and verify:

```text
tenant
member
booking
membership
credits
payment
attendance
```

Record RTO and result.

No pilot release without one successful restore drill.

---

## 22. Observability

Minimum:

- request IDs;
- structured API logs;
- structured worker logs;
- health/readiness;
- failed-job visibility;
- deployed commit SHA;
- error-rate visibility;
- backup status;
- disk/CPU/memory monitoring.

Never log passwords, session tokens, secrets, or unnecessary PII.

---

## 23. Data Protection

Before real members:

- document data collected and purpose;
- least-privilege access;
- retention rules;
- export process;
- deletion/anonymization rules where appropriate;
- encrypted backups;
- minimized PII in logs;
- basic breach-response process.

Do not casually add medical-condition fields.

---

## 24. Pilot Demo Tenant

Create a polished demo fitness business with:

- realistic Kenyan demo members;
- services;
- rooms;
- plans;
- one week of schedule;
- bookings;
- payments;
- attendance history.

Never seed real customer data.

---

## 25. Final Pilot Acceptance Script

A human must complete without DB edits/API clients:

```text
1. Login
2. Create branch
3. Review staff access
4. Create lead
5. Add note/task
6. Convert lead
7. Create service
8. Create room
9. Schedule class
10. Create membership plan
11. Activate membership
12. Confirm credits
13. Book member
14. Confirm capacity reduced
15. Confirm credit debited
16. Record payment
17. Allocate payment
18. Open roster
19. Check member in
20. Confirm attendance
21. Cancel another booking
22. Confirm credit restoration
23. Review member history
24. Review audit
25. Sign out
```

Repeat critical actions with a second tenant and prove no leakage.

---

## 26. Non-Negotiable Engineering Rules

- Never trust client-provided tenant identity.
- Never use floating-point money.
- Never silently overwrite financial or entitlement history.
- Never rely on UI hiding for authorization.
- Never enforce booking capacity only in application memory.
- Never make provider callbacks non-idempotent.
- Never make AI the source of truth for money, credits, bookings, memberships, or attendance.
- Never expand scope just because a module is easy to add.

---

## 27. Refactoring Boundaries

Do not rewrite the system.

As `CoreService` grows, split internally when useful:

```text
LeadService
MemberService
ServiceCatalogService
SchedulingService
BookingService
MembershipService
PaymentService
AttendanceService
```

Likewise consider domain repository boundaries.

Keep the modular monolith. Do not create network microservices for pilot.

---

## 28. Completion Priority Order

### P0 Integrity

1. migration audit;
2. tenant isolation expansion;
3. membership/credit invariants;
4. payment invariants;
5. DB booking concurrency;
6. DB credit concurrency;
7. attendance idempotency;
8. privilege tests.

### P0 Usability

9. member-profile integration;
10. service/schedule/booking UX;
11. membership UX;
12. payment reconciliation UX;
13. attendance/front-desk UX.

### P1 Production proof

14. browser E2E;
15. CI gates;
16. staging;
17. backup;
18. restore drill;
19. observability.

### P1 Kenya payments

20. Daraja adapter;
21. STK Push;
22. callback;
23. reconciliation;
24. receipt/event.

### P2 Customer self-service

25. public schedule;
26. public booking;
27. member portal.

### P3 Pilot optimization

28. reminders;
29. waitlist;
30. minimum reporting.

---

## 29. Definition of Pilot-Ready

- [ ] Full operating river works in browser
- [ ] PostgreSQL is authoritative
- [ ] No known tenant leakage
- [ ] Booking concurrency proven
- [ ] Credit concurrency proven
- [ ] Payment ledger auditable
- [ ] Unmatched payments reconcilable
- [ ] M-Pesa callbacks idempotent if enabled
- [ ] Attendance reliable
- [ ] Permission escalation tests pass
- [ ] CI passes
- [ ] Staging works
- [ ] Production images build cleanly
- [ ] Encrypted backup works
- [ ] Restore drill passes
- [ ] Failures are observable
- [ ] Demo tenant works
- [ ] Pilot acceptance script passes
- [ ] Release commit is tagged

---

## 30. Definition of System Build Completion

For the current FITOS MVP, "system build complete" means:

> A fitness business can acquire a prospect, convert them into a member, sell/activate an entitlement, schedule services, accept bookings, record/reconcile payment, check the member in, preserve correct history, and operate these actions securely across branches and staff roles in a deployed and recoverable system.

It does not mean every long-term FITOS idea has shipped.

---

## 31. Current Developer Directive

**Stop optimizing for module count.**

Optimize for:

```text
correctness
→ integration
→ operator speed
→ security
→ recovery
→ real payment behavior
→ pilot proof
```

The highest-value engineering work is making:

> **Lead → Member → Book → Entitle → Pay → Attend**

behave as one coherent, transaction-safe product.

---

**Baseline:** `da9206622c251466f0f2385a09e52f0fe240c87c`  
**Instruction status:** Active completion brief
