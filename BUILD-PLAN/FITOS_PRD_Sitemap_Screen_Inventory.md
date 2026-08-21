# FITOS Product Requirements Document
## SaaS Experience Completion

**Product:** FITOS — Fitness Operating System  
**Repository baseline:** `0d28885c3d52cd6e04d7561423845a86a15b3e4e`  
**Positioning:** Premium operating system for gyms, studios, trainers, and wellness businesses.  
**Core promise:** **One OS. Every workout. Every member. Every growth.**

# 1. Product Vision
FITOS combines members, leads, memberships, classes, trainers, schedules, bookings, attendance, website, public booking, member self-service, reminders, retention and analytics into one coherent SaaS product. Payment execution is added later.

# 2. Primary Personas
- **Owner:** business overview, growth, retention, configuration.
- **Manager:** schedules, memberships, bookings, attendance, follow-ups.
- **Receptionist:** search, check-in, bookings, entitlement status.
- **Trainer:** today, rosters, attendance, relevant member context.
- **Member:** book/cancel/reschedule, membership/credits, upcoming sessions.
- **Prospect:** discover, inquire/book trial, convert with low friction.

# 3. Product Principles
Fitness-native; mobile-first for staff/member use; desktop-powerful for management; role-aware; contextual; human-readable; responsive by interaction model; strong product states; accessible; payments-last.

# 4. App Sitemap

## Auth
- `/login`
- `/forgot-password` future
- `/accept-invite` future

## Onboarding
- `/onboarding`
- `/onboarding/business`
- `/onboarding/branch`
- `/onboarding/services`
- `/onboarding/resources`
- `/onboarding/schedule`
- `/onboarding/membership`
- `/onboarding/team`
- `/onboarding/member`
- `/onboarding/booking`

## Today
- `/app/today`

## Operations
- `/app/schedule`
- `/app/schedule/templates`
- `/app/schedule/session/:occurrenceId`
- `/app/bookings`
- `/app/bookings/new`
- `/app/bookings/:bookingId`
- `/app/attendance`
- `/app/attendance/roster/:occurrenceId`
- `/app/reception`

## People
- `/app/members`
- `/app/members/:memberId`
- `/app/members/:memberId/membership`
- `/app/members/:memberId/bookings`
- `/app/members/:memberId/attendance`
- `/app/members/:memberId/activity`
- `/app/memberships`
- `/app/membership-plans`
- `/app/segments`

## Growth
- `/app/leads`
- `/app/leads/:leadId`
- `/app/follow-ups`

## Business
- `/app/services`
- `/app/services/:serviceId`
- `/app/resources`
- `/app/team`
- `/app/branches`

## Automation
- `/app/automations`
- `/app/automations/new`
- `/app/automations/:automationId`
- `/app/templates`
- `/app/communications`

## Insights
- `/app/insights`
- `/app/insights/attendance`
- `/app/insights/bookings`
- `/app/insights/memberships`
- `/app/insights/retention`
- `/app/insights/leads`
- `/app/reports`

## Settings
- `/app/settings`
- `/app/settings/organization`
- `/app/settings/branches`
- `/app/settings/team`
- `/app/settings/security`
- `/app/settings/branding`
- `/app/settings/notifications`
- `/app/settings/integrations`
- `/app/settings/preferences`

## Payments — final phase
- `/app/payments`
- `/app/invoices`
- `/app/billing`
- `/app/payments/unmatched`

# 5. Public Sitemap

## Tenant Website
- `/:tenantSlug`
- `/:tenantSlug/classes`
- `/:tenantSlug/classes/:serviceSlug`
- `/:tenantSlug/schedule`
- `/:tenantSlug/coaches`
- `/:tenantSlug/coaches/:coachSlug`
- `/:tenantSlug/memberships`
- `/:tenantSlug/about`
- `/:tenantSlug/contact`
- `/:tenantSlug/book/:occurrenceId`

## Member Portal
- `/member/login`
- `/member/home`
- `/member/bookings`
- `/member/schedule`
- `/member/membership`
- `/member/attendance`
- `/member/notifications`
- `/member/profile`

# 6. Screen Inventory

## Today
### Owner/Manager
Greeting/date, branch filter, Quick Create, KPI row, today’s sessions, occupancy, leads needing action, expiring memberships, cancellations/no-shows, staff coverage, setup progress.

### Reception
Giant member search, expected arrivals, next classes, one-click check-in, warnings, urgent tasks.

### Trainer
Today’s sessions, next roster, attendance, upcoming members.

## Members
### Directory
Search, branch/status/segment filters, desktop table, tablet compact mode, mobile cards, add member, saved filters, recent members.

### Member Profile
Header: avatar, name, status, branch, member number, membership, credits, last visit, next booking.
Tabs: Overview, Membership, Bookings, Attendance, Notes, Activity.
Actions: Book, Check in, Assign membership, Add note, Edit.

## Leads
### Pipeline
New, Contacted, Trial Booked, Trial Completed, Offer, Joined. Lost is filtered/archive.
### Detail
Contact, source, interest, assignee, stage, next follow-up, notes, tasks, timeline, Book trial, Convert, Mark lost.

## Memberships
Plan list, plan builder, member membership panel, credit ledger, hold/resume, cancel/renew, retention queue.

## Schedule
Desktop calendar, mobile agenda, recurring template manager, session detail, occupancy, trainer/room/service filters.

## Booking
New Booking stepper, Booking List, Booking Detail, cancellation/reschedule, entitlement/capacity warnings.

## Attendance
Reception Mode, Attendance Log, Class Roster, quick member profile, expected arrivals.

## Business Setup
Services, Rooms/Resources, Team, Branches, organization settings.

## Public Website
Home, Classes, Coaches, Schedule, Memberships, About, Contact, Class Detail.

## Member Portal
Home, Bookings, Schedule, Membership, Attendance, Notifications, Profile.

## Automation
Automation dashboard, builder, template manager, communications log.

## Insights
Executive, Attendance, Booking, Membership, Leads, Reports. Payment/revenue metrics wait for the final payment phase.

# 7. Responsive Rules
- **Desktop:** permanent nav, multi-column, tables, calendars, split panes.
- **Tablet:** compact nav, reduced columns, drawers, touch controls, day/week schedule.
- **Mobile:** bottom nav, card lists, filter sheets, full-screen modals, sticky CTAs, agenda schedule, search-first reception.

# 8. Functional Requirements
## Global search
Member, lead, service, class, booking, trainer.

## Quick Create
Member, Lead, Booking, Session, Check-in.

## Feedback
Every mutation has loading, success, error and retry guidance.

## Permissions
UI mirrors server capabilities but never replaces backend authorization.

## Accessibility
Keyboard operation, visible focus, semantic labels, contrast, reduced motion, large touch targets.

# 9. Deferred Payment Requirements
Final phase must cover M-Pesa STK, callbacks, cards, invoices, recurring billing, unmatched transactions, reconciliation, refunds, receipts, failed payment recovery and financial analytics.

Before then, public/member flows support entitlement-based reservations and non-payment-dependent states.

# 10. Product Acceptance Goal
SaaS experience is ready for payment integration only when onboarding works; Today is role-aware; people, memberships, schedules, bookings and attendance are cohesive; public booking and member self-service exist; automation UI exists; operational analytics exist; and desktop/tablet/mobile are deliberately designed.
