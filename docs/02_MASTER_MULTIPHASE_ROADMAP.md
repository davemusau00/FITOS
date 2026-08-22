# 02 — Master Multiphase Roadmap

## Phase 1 — SaaS Integration Hardening

### Sprint 1.1 — Global context and product feedback
- Persistent BranchContext with All Locations mode.
- Branch-aware query-key helpers and invalidation.
- Permission-filtered Quick Create.
- Route metadata and consistent permission-denied states.
- Global toast/success/error patterns.
- Recent items and command palette data-search foundation.

### Sprint 1.2 — Public and member architecture
- `/api/v1/public/:tenantSlug/site`.
- Public services, coaches, branches and schedule DTOs.
- Public lead capture and reservation mutation.
- Rate limiting and abuse protection.
- Member identity schema.
- Member login/magic-link/OTP-ready abstraction.
- `/api/v1/member/me` and member-scoped booking/membership/attendance APIs.

### Sprint 1.3 — Replace prototypes with real data
- Real Insights aggregate APIs.
- Branch/date filtering.
- Lead funnel, occupancy and retention from data.
- CSV export.
- Persist automation definitions/templates/state.
- Worker execution and run history.

**Exit:** public/member experiences have real backend boundaries; no fake operational metrics.

---

## Phase 2 — Self-Service SaaS Platform

### Sprint 2.1 — Tenant signup
- Public FITOS signup.
- Owner account bootstrap.
- Tenant creation and slug.
- Business type, country, timezone, currency.
- First branch wizard.

### Sprint 2.2 — Trial/account lifecycle
States: trial, active, grace, suspended, cancelled, archived.
- Trial expiry and grace.
- Account preferences.
- Account export/cancel/delete request flow.

### Sprint 2.3 — FITOS plans and usage
Separate SaaS plans from gym memberships.
- Plan definitions.
- Capabilities.
- Quotas.
- Usage counters.
- Upgrade/downgrade placeholders without payment collection.
- Feature gate middleware.

**Exit:** a stranger can create/configure a tenant without developer intervention.

---

## Phase 3 — Operator SaaS Completion

- Role-specific Today for owner, manager, reception and trainer.
- Exception/action queue.
- Expected arrivals.
- Expiring memberships.
- Follow-up queue.
- Member tags/segments/saved views.
- Global tasks with assignee, due date and priority.
- Lead pipeline improvements, trial booking and overdue follow-ups.

---

## Phase 4 — Booking, Membership & Attendance UX Completion

- Responsive booking detail and reschedule.
- Contextual preselection.
- Hold/resume/renew membership lifecycle.
- Expiry/unused-credit/inactive queues.
- Reception entitlement warnings.
- Actual occupancy/arrival counts.
- Trainer-friendly mobile roster.

---

## Phase 5 — Equipment & Resource Core

### Sprint 5.1 — Asset registry
- Equipment models/assets.
- Asset code/serial.
- Branch/room.
- Status.
- Warranty/documents.

### Sprint 5.2 — Resource scheduling
- Equipment pools.
- Service resource requirements.
- Fixed/per-attendee quantities.
- Occurrence resource reservations.
- Conflict validation.
- Resource-aware effective capacity.

### Sprint 5.3 — Maintenance/calibration
- Maintenance.
- Calibration.
- Inspections.
- Downtime/unavailability.
- Due alerts.
- Equipment history.

**Exit:** FITOS prevents impossible bookings caused by unavailable resources.

---

## Phase 6 — Inventory & Consumables

- Inventory items/locations/stock balances/movements.
- Suppliers and purchase orders.
- Receiving.
- Lots and expiry.
- Stocktakes.
- Reorder rules.
- Service BOM/session consumption.
- Low-stock/expiry alerts.
- Retail stock without checkout/payment yet.

---

## Phase 7 — FITOS Assess

### Generic assessment domain
- Assessment definitions/categories.
- Protocol versioning.
- Assessment sessions.
- Metric definitions/results/units.
- Attachments.
- Practitioner/equipment link.
- Data provenance.

### Assessment UX
- Performance Lab dashboard.
- New assessment.
- Result entry/review.
- Member Assessments tab.

### Assessment families
- Body composition.
- RMR/metabolic.
- VO2/CPET.
- Strength/power/jumps.
- Balance/asymmetry.
- ROM/mobility.
- Sprint/agility.
- Basic configurable wellness/vital metrics.

**Exit:** advanced facilities can run manual/generic assessments without vendor APIs.

---

## Phase 8 — Performance Profile & Assessment Batteries

- Member Progress tab.
- Baseline/current/delta charts.
- Metric pinning.
- Assessment batteries.
- Multi-test programs.
- Retest interval/due queue.
- Practitioner review state.
- Report generation.
- Selected member-facing results.

---

## Phase 9 — FITOS Therapy & Recovery

- Therapy modalities.
- Protocols/versioning.
- Sessions.
- Body region.
- Session parameters.
- Equipment.
- Safety/contraindication checklists.
- Consent record links.
- Pre/post measures.
- Outcome notes/follow-up.

Preset support through generic configuration:
- neuromuscular electrical stimulation/NEUBIE-style sessions;
- AlterG/body-weight-support sessions;
- pneumatic compression/Normatec-style sessions;
- mobility/manual therapy;
- rehabilitation/recovery sessions.

FITOS records practitioner-selected settings. It must not autonomously diagnose, prescribe or remotely operate regulated devices unless a future approved vendor interface explicitly permits it.

---

## Phase 10 — Credentials & Specialized Governance

- Credential types.
- Staff credentials.
- Expiry/document attachments.
- Service credential requirements.
- Scheduling validation.
- Expiry alerts.
- Configurable safety and consent templates.

---

## Phase 11 — Device Integration Framework

### Integration core
- Provider registry.
- Tenant integration connection.
- Encrypted credential references.
- Adapter interface.
- Health state.
- Sync checkpoint.
- Import jobs/errors.
- External subject/test links.
- Raw payload hash and mapping version.

### Integration levels
- L0 manual entry.
- L1 CSV/report import.
- L2 cloud API.
- L3 webhook.
- L4 SDK/device connectivity only when vendor-approved.

### Generic import first
- CSV mapping.
- Preview.
- Subject matching.
- Duplicate detection.
- Metric mapping.
- Quarantine unknown metrics.

---

## Phase 12 — Vendor Connectors

### InBody
LookinBody-authorized sync after generic assessment import is stable.

### VALD
VALD Hub/API connector where commercially authorized, mapping ForceDecks, DynaMo, NordBord, ForceFrame, SmartSpeed and supported result families into generic metrics.

### COSMED
Manual/file import first; approved API/HL7/DICOM interoperability only where licensed and available.

### PNOE
Manual/report import first; cloud API only with vendor access.

### NEUBIE / NeuFit
Asset/protocol/session tracking first. Do not assume public device API or implement remote control.

### AlterG/recovery systems
Structured session parameter recording and imports only where vendor contract/API allows.

---

## Phase 13 — FITOS Sites Website Builder

### Site configuration
- Tenant branding.
- Theme.
- Navigation.
- Media.
- SEO.
- Social/contact data.

### Controlled block builder
Hero, Service Grid, Class Schedule, Trainers, Memberships, Assessments, Therapy, Equipment/Technology, Testimonials, Gallery, Locations, FAQ, CTA, Contact, Trial, Rich Text.

Do not build unrestricted free-form Webflow-style editing.

### Publishing
- Draft/preview/publish.
- Version history.
- Custom domains.
- Sitemap/meta.
- Tenant slug fallback.

**Exit:** current fixed public tenant page becomes a configurable renderer.

---

## Phase 14 — Specialty Public Booking

Support Book Class, Assessment, Therapy, Recovery, Consultation and Facility.

Availability must understand required practitioner, credential, room, equipment, buffers, capacity, intake/checklists and entitlement. Payment-required flows remain placeholders.

---

## Phase 15 — Automation, Notifications & Retention Completion

- Real triggers/conditions/delays/actions.
- Branch scope.
- Test mode.
- Run history/failure/retry.
- Notification center/deep links.
- Communication log/provider abstraction.

Add triggers for calibration due, low stock, retest due, credential expiry, inactivity, membership expiry, trial completion and therapy follow-up.

---

## Phase 16 — Analytics & Reporting Completion

Operational: attendance, occupancy, cancellations, no-shows, trainer load, equipment utilization, downtime.

Growth: lead conversion/source, trial conversion, retention/reactivation.

Performance: assessment volume, retest adherence, progress distributions, therapy/protocol utilization.

Inventory: consumption, wastage, expiry, stock turns.

No revenue/payment metrics until final payment phase.

---

## Phase 17 — Platform Administration & Support

`/platform` separate internal surface:
- tenant search/detail/lifecycle;
- plans/capabilities;
- usage;
- feature flags;
- support notes;
- controlled support access;
- account recovery;
- platform audit;
- system notices.

---

## Phase 18 — Import, Migration, PWA & SaaS Polish

- CSV imports for members/leads/memberships/staff.
- Mapping/preview/validation/duplicate handling/failure report.
- Tenant data exports.
- PWA manifest/install/offline shell.
- Accessibility audit.
- Visual regression.
- Mobile/tablet usability audit.
- Performance optimization.

---

## Phase 19 — Release Readiness Track

Separate from feature architecture:
- staging;
- real off-server backup/restore drill;
- branch protection and required CI;
- security/rate-limit review;
- observability/runbooks;
- privacy/data-protection workflows.

---

## Phase 20 — PAYMENTS & MONETIZATION — FINAL PHASE

Live M-Pesa, cards, invoices, recurring member billing, reconciliation, financial analytics and FITOS SaaS subscription billing. See `09_FINAL_PAYMENT_PHASE.md`.
