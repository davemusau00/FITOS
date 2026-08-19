# FITOS Full-System Build Plan

## Summary

Build FITOS as a greenfield npm-workspaces modular monolith: React/Vite admin and public web surfaces, NestJS REST API, separate BullMQ worker, PostgreSQL, Redis, Docker Compose, and Nginx on a Linux VPS. Deliver vertical, tenant-safe operational slices through a three-business Nairobi pilot, then extend into advanced operations and read-only intelligence.

## Architecture and Public Contracts

- Create `apps/web`, `apps/api`, `apps/worker`, plus `ui`, `contracts`, `database`, `shared`, `auth`, `config`, and `testing` packages. Use strict TypeScript, Drizzle migrations/querying, PostgreSQL UUIDs/timestamps, and `BIGINT` minor-unit money serialized as strings.
- Expose versioned REST at `/api/v1`; maintain OpenAPI and typed contract generation. Standardize error envelopes, cursor pagination, `Idempotency-Key`, request IDs, domain events, and capability-based permissions.
- Authenticate with opaque, secure HttpOnly cookie sessions; resolve tenant, branch access, capabilities, selected branch, and request ID server-side on every request. Operator-provision tenants and initial owners; owners complete authenticated onboarding.
- Enforce shared-schema tenant isolation through mandatory `tenant_id`, tenant-scoped repositories/unit-of-work APIs, composite constraints, authorization policies, audit events, and automated cross-tenant tests. Defer PostgreSQL RLS to a post-pilot defense-in-depth review.
- Keep integrations behind ports: payment, messaging, and file storage adapters. Use local fake providers and storage in development; support manual cash/bank payments first, with M-Pesa enabled only for pilots that supply an approved provider contract and credentials.

## Delivery Roadmap

1. **Foundation and Sprint 01 spine** — Bootstrap the monorepo, Docker dependencies, CI, staging VPS, design tokens/UI primitives, health checks, structured logs, backups, and restore drill. Implement authentication, organization/branch setup, roles, staff branch access, audit logging, and member CRUD/search/detail. This maps the documented Sprint 01 across Foundation and CRM work.

2. **CRM, leads, and member operations** — Add contacts as the identity layer, lead pipeline/tasks/notes/source tracking, duplicate-safe conversion to members, imports with dry-run and validation reports, exports with permissions and CSV-injection protection.

3. **Services and scheduling** — Deliver services, trainers, rooms/resources, recurring templates, materialized occurrences, exception handling, timezone-safe calendar views, and trainer/resource/closure conflict rules. Never mutate historical schedule occurrences.

4. **Bookings** — Build staff and public booking flows, policy validation, capacity-safe transactions, cancel/reschedule audit history, notifications after commit, and optional waitlists. The final-slot concurrency test must prove exactly one reservation succeeds.

5. **Memberships and credits** — Implement plans, entitlement rules, member membership snapshots, session packs, immutable credit-ledger movements, expiry, renewals, cancellation handling, and authorized overrides.

6. **Payments** — Release manual cash/bank recording, intents, allocations, receipts, refunds, unmatched-payment reconciliation, and financial audit/reporting first. Retain the fake M-Pesa adapter; enable live provider integration per pilot tenant only after webhook authenticity, duplicate-event, amount/currency/reference, and reconciliation tests pass.

7. **Attendance and front desk** — Deliver fast reception search/scan/check-in, class rosters, no-show/attendance states, duplicate prevention, permissioned overrides with reasons, and QR-ready member passes.

8. **Automation** — Activate BullMQ processors for transactional notifications, reminders, expiry workflows, receipts, imports, exports, payment reconciliation, retries, and dead-letter visibility. Keep marketing consent distinct from transactional communication consent.

9. **Reporting, dashboard, public site, and member portal** — Add role-aware owner/reception/trainer dashboards, tenant- and branch-scoped reports with defined KPI formulas, asynchronous exports, tenant branding, public timetable/service/membership pages, public booking, and member self-service for bookings, memberships, payments, and profile. Keep the first public experience SPA/static with core metadata; evaluate SSR only when measured SEO needs justify it.

10. **Production pilot** — Run three Nairobi design partners across distinct operating models. Migrate sanitized real data, train owners and reception, run controlled parallel operations where necessary, resolve all P0/P1 issues, verify daily bookings/payments/attendance/report trust, and complete a restore drill.

11. **Advanced operations** — After pilot stability, add the documented modules in order: membership freeze/upgrade/downgrade and family/group plans; multi-branch depth and corporate plans; commissions; POS/inventory; then access-control hardware adapters. Each starts with a product-rule specification and security/financial review before implementation.

12. **Intelligence** — Build trusted analytical datasets and read-only churn, capacity, class-performance, and lead-follow-up signals. Add a natural-language operational assistant only after data quality is proven; it must never autonomously mutate financial, membership, or attendance truth.

## Quality, Security, and Operations Gates

- Require PR checks: deterministic install, formatting, linting, typecheck, unit/integration/E2E tests, clean-database migrations, web/API/worker builds, dependency scan, and secret scan.
- Cover every release with tenant isolation, authorization, session, money, payment webhook/replay, booking/credit concurrency, migration, accessibility, responsive visual, and API-contract tests.
- Deploy through staging to a single hardened VPS with private PostgreSQL/Redis, Nginx TLS/security headers, immutable tagged images, explicit reviewed migrations, readiness checks, monitoring, encrypted off-VPS backups, and quarterly restore drills.
- Block release on tenant leakage, auth/permission regressions, payment corruption, booking/membership failure, failed backups, critical accessibility regressions, or unresolved high-severity security findings.

## Assumptions and Defaults

- Initial provisioning is operator-managed; public self-service signup and a platform-admin control plane are later products.
- Drizzle is the PostgreSQL data layer and BullMQ is the Redis job framework.
- Manual payment operations are the default first release; live M-Pesa is opt-in per pilot tenant rather than a universal pilot prerequisite.
- Member self-service ships with the public tenant website after core operational workflows and the pilot.
- Phase 11–12 functionality remains ordered by the documented roadmap and requires feature-level specifications before coding, because the current guidelines intentionally do not define their detailed business rules.
