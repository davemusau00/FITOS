# FITOS Implementation Task List

## Phase 1 — Operator UX Catch-up (COMPLETED)

### 1.0 — Prep
- [x] Install calendar library (`@fullcalendar/react` bundle)
- [x] Add API client methods for services / schedule / bookings / rooms

### 1.1 — Refactor `pages.tsx` → Domain Feature Modules
- [x] Create `features/shared/` with `PageLoading`, `ErrorNotice`, `formatDate`, `formatDateTime`, `formatCurrency`
- [x] Extract `features/overview/OverviewPage.tsx`
- [x] Extract `features/members/MembersPage.tsx`
- [x] Extract `features/members/NewMemberPage.tsx`
- [x] Extract `features/members/MemberDetailPage.tsx` (+ `MemberEditor`, `MemberFormValues`, helpers)
- [x] Extract `features/leads/LeadsPage.tsx`
- [x] Extract `features/leads/NewLeadPage.tsx`
- [x] Extract `features/staff/StaffPage.tsx`
- [x] Extract `features/settings/SettingsPage.tsx`
- [x] Extract `features/settings/OrganizationSettingsPage.tsx`
- [x] Extract `features/settings/BranchesSettingsPage.tsx`
- [x] Extract `features/settings/SecuritySettingsPage.tsx`
- [x] Extract `features/onboarding/OnboardingPage.tsx`
- [x] Extract `features/auth/LoginPage.tsx`
- [x] Update `features/index.ts` (re-export barrel)
- [x] Delete old monolithic `pages.tsx`
- [x] Verify router still compiles + all existing pages render

### 1.2 — Nav + Router Updates
- [x] Add Services / Schedule / Bookings links to `shell.tsx`
- [x] Add routes to `router.tsx`
- [x] Add nav CSS icon for new sections

### 1.3 — Services UI
- [x] `features/services/ServicesPage.tsx` — list + create/edit modal + Rooms & Resources manager modal
- [x] Wire to `api.services()`, `api.createService()`, `api.updateService()`, `api.rooms()`, `api.createRoom()`

### 1.4 — Schedule / Calendar UI
- [x] Install + configure FullCalendar library with timeGrid, dayGrid, list, and interaction
- [x] `features/schedule/SchedulePage.tsx` — weekly calendar (desktop) / agenda (mobile)
- [x] Occurrence card component with interactive click handler
- [x] Create occurrence modal form with validation and duration computation
- [x] Cancel occurrence confirm dialog with reason input
- [x] Wire to `api.scheduleOccurrences()`, `api.createScheduleOccurrence()`, `api.cancelScheduleOccurrence()`
- [x] Add CSS: calendar dark theme overrides to match FITOS design system

### 1.5 — Bookings UI
- [x] `features/bookings/BookingsPage.tsx` — list with search & status filters + cancel modal
- [x] `features/bookings/NewBookingPage.tsx` — step-by-step wizard
  - [x] Step 1: Member search & picker
  - [x] Step 2: Occurrence picker with real-time capacity validation
  - [x] Step 3: Eligibility & summary card (drop-in authorized)
  - [x] Step 4: Confirm → `POST /bookings` with idempotency key
- [x] Cancel booking action with release of session capacity
- [x] Wire to `api.bookings()`, `api.createBooking()`, `api.cancelBooking()`
- [x] Add CSS: booking wizard stepper layout, selected entity badges, and summary cards

### 1.6 — Roster / Occurrence Detail
- [x] `OccurrenceDetailModal` — attending members roster + quick book member button + session cancellation

---

## Phase 2 — Membership Entitlements (IN PROGRESS)

- [ ] Add Membership & Credit methods to `FitosRepository` port
- [ ] Implement in `InMemoryFitosRepository`
- [ ] Implement in `DrizzleFitosRepository`
- [ ] Add `MembershipsController` (backend) & wire into `CoreService` & `AppModule`
- [ ] Hook booking creation to debit active membership credits & cancellation to restore
- [ ] `features/memberships/MembershipsPage.tsx` — Plans tab + Active memberships tab
- [ ] Member detail: add Membership tab with credit ledger view

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
