# FITOS Product and Scope Specification

## 1. Product Definition

FITOS is a multi-tenant business operating platform for:

- gyms
- Pilates studios
- yoga studios
- personal-training businesses
- wellness studios
- rehabilitation and physiotherapy-adjacent businesses
- dance studios
- swimming academies
- martial arts studios
- sports and racquet facilities
- multi-service health and fitness businesses

The platform must support appointment-based, class-based, access-based and package-based businesses without forcing all businesses into a conventional gym model.

---

## 2. Primary Personas

### 2.1 Business Owner
Needs:
- revenue visibility
- membership growth
- branch performance
- payment reconciliation
- customer retention indicators
- staff performance
- auditability
- operational control

Owner experience should prioritize summaries, exceptions and actionable signals.

### 2.2 Branch Manager
Needs:
- today’s operations
- classes
- trainer availability
- unresolved payments
- staffing
- attendance
- lead follow-up
- expiring memberships
- branch-level reports

### 2.3 Reception / Front Desk
Needs:
- instant customer lookup
- check-in
- booking
- rescheduling
- membership status
- payment collection
- quick sale
- minimal navigation

This is the highest-throughput UX persona.

### 2.4 Trainer / Coach
Needs:
- schedule
- assigned clients
- class rosters
- client notes
- attendance
- session completion
- permitted progress information
- commission visibility where enabled

### 2.5 Finance
Needs:
- payments
- refunds
- outstanding balances
- invoices/receipts
- reconciliation
- settlement exports
- branch/revenue-category reports
- immutable audit history

### 2.6 Marketing / Sales
Needs:
- leads
- source attribution
- follow-ups
- trial bookings
- campaign tags
- conversion stages
- lost-reason analysis
- reactivation lists

### 2.7 Member / Customer
Needs:
- discover services
- view schedule
- book
- pay
- reschedule/cancel
- manage packages
- renew
- see attendance / sessions remaining
- receive useful reminders

The member should not need ERP knowledge or training.

---

## 3. Core Product Domains

### Acquisition
- tenant website
- service pages
- class timetable
- trainer profiles
- landing pages
- inquiry forms
- lead source tracking

### CRM
- leads
- contacts
- customers
- lifecycle stages
- notes
- tasks
- owner assignment
- communication history
- tags
- source attribution

### Scheduling
- class templates
- recurring schedules
- appointments
- trainer calendars
- resource calendars
- branch rooms
- equipment capacity
- closures and holidays
- exceptions

### Booking
- book
- reschedule
- cancel
- waitlist
- capacity enforcement
- attendance state
- no-show state
- booking source
- eligibility validation
- booking windows

### Memberships
- recurring memberships
- fixed-period plans
- session packs
- class credits
- day passes
- corporate memberships
- family/group plans later
- freezes/pauses later
- upgrades/downgrades later

### Payments
- mobile money
- card through provider adapter
- cash
- bank/manual payment
- invoice
- receipt
- refund
- transaction matching
- reconciliation
- payment allocation

### Attendance
- front-desk search
- QR/member pass
- class roster
- manual check-in
- attendance corrections with audit
- guest/pass handling

### Staff
- users
- trainers
- roles
- branch assignments
- schedules
- commission rules later
- performance metrics later

### Reporting
- revenue
- collections
- outstanding balances
- attendance
- occupancy
- membership base
- renewals
- churn indicators
- lead funnel
- trainer utilization
- branch performance

---

## 4. MVP Scope

The first sellable version must solve real business pain without pretending to be an entire enterprise suite.

### MVP Required
- organization and branch setup
- users and permissions
- CRM contacts/leads/members
- trainer records
- service/class configuration
- schedules
- booking with capacity
- member plans
- session packs
- membership status
- front-desk attendance
- M-Pesa-ready payment integration boundary
- manual cash/bank payment recording
- payment allocation
- basic receipts
- automated reminders architecture
- email/SMS/WhatsApp-ready notification adapter
- dashboard
- operational reports
- tenant-branded booking portal
- audit log
- data export

### MVP Optional if schedule permits
- waitlists
- QR check-in
- custom member fields
- trial conversion workflow
- simple coupons
- membership freeze
- public trainer booking
- basic website page builder

### Post-MVP
- accounting ledger
- payroll
- inventory/POS depth
- corporate wellness reporting
- advanced commissions
- access-control hardware
- advanced workout programming
- nutrition plans
- AI recommendations
- marketplace
- mobile native apps
- multi-country tax/payment packs

---

## 5. Explicit Non-Goals for MVP

Do not build:
- a full accounting replacement
- medical records/EHR
- general-purpose HRIS
- social network
- custom native apps per tenant
- generic no-code website builder
- microservices
- blockchain
- AI features without strong operational value
- a data warehouse before core operational reports are trusted

---

## 6. Product Rules

### 6.1 Business Timezone
Each organization has a default timezone. Each branch may override it. Schedule operations are interpreted in the branch timezone.

Store instants in UTC where an actual moment is represented. Store local date/time plus timezone context when modelling recurring schedules.

### 6.2 Money
A currency is attached to relevant commercial configuration. Never infer currency from UI language.

Use:
- integer minor units where currency supports standard minor units, or
- database decimal/numeric for monetary domain values

Never use JavaScript floating point as the source of truth for money.

### 6.3 Soft Delete
Soft delete operational records only where legally and logically appropriate. Financial records, audit logs and transaction records are never silently removed.

### 6.4 Derived Status
Avoid storing status fields that can be reliably derived unless:
- the state is part of a workflow
- historical state matters
- derivation is expensive
- explicit transitions need audit

### 6.5 Idempotency
Create-payment, webhook, retry and externally triggered operations require idempotency controls.

### 6.6 Race Conditions
Capacity, credits and payments require transactional protection. UI validation alone is insufficient.

---

## 7. Key Success Metrics

Product success:
- time to configure first bookable service
- time to create first member
- time to check in a member
- booking completion rate
- online-payment completion rate
- booking failure rate
- support tickets per active tenant
- percentage of payments auto-matched
- weekly active staff per tenant
- renewal workflow usage

Business outcome metrics:
- lead-to-trial conversion
- trial-to-member conversion
- occupancy
- active membership trend
- renewal rate
- average revenue per active member
- visit frequency
- no-show rate
- customer reactivation rate

---

## 8. Product Quality Bar

Every feature must define:

1. user goal
2. entry points
3. happy path
4. empty state
5. loading state
6. validation state
7. permission state
8. recoverable error state
9. unrecoverable error state
10. audit event
11. analytics event
12. mobile behavior
13. accessibility behavior
14. API behavior
15. tests
16. export/reporting impact
17. integration impact
18. migration impact
