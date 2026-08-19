# FITOS Feature Module Specifications

## 1. Organizations and Onboarding

### Required
- create organization
- legal/display name
- business type
- timezone
- currency
- brand logo
- brand colors
- branch creation
- opening hours
- contact details
- booking policies
- initial owner user

### Onboarding UX
Progress:
1. Business
2. Branch
3. Services
4. Staff
5. Plans
6. Payments
7. Publish

Allow skip where non-blocking.

Success condition:
A tenant can produce its first valid bookable schedule without developer intervention.

---

## 2. CRM

### Lead
Fields:
- contact
- interest
- source
- stage
- owner
- branch
- next follow-up
- tags
- notes

Stages default:
- new
- contacted
- trial_booked
- trial_completed
- offer
- joined
- lost

Tenant may customize labels later, but internal analytics should map to canonical categories.

### Required CRM Actions
- create lead
- assign
- update stage
- add note
- create task
- convert to member
- mark lost reason
- filter/search
- export permitted fields

### CRM Audit
Stage change is an event, not just silent field overwrite.

---

## 3. Members

Member detail page:
- identity
- membership status
- sessions/credits
- next booking
- recent attendance
- payments
- contact history
- notes
- documents/consents
- progress section if enabled

Quick actions:
- book
- check in
- take payment
- renew
- add note

Member timeline should unify important events without exposing sensitive information to unauthorized roles.

---

## 4. Services

Service configuration:
- type: class / appointment / facility / access
- name
- category
- duration
- default capacity
- price
- eligible plans
- branch
- room/resource
- trainer requirements
- booking window
- cancellation policy
- public visibility
- color/icon only as presentation metadata

---

## 5. Scheduling

Views:
- day
- week
- list
- trainer
- room/resource

Actions:
- create recurrence
- create one-off
- edit this occurrence
- edit this and future
- cancel occurrence
- substitute trainer
- change room
- adjust capacity

Conflict detection:
- trainer collision
- room collision
- resource collision
- closure/holiday conflict

---

## 6. Booking

### Staff Booking
May:
- search/select customer
- choose service
- choose occurrence/time
- use membership/credit
- record required payment state
- confirm

### Public Booking
Must:
- identify tenant
- show tenant branding
- expose only public inventory
- obey policy
- collect minimum personal data
- prevent enumeration abuse
- rate limit
- confirm only after server commit

### Reschedule
Model as explicit operation preserving audit:
- old occurrence
- new occurrence
- credit impact
- fees if enabled

### Cancellation
Policy can compute:
- allowed
- late
- no credit return
- fee
- waitlist promotion

---

## 7. Waitlist

Optional MVP+.

Rules:
- ordered entries
- eligibility maintained
- promotion atomically reserves slot
- expiry window for offered slot if confirmation required
- notify
- move to next on expiry
- avoid duplicate waitlist + booking

---

## 8. Membership Plans

Plan builder:
- name
- billing price
- duration/recurrence
- starts policy
- branches
- entitlements
- credits
- booking rules
- public sale toggle

Member membership:
- plan snapshot/reference
- start/end
- status
- renewal mode
- purchase payment
- entitlement ledger

Historical memberships must not change merely because plan pricing changes.

---

## 9. Payments

### Staff Payment Entry
Methods:
- M-Pesa
- cash
- card
- bank/manual
- other configured method

Requirements:
- amount
- currency
- payer/member
- purpose/allocation
- branch
- reference
- receipt
- actor

### Provider Integration
The platform must be adapter-based.

Internal system never allows provider-specific objects to leak into core membership logic.

### Reconciliation
Views:
- matched
- unmatched
- duplicated/review
- failed
- refunded

Allow authorized user to match an unmatched transaction with complete audit.

---

## 10. M-Pesa Experience

M-Pesa should feel native to Kenyan operations.

Support conceptually:
- payment initiation where provider flow supports it
- payment callback
- provider reference
- business reference/account
- matching
- payment confirmation
- retry/timeout UI
- manual reconciliation

Never show “paid” solely because payment initiation succeeded.

---

## 11. Attendance

### Member Check-in
Inputs:
- QR
- member number
- phone
- name search

Validation:
- active entitlement if required
- branch access
- duplicate same-visit rules
- class booking where class-specific
- staff override permission

Override must require:
- permission
- reason
- audit event

### Class Roster
- booked
- checked in
- attended
- no-show
- late cancel

Bulk “mark attended” must preserve per-member audit semantics.

---

## 12. Notifications

Channels:
- in-app
- email
- SMS adapter
- WhatsApp adapter

Notification triggers:
- booking confirmation
- booking reminder
- cancellation
- waitlist
- membership expiry
- payment receipt
- trial follow-up
- lead task reminder

Preferences:
- operational messages
- marketing messages
- channel availability
- consent state

Marketing consent must not be inferred from transactional communication consent.

---

## 13. Public Website

Tenant site MVP:
- logo/brand
- home
- services
- trainers
- timetable
- memberships
- booking CTA
- contact/location

Public content should load independently of admin privileges.

Use tenant slug/domain routing strategy with strict tenant resolution.

Future:
- custom domains
- SEO controls
- page sections
- promotions
- embedded booking widgets

---

## 14. Reporting

Reports require stable definitions.

### Revenue
Distinguish:
- payment collected
- invoice issued
- refunded amount
- net collected

### Membership
- active
- new
- expired
- renewal
- cancellation

### Attendance
- visits
- unique visitors
- class occupancy
- no-show

### Funnel
- new lead
- trial
- joined

Every report displays:
- branch scope
- timezone
- date range
- currency
- export action

---

## 15. Dashboard

Role-aware.

### Owner
- collected revenue
- active members
- new members
- check-ins
- occupancy
- renewals due
- failed/unmatched payments
- lead conversion

### Reception
- today
- search/check-in
- next classes
- unpaid/pending customer actions

### Trainer
- today’s schedule
- rosters
- assigned clients

Do not show financial data to roles lacking permission merely because dashboard endpoint returns it.

---

## 16. Search

Global command/search:
- members
- leads
- bookings
- payments by reference
- staff

Search results must be tenant/branch permission-scoped.

Phone search should normalize common input variants.

---

## 17. Import

CSV import:
- preview
- field mapping
- normalization
- duplicate detection
- validation report
- dry-run
- commit
- error download
- audit

Import jobs must be idempotent or protected from accidental double commit.

---

## 18. Export

Exports:
- permission-gated
- logged
- asynchronous for large datasets
- downloadable with expiration
- data minimized by role

Sensitive fields should not be included in general member exports by default.
