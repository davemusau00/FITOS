# FITOS Frontend Routes and Screen-by-Screen UI Specification

## Global route map

```text
/login
/forgot-password
/onboarding

/app
/app/overview
/app/members
/app/members/new
/app/members/:memberId
/app/leads
/app/staff
/app/services
/app/schedule
/app/bookings
/app/bookings/new
/app/memberships
/app/payments
/app/payments/unmatched
/app/attendance
/app/reports
/app/website
/app/settings
/app/settings/organization
/app/settings/branches
/app/settings/branches/new
/app/settings/team
/app/settings/security

/book/:tenantSlug
/book/:tenantSlug/classes
/book/:tenantSlug/session/:occurrenceId
/book/:tenantSlug/checkout

/member
/member/bookings
/member/membership
/member/payments
/member/profile
```

# Authentication

## `/login`

### UI
- FITOS F mark
- email field
- password field
- show/hide password
- primary Sign In action
- forgot password
- restrained FITOS F brand pattern

### States
- idle
- submitting
- invalid
- rate limited
- network failure

### UX requirements
- complete keyboard path
- visible focus
- no account-enumeration language
- no duplicate submission
- responsive at 360px

---

# Onboarding

## `/onboarding`

Steps:

### 1. Business
- name
- business type
- country
- currency
- timezone

### 2. First Branch
- branch name
- phone
- address
- city
- timezone

### 3. Team
Invite or skip.

### 4. First Service
Post-Sprint 01.

### 5. Finish
Summary + launch dashboard.

Sprint 01 implements Business, Branch and Finish.

---

# Admin shell

## `/app`

### Desktop
- 248–280px side navigation
- branch context switcher
- user menu
- content canvas
- command/search trigger

### Sprint 01 nav
- Overview
- Members
- Staff
- Settings

Do not show dead links for unbuilt modules.

### Mobile
- nav drawer
- sticky compact header
- touch-safe actions
- avoid squeezing wide tables

---

# Overview

## `/app/overview`

### Sprint 01
KPI cards:
- total members
- active members
- branch count
- staff count

Sections:
- recent members
- setup checklist
- branch summary

Future:
- revenue
- check-ins
- bookings
- occupancy
- expiring memberships
- unmatched payments

Every KPI displays scope and drill-down destination.

---

# Members

## `/app/members`

Header:
- `Members`
- `+ Add Member`

Filters:
- search
- branch
- status

Desktop table:
- member
- phone
- home branch
- status
- joined
- actions

Mobile:
- member cards or priority-column table

States:
- skeleton
- no members
- no search results
- API error
- no permission

Search supports:
- name
- phone
- member number later
- email later

---

## `/app/members/new`

### Identity
- first name required
- last name
- phone
- email
- DOB optional

### FITOS relationship
- home branch
- member number optional/auto

Actions:
- Cancel
- Create Member

Requirements:
- inline validation
- server field error mapping
- preserve form after recoverable failure
- possible duplicate warning
- success redirect to detail

---

## `/app/members/:memberId`

Header:
- initials/avatar
- full name
- member number
- status badge

Sprint 01 actions:
- Edit
- Deactivate

Future quick actions:
- Book
- Check In
- Take Payment
- Renew

Tabs in final product:
- Overview
- Bookings
- Membership
- Payments
- Attendance
- Timeline
- Notes

Sprint 01:
- Overview
- Timeline

Overview:
- contact information
- home branch
- joined date
- status

Timeline:
- created
- profile updated
- branch changed
- status changed

---

# Staff

## `/app/staff`

Table:
- name
- role
- branches
- status
- last login

Primary:
- Invite Staff

Sprint 01 can implement invite scaffolding and role/branch access management.

## `/app/staff/:id`

Sections:
- identity
- role
- branch access
- status
- security
- audit

---

# Leads

## `/app/leads`

Final product:
- list/kanban switch
- New
- Contacted
- Trial Booked
- Trial Completed
- Offer
- Joined
- Lost

Filters:
- branch
- owner
- source
- next follow-up

Not Sprint 01.

---

# Services

## `/app/services`

Table/cards:
- service
- type
- duration
- branch
- price
- public visibility
- status

Primary:
- Add Service

---

# Schedule

## `/app/schedule`

Desktop default:
- weekly calendar

Mobile default:
- agenda

Filters:
- branch
- trainer
- service

Occurrence card:
- time
- service
- trainer
- occupancy
- room

Actions:
- create recurrence
- one-off session
- edit occurrence
- edit future
- cancel
- substitute trainer

---

# Bookings

## `/app/bookings`

Table:
- date/time
- customer
- service
- trainer
- status
- entitlement/payment
- source

Primary:
`+ New Booking`

## `/app/bookings/new`

Desktop:
1. member
2. service/time
3. eligibility/payment
4. confirm

Mobile:
stepper.

Confirmation must display:
- member
- branch
- service
- date/time
- trainer
- price or consumed credit
- cancellation rule

Never visually confirm before server commit.

---

# Memberships

## `/app/memberships`

Tabs:
- Active Memberships
- Plans

Plans list:
- name
- price
- duration/billing
- entitlements
- sold count
- status

---

# Payments

## `/app/payments`

KPI row:
- collected today
- pending
- unmatched
- refunds

Table:
- date
- member
- amount
- method
- provider reference
- allocation
- status

Filters:
- branch
- method
- state
- date

## `/app/payments/unmatched`

Two-pane reconciliation:
- transaction
- member/allocation search

Action:
`Match Payment`

Every manual match is audited.

---

# Attendance

## `/app/attendance`

Reception-first.

Hero control:
`Search name, phone or member number`

Actions:
- Scan Pass
- Today's Classes

Below:
- recent check-ins
- next classes
- exceptions

## `/app/attendance/classes/:occurrenceId`

Roster:
- booked
- checked in
- attended
- no-show

---

# Reports

## `/app/reports`

Cards:
- Revenue
- Memberships
- Attendance
- Occupancy
- Leads

Every report:
- branch
- date range
- timezone/currency context
- export

---

# Website

## `/app/website`

Sections:
- Brand
- Business Profile
- Branches
- Services
- Trainers
- Timetable
- Memberships
- Publish

Custom domain is later.

---

# Settings

## `/app/settings`

Routes:
- Organization
- Branches
- Team & Permissions
- Booking Policies
- Payments
- Notifications
- Integrations
- Security
- Audit

Sprint 01:
- Organization
- Branches
- Team & Permissions
- Security basics

---

# Public Booking Portal

## `/book/:tenantSlug`

- tenant logo/branding
- branch selector
- upcoming availability
- service discovery
- membership CTA

## `/book/:tenantSlug/classes`

Filters:
- branch
- category
- date

## `/book/:tenantSlug/session/:occurrenceId`

- class name
- trainer
- branch
- date/time
- duration
- price
- availability
- cancellation terms
- Book CTA

## `/book/:tenantSlug/checkout`

Minimum customer identification + payment/entitlement + final confirmation.

---

# Member Portal

## `/member`

Dashboard:
- next booking
- membership status
- sessions remaining
- quick booking

Later routes:
```text
/member/bookings
/member/membership
/member/payments
/member/profile
```

---

# Responsive behavior

```text
<640px      compact/mobile
640–1023px  tablet
1024–1439px desktop
1440px+     wide
```

At compact widths:
- nav drawer
- agenda before calendar grid
- cards or prioritized table columns
- sticky bottom action where useful
- no tiny desktop controls

---

# Global screen states

Every production screen explicitly implements:
- loading
- empty
- filtered-empty
- permission denied
- recoverable API failure
- network/offline failure
- destructive confirmation where relevant
- success feedback

---

# Sprint 01 screen list

Must ship:
```text
/login
/onboarding
/app/overview
/app/members
/app/members/new
/app/members/:memberId
/app/staff
/app/settings
/app/settings/organization
/app/settings/branches
/app/settings/branches/new
/app/settings/team
/app/settings/security
```
