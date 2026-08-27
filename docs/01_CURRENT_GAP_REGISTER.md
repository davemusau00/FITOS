# 01 — Current Gap Register

## P0 correctness gaps

### Global branch context

The current branch switcher must become a true product context. Switching branch must affect Today, Schedule, Bookings, Attendance, Reception, Members where appropriate, Services, Staff, Insights, Inventory, Equipment, Assessments and Therapy. Persist the selection and invalidate/requery branch-aware data consistently.

### Public API boundary

The public tenant website must never rely on staff-authenticated internal controllers. Add explicit tenant-slug-scoped public read models and public lead/reservation mutations with rate limiting and narrow DTOs.

### Member identity

The Member Portal must not infer identity by searching a member whose email matches a staff/user session. Add explicit member identities, member sessions/challenges and member-scoped server authorization.

### Analytics

Remove all hard-coded operational KPIs and chart data from production-facing Insights. Every metric needs a real aggregate query, date window and branch scope.

### Automations

Persist rules, templates and active/paused state. A UI toggle must not imply that an automation runs unless the worker is actually registered to execute it. Add run history, failure state and retry.

## Missing domains

- self-service tenant signup and trial lifecycle;
- SaaS plans/capabilities/usage/feature flags;
- platform admin/support;
- global tasks and notification center;
- CSV import/migration workflow;
- equipment assets/pools/maintenance/calibration;
- service resource requirements and occurrence reservations;
- staff credentials and service credential requirements;
- inventory/consumables/lots/suppliers/purchase orders/stocktakes;
- service bill-of-materials and session consumption;
- assessment definitions/protocols/sessions/results/imports;
- performance profile/progress/assessment batteries/retest planning;
- therapy modalities/protocols/sessions/checklists/consent links;
- integration adapter framework and vendor connectors;
- controlled FITOS Sites website builder;
- specialty public booking;
- real operational/performance/inventory analytics;
- PWA completion;
- live payment providers, intentionally deferred.

## Partial domains that need completion

- Today dashboard: role-aware views, exception queue, expected arrivals, real trends.
- Members: tags, segments, saved views, bulk actions, richer notes/tasks.
- Leads: stronger pipeline, assignee workload, trial booking, overdue queue.
- Memberships: hold/resume/renewal, expiry and retention workflows.
- Schedule: mobile agenda, equipment/resource constraints.
- Booking: reschedule, richer specialty service booking and eventual waitlist.
- Reception: expected arrivals, actual occupancy, entitlements, roster integration.
- Public site: currently a fixed UI template, needs CMS/data/public API.
- Member Portal: UI exists, identity/backend needs redesign.
- Automations: UI exists, backend/execution incomplete.
- Insights: UI exists, data is partly mock.
