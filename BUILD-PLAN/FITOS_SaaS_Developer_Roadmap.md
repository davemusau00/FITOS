# FITOS SaaS Experience Completion Roadmap

**Repository baseline:** `davemusau00/FITOS` @ `0d28885c3d52cd6e04d7561423845a86a15b3e4e`  
**Primary objective:** Turn FITOS from an advanced internal operating system into a polished, responsive, role-aware SaaS product for gyms, studios, trainers, and wellness businesses.  
**Payments:** Provider integration is intentionally deferred to the final phase.  
**North-star promise:** **One OS. Every workout. Every member. Every growth.**

## 1. Product Completion Goal

FITOS should allow a fitness business to self-onboard, configure branches/services/rooms/trainers/schedules, capture and convert leads, manage members and memberships, create bookings, run front desk/attendance, publish a public website and timetable, provide member self-service, automate reminders and follow-ups, and understand operations through analytics. Live payment providers are added only after this SaaS experience is complete.

## 2. Guiding Product Rules

- SaaS-first: workflows must feel connected, not like isolated modules.
- Role-aware: Owner, Manager, Receptionist, Trainer, Member, Prospect.
- Responsive by interaction model: desktop, tablet and mobile get intentional layouts.
- Contextual actions: book/check-in/follow-up from the relevant record or session.
- Progressive disclosure: do not expose every backend field by default.
- Payment-last: retain existing payment domain code but defer new provider/payment work.

## 3. Target Information Architecture

### Today
Role-aware command centre.

### Operations
Schedule, Bookings, Attendance, Rosters.

### People
Members, Memberships, Segments.

### Growth
Leads, Follow-ups.

### Business
Services, Rooms & Resources, Team, Branches.

### Insights
Analytics, Reports, Retention.

### Settings
Organization, Access, Branding, Notifications, Integrations, Preferences.

Payments remain secondary/hidden until final phase.

## 4. Delivery Model

Use **2-week sprints**. Every sprint ends with responsive UI, loading/empty/error/success states, keyboard/touch usability, permission-aware actions, tests for new logic, browser E2E for the critical journey, and no regression to the existing operating river.

# PHASE 0 — SaaS Product Foundation
**Duration:** 2 sprints

### Sprint 0.1 — Shell & IA
- group navigation around Today / Operations / People / Growth / Business / Insights / Settings;
- nested navigation groups;
- persistent branch switcher;
- user/profile menu;
- Quick Create;
- route metadata;
- preserve capability-aware navigation;
- hide Payments from primary navigation.

### Sprint 0.2 — Global product chrome
- command palette shell;
- global search shell;
- recent items;
- sticky mobile header;
- mobile bottom nav;
- toast/notification system;
- destructive confirmation standard;
- unsaved-change guard.

**Exit:** shell works at 360, 768, 1024 and 1440 px; branch context persists; high-frequency actions are within two interactions.

# PHASE 1 — Responsive Design System Completion
**Duration:** 2 sprints

### Sprint 1.1
Create shared primitives: `ResponsiveDataView`, desktop table, tablet compact table, mobile cards, `FilterBar`, `FilterSheet`, `ActionBar`, `SplitPane`, `Tabs`, `SegmentedControl`, `DateRangePicker`, `DateChips`, `StatCard`, `MetricTrend`, `MemberCard`, `SessionCard`, `RosterRow`, `CommandMenu`.

### Sprint 1.2
- full-screen mobile modals;
- bottom sheets;
- responsive drawers;
- sticky mobile CTA;
- responsive skeleton/empty states;
- touch target audit;
- reduced-motion/contrast audit;
- mobile keyboard and safe-area behavior.

**Exit:** every core UI primitive has deliberate desktop/tablet/mobile behavior.

# PHASE 2 — Onboarding & Business Setup
**Duration:** 2 sprints

### Sprint 2.1 — Activation checklist
1. Business profile
2. First branch
3. Services
4. Rooms/resources
5. Recurring schedule
6. Membership plan
7. Team
8. First member
9. First booking

Features: percentage completion, auto-detection, skip/resume, Today checklist, contextual deep links.

### Sprint 2.2 — Business configuration polish
Organization profile, timezone, operating hours, branch hours, resources, trainer specialties, service categories, branding placeholders, permission-aware settings.

**Exit:** a new business can configure its operating structure without a developer.

# PHASE 3 — Today Command Centre
**Duration:** 2 sprints

### Sprint 3.1 — Owner/Manager
Today’s sessions, expected attendance, occupancy, active members, expiring memberships, leads needing follow-up, new members, cancellations/no-shows, staff coverage, setup progress.

### Sprint 3.2 — Reception/Trainer
Reception: giant search, expected arrivals, one-click check-in, next classes, entitlement warnings, urgent tasks.
Trainer: today’s classes, roster, attendance, upcoming clients, member context.

**Exit:** each major role has a useful first screen.

# PHASE 4 — People OS: Members, CRM, Leads
**Duration:** 3 sprints

### Sprint 4.1 — Member directory
Responsive list modes, filters, saved views, tags/segments, quick actions, recently viewed.

### Sprint 4.2 — Member profile redesign
Header: avatar, status, branch, membership, credits, last visit, next booking.
Tabs: Overview, Membership, Bookings, Attendance, Notes, Activity.
Quick actions: Book, Check in, Assign membership, Add note, Edit.

### Sprint 4.3 — Leads workspace
Pipeline/List, lead drawer/page, notes, follow-up tasks, next follow-up, source, owner, trial booking, conversion, designed lost-reason dialog, timeline.

**Exit:** Prospect → Member works as one coherent CRM journey.

# PHASE 5 — Memberships & Retention
**Duration:** 2 sprints

### Sprint 5.1
Plan builder, service eligibility, branch scope, duration, credits, hold policy, visibility, historical snapshot display, activate/hold/resume/cancel/renew, credit ledger and audit.

### Sprint 5.2
Retention queue: expiring, inactive, no recent visit, unused credits, frequent cancellation, high attendance, health indicators, renewal queue, reactivation list.

**Exit:** management can see both plan status and who needs action.

# PHASE 6 — Scheduling Workspace
**Duration:** 3 sprints

### Sprint 6.1 — Desktop
Day/week/agenda views, recurring templates, exceptions, trainer/room/service filters, occupancy, branch context, duplicate/cancel/reschedule.

### Sprint 6.2 — Session detail
Service, trainer, room, time, capacity, bookings, waitlist placeholder, attendance summary, member actions, roster link.

### Sprint 6.3 — Mobile
Agenda-first, date chips, Today/Tomorrow/Week, session cards, quick book, quick roster, trainer view.

**Exit:** scheduling is powerful on desktop and truly usable on phone.

# PHASE 7 — Booking Experience
**Duration:** 2 sprints

### Sprint 7.1
Contextual booking wizard with member/date/service/trainer/branch filters, capacity, entitlement preview, summary, warnings, preselected member or occurrence.

Entry points: Member, Schedule, Today, Quick Create, Attendance.

### Sprint 7.2
Bookings workspace: upcoming/completed/cancelled, filters, detail, cancellation, reschedule, booking source, capacity, member/session context.

**Exit:** staff can create and manage bookings with minimal context switching.

# PHASE 8 — Attendance & Reception Mode
**Duration:** 2 sprints

### Sprint 8.1
Instant member search, photo/initials, phone, membership, credits, next class, giant check-in action, keyboard-first use, recent members, expected arrivals.

### Sprint 8.2
Class roster: booked/checked in/attended/no-show/late-cancel, membership warning, notes, quick member profile, bulk mark attended, trainer mobile roster.

**Exit:** front desk can run a normal day from FITOS.

# PHASE 9 — Public Website & Booking
**Duration:** 3 sprints

### Sprint 9.1
Tenant-branded site shell: Home, Classes, Coaches, Memberships, Schedule, About, Contact.

### Sprint 9.2
Public schedule: class cards, trainer, time, capacity, branch, filters, class detail.

### Sprint 9.3
Payment-free reservation flow: identify/sign in, entitlement check, reserve if eligible, pending/inquiry state if payment later required, confirmation, cancellation policy.

**Exit:** tenant can publish a branded site and accept non-payment-dependent reservations.

# PHASE 10 — Member Self-Service
**Duration:** 2 sprints

### Sprint 10.1
Member home, upcoming bookings, membership, credits, attendance history, profile, notifications.

### Sprint 10.2
Cancel/reschedule, reserve class, favorite services/trainers, class history, mobile bottom nav, PWA-ready install experience.

**Exit:** members can manage routine activity without staff help.

# PHASE 11 — Automation & Communications
**Duration:** 3 sprints

### Sprint 11.1 — Templates
Booking confirmation, class reminder, cancellation, follow-up, trial, expiry, renewal, inactivity, win-back, birthday.

### Sprint 11.2 — Rules
Trigger, delay, condition, action, tenant/branch scope, enabled state, test mode, run history.

### Sprint 11.3 — Communication timeline
Member message log, sent/failed states, automation source, manual message placeholder, email/SMS/WhatsApp channel abstraction.

**Exit:** automation UI works even with mocked providers.

# PHASE 12 — Analytics & Growth Intelligence
**Duration:** 3 sprints

### Sprint 12.1
Attendance, occupancy, bookings, cancellations, no-shows, service popularity, trainer load, branch comparison.

### Sprint 12.2
Lead funnel, source conversion, retention, expiry, reactivation, active/hold/inactive.

### Sprint 12.3
Executive dashboard, customizable KPIs, date ranges, branch filters, trend deltas, saved reports, CSV export. Revenue metrics remain hidden until payment phase.

**Exit:** owners can understand operational growth without live payment data.

# PHASE 13 — SaaS Polish & Product Maturity
**Duration:** 2 sprints

### Sprint 13.1
Command palette, global search, saved views, favorites, recent records, contextual help, keyboard shortcuts, responsive QA, accessibility QA.

### Sprint 13.2
Motion polish, lazy loading, optimistic UI where safe, undo patterns, visual regression, component state coverage, copy/microcopy audit.

**Exit:** ordinary workflows need no training manual.

# PHASE 14 — Payments & Monetization Integration — FINAL
**Duration:** 4+ sprints

### Sprint 14.1 — Payment UX
Payments, invoices, recurring charges, balances, receipts, refunds, reconciliation, finance permissions, status timeline.

### Sprint 14.2 — M-Pesa
Provider adapter, STK Push, callbacks, verification, duplicate handling, unmatched payments, allocation, receipt events.

### Sprint 14.3 — Cards/other providers
Card checkout, recurring collection, failed payment recovery.

### Sprint 14.4 — Financial analytics
Revenue, collections, failed payments, average transaction, method mix, revenue by service/membership/branch/trainer.

**Exit:** payments feel native, not bolted on.

## Global Acceptance Matrix
Every phase preserves tenant isolation, permission boundaries, responsive layouts, accessibility, keyboard usability, auditability for high-impact actions, E2E for major journeys, and historical integrity.

## Product Completion Definition
SaaS Experience Completion is reached when a business can self-onboard, owners/managers have useful Today views, staff can manage people/schedules/memberships/bookings/attendance, reception and trainers can run their day, leads can be converted, public visitors can discover and reserve, members can self-serve, automation UI works, operational analytics exist, and desktop/tablet/mobile are intentionally designed. Only then does payment integration become the final commercial rail.
