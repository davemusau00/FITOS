# FITOS Implementation Roadmap and Acceptance Criteria

## Guiding Rule

Build vertical slices that a real studio can use.

Do not spend months constructing invisible infrastructure without proving booking, membership, payment and front-desk workflows.

---

# Phase 0 — Foundation

## Deliver
- monorepo
- React app shell
- NestJS API shell
- PostgreSQL
- migration framework
- Redis
- Docker Compose
- auth
- tenant/branch
- CI
- design tokens
- UI package
- logs/request IDs
- health checks

## Acceptance
- local stack starts from documented command
- developer can create tenant
- owner can sign in
- tenant A cannot access tenant B
- CI builds both apps
- deploys to staging VPS
- HTTPS works
- backup job exists

---

# Phase 1 — CRM + Members

## Deliver
- contacts
- leads
- stages
- member conversion
- member list/detail
- phone normalization
- notes
- role permissions
- search
- basic import

## Acceptance
- reception can find member in seconds
- lead converts without duplicate contact
- permission-limited user cannot access forbidden fields
- import provides validation report
- cross-tenant tests pass

---

# Phase 2 — Services + Scheduling

## Deliver
- service catalog
- trainers
- rooms/resources
- recurring schedules
- occurrences
- calendar
- conflict checks

## Acceptance
- business can build a week of classes
- edit-one vs edit-future works
- trainer collision blocked/warned according to rules
- timezone preserved

---

# Phase 3 — Booking

## Deliver
- staff booking
- public booking
- capacity
- cancel/reschedule
- status events
- booking policy
- notification event

## Acceptance
- final-slot concurrent test allows exactly one reservation
- public customer can book on mobile
- staff can cancel with reason
- no tenant data exposed publicly
- failed notification does not undo valid booking

---

# Phase 4 — Memberships + Credits

## Deliver
- plans
- member memberships
- session packs
- entitlements
- credit ledger
- expiration
- renewal workflow

## Acceptance
- correct credit consumed
- cancellation policy correctly restores or retains credit
- historical package purchase remains auditable
- expired membership fails protected booking
- authorized override is auditable

---

# Phase 5 — Payments

## Deliver
- payment intents
- cash/manual
- provider adapter
- M-Pesa integration
- callback processing
- matching
- allocations
- receipts
- payment report

## Acceptance
- duplicate callback does not duplicate money
- initiated != paid
- payment can remain unmatched
- matching action is audited
- reports reconcile to successful transactions and refunds

---

# Phase 6 — Attendance + Front Desk

## Deliver
- reception mode
- check-in
- roster
- attendance states
- QR-ready member pass

## Acceptance
- member check-in is fast
- duplicate accidental check-in prevented
- override requires permission
- class attendance report agrees with roster events

---

# Phase 7 — Automation

## Deliver
- queue worker
- templates
- booking confirmation
- reminder
- membership expiry
- payment receipt
- retry/dead-letter visibility

## Acceptance
- retry does not duplicate messages beyond defined provider behavior
- failed jobs are visible
- marketing consent is independent from transactional notification

---

# Phase 8 — Reporting + Dashboard

## Deliver
- owner dashboard
- revenue report
- membership report
- occupancy
- attendance
- lead funnel
- exports

## Acceptance
- each KPI has documented formula
- date/branch scope visible
- export matches filtered result
- finance data permission enforced

---

# Phase 9 — Tenant Website

## Deliver
- public profile
- services
- trainers
- timetable
- memberships
- booking CTA
- tenant brand settings

## Acceptance
- tenant changes branding without developer
- public content is performant on mobile
- booking deep links work
- tenant resolution secure

---

# Phase 10 — Production Pilot

## Select
3 Nairobi design-partner businesses with different operating models.

Suggested archetypes:
- boutique Pilates studio
- conventional gym
- hybrid wellness/fitness facility

## Pilot Procedure
- migrate real sample data
- train owner
- train reception
- operate parallel for limited period if necessary
- collect workflow friction
- fix P0/P1 immediately
- record feature requests separately from blockers

## Pilot Success
- daily bookings handled
- payments reconciled
- attendance used
- staff can operate without developer presence
- owner trusts reports
- no tenant/security incident
- backup restored successfully during pilot window

---

# Release Acceptance Matrix

Every production feature requires:

| Area | Requirement |
|---|---|
| UX | desktop/mobile states |
| Accessibility | keyboard + labels |
| API | documented contract |
| Auth | server-side permissions |
| Tenancy | isolation tests |
| Data | migration reviewed |
| Audit | privileged action captured |
| Test | domain + integration coverage |
| Failure | integration/error state |
| Observability | logs/metrics |
| Security | relevant threat checks |
| Docs | updated |
