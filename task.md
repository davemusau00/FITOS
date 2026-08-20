# FITOS Implementation Task List

## Phase 1 — Operator UX Catch-up

### 1.0 — Prep
- [ ] Install calendar library (`@fullcalendar/react` bundle or `react-big-calendar`)
- [ ] Add API client methods for services / schedule / bookings / rooms

### 1.1 — Refactor `pages.tsx` → Domain Feature Modules
- [ ] Create `features/shared/` with `PageLoading`, `ErrorNotice`, `formatDate`, `Kpi`
- [ ] Extract `features/overview/OverviewPage.tsx`
- [ ] Extract `features/members/MembersPage.tsx`
- [ ] Extract `features/members/NewMemberPage.tsx`
- [ ] Extract `features/members/MemberDetailPage.tsx` (+ `MemberEditor`, `MemberFormValues`, helpers)
- [ ] Extract `features/leads/LeadsPage.tsx`
- [ ] Extract `features/leads/NewLeadPage.tsx`
- [ ] Extract `features/staff/StaffPage.tsx`
- [ ] Extract `features/settings/SettingsPage.tsx`
- [ ] Extract `features/settings/OrganizationSettingsPage.tsx`
- [ ] Extract `features/settings/BranchesSettingsPage.tsx`
- [ ] Extract `features/settings/SecuritySettingsPage.tsx`
- [ ] Extract `features/onboarding/OnboardingPage.tsx`
- [ ] Update `features/index.ts` (re-export barrel)
- [ ] Delete old `pages.tsx`
- [ ] Verify router still compiles + all existing pages render

### 1.2 — Nav + Router Updates
- [ ] Add Services / Schedule / Bookings / Memberships links to `shell.tsx`
- [ ] Add routes to `router.tsx`
- [ ] Add nav CSS icon for new sections

### 1.3 — Services UI
- [ ] `features/services/ServicesPage.tsx` — list + create/edit drawer
- [ ] Add CSS: `.services-grid`, service card layout
- [ ] Wire to `api.services()`, `api.createService()`, `api.updateService()`

### 1.4 — Schedule / Calendar UI
- [ ] Install + configure calendar library
- [ ] `features/schedule/SchedulePage.tsx` — weekly calendar (desktop) / agenda (mobile)
- [ ] Occurrence card component
- [ ] Create occurrence drawer form
- [ ] Cancel occurrence confirm dialog
- [ ] Wire to `api.schedule()`, `api.createOccurrence()`, `api.cancelOccurrence()`
- [ ] Add CSS: calendar overrides to match FITOS dark theme

### 1.5 — Bookings UI
- [ ] `features/bookings/BookingsPage.tsx` — list with filters
- [ ] `features/bookings/NewBookingPage.tsx` — 4-step wizard
  - [ ] Step 1: Member search
  - [ ] Step 2: Occurrence picker (with capacity)
  - [ ] Step 3: Eligibility / confirm details
  - [ ] Step 4: Confirm → POST /bookings
- [ ] Cancel booking inline action
- [ ] Wire to `api.bookings()`, `api.createBooking()`, `api.cancelBooking()`
- [ ] Add CSS: booking wizard stepper layout

### 1.6 — Roster / Occurrence Detail
- [ ] `features/schedule/OccurrenceDetailPage.tsx` — booking list per occurrence
- [ ] + Add Booking shortcut

---

## Phase 2 — Membership Entitlements

- [ ] `MembershipsController` (backend)
- [ ] Repository methods for plans, memberships, credit ledger
- [ ] `features/memberships/MembershipsPage.tsx` — Plans tab + Active tab
- [ ] Member detail: add Membership tab
- [ ] Booking: credit debit on create, restore on cancel

---

## Phase 3 — Payments

- [ ] Migration `0005_payments.sql`
- [ ] `PaymentsController` (backend)
- [ ] `features/payments/PaymentsPage.tsx`
- [ ] `features/payments/UnmatchedPaymentsPage.tsx`

---

## Phase 4 — Attendance

- [ ] Migration `0006_attendance.sql`
- [ ] `AttendanceController` (backend)
- [ ] `features/attendance/AttendancePage.tsx`
- [ ] `features/attendance/ClassRosterPage.tsx`

---

## Phase 5 — Operational Hardening

- [ ] PostgreSQL booking concurrency test
- [ ] Tenant isolation tests for new domains
- [ ] Overview dashboard KPI expansion
- [ ] Member detail: Bookings + Membership + Payments tabs

---

## Phase 6 — Worker Processors

- [ ] Notification processor
- [ ] Membership expiry scheduler
