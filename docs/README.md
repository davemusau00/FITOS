# FITOS Developer Documentation Update

**Live repository baseline:** `62cb2f8ba10b19fa0816f29477ba04b23938bd92`
**Scope:** Remaining/unimplemented work only.
**Primary development priority:** SaaS usability, self-service, operational cohesion, advanced fitness/performance/therapy capabilities, inventory, integrations, and website builder.
**Payments:** Live payment-provider integration is intentionally deferred to the FINAL phase.

**Role surfaces:** The role-specific shell, workspace, route, and authentication architecture is defined in [`10_ROLE_SURFACES_AND_AUTH_ARCHITECTURE.md`](10_ROLE_SURFACES_AND_AUTH_ARCHITECTURE.md). FITOS uses one shared operating system with distinct Command, Ops, Front Desk, Coach, Practice, Member, and Platform cockpits.

## Already materially implemented and NOT to be rebuilt

The current codebase already includes substantial implementations for the React/Vite SaaS shell, permission-aware grouped navigation, branch switcher UI, Quick Create, command palette, staff authentication, members, leads/CRM, services, recurring schedules, bookings, memberships/credit ledger, attendance, roster, Reception UI, onboarding UI, richer Today/Overview UI, public tenant website UI prototype, member portal UI prototype, automations UI prototype, insights UI prototype, internal payment ledger/refund/reconciliation, CI, Playwright pilot flow, backup/restore, and monitoring foundations.

## Remaining gaps this bundle covers

1. Persistent app-wide branch context.
2. Dedicated public tenant API boundaries.
3. Dedicated member identity/auth and member-scoped APIs.
4. Real analytics replacing mock/hard-coded metrics.
5. Real automation persistence/execution/run history.
6. Self-service SaaS signup, trials, account lifecycle.
7. SaaS plans, capabilities, usage quotas, feature flags.
8. Platform administration and support tooling.
9. Equipment/resource asset management.
10. Inventory, consumables, suppliers, purchase orders, stocktakes.
11. Assessment/performance testing engine.
12. Therapy/protocol engine.
13. Staff credentials and specialized service qualification.
14. Member performance profile and longitudinal progress.
15. Assessment batteries and retesting.
16. Generic vendor/device integration framework.
17. InBody/VALD/COSMED/PNOE/NEUBIE/AlterG/recovery-system adapters or import paths.
18. Website builder/CMS replacing the current fixed tenant page.
19. Specialty public booking for classes, assessments, therapy, recovery and consultations.
20. Notifications, tasks, retention and PWA polish.
21. Release-readiness work as a separate track.
22. Payments, M-Pesa, cards, invoices, recurring member billing and FITOS SaaS billing as the final phase.

## Product north star

Prospect → Lead → Trial / Assessment → Member → Membership / Entitlement → Booking → Resource reservation → Equipment / practitioner / room assignment → Check-in → Training / therapy / assessment session → Results / notes / inventory consumption → Follow-up / automation → Retest / progress → Retention → Payment in the final integration phase.

**Implementation rule:** extend the current modular monolith. Do not create a second parallel application.
