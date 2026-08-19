# FITOS Data Model and Multi-Tenancy Guidelines

## 1. Database

Primary store: PostgreSQL.

Use relational integrity deliberately. FITOS business truth is highly relational:
members, bookings, schedules, memberships, payments, attendance and branches must agree.

---

## 2. Tenant Strategy

Use shared database + shared schema with mandatory `tenant_id` on every tenant-owned table.

Advantages:
- simple deployment
- efficient resource use
- easy cross-tenant platform operations when explicitly authorized
- manageable migrations

Risks:
- accidental unscoped query

Mitigations:
- repository scoping
- explicit request context
- composite constraints
- automated tenant-isolation tests
- code review rules
- optional PostgreSQL Row-Level Security for defense in depth as product matures

---

## 3. Tenant-Owned Base Fields

Most business tables:

```text
id
tenant_id
branch_id?      # nullable only if truly organization-wide
created_at
updated_at
created_by?
updated_by?
```

Use globally unique IDs.

Never use a human-readable membership number as the primary key.

---

## 4. Core Entity Map

### Platform
- tenants
- tenant_settings
- branches
- branch_settings

### Identity
- users
- sessions
- tenant_users
- roles
- permissions
- role_permissions
- user_branch_access

### CRM
- contacts
- contact_channels
- leads
- lead_events
- lead_tasks
- tags
- contact_tags
- notes

### Members
- members
- member_profiles
- member_preferences
- member_emergency_contacts
- member_consents
- member_custom_fields

### Staff
- staff
- trainers
- staff_branch_assignments
- trainer_specialties

### Services/Scheduling
- services
- service_categories
- resources
- rooms
- schedule_templates
- schedule_occurrences
- schedule_exceptions
- trainer_availability

### Booking
- bookings
- booking_participants
- waitlist_entries
- booking_status_events

### Membership
- membership_plans
- plan_entitlements
- member_memberships
- session_packs
- credit_ledger

### Attendance
- checkins
- attendance_events

### Billing
- customers_billing_profiles
- invoices
- invoice_items
- receipts

### Payments
- payment_intents
- provider_transactions
- payment_allocations
- refunds
- payment_webhook_events

### Communication
- notification_templates
- notification_jobs
- communication_events
- consent_preferences

### Website
- public_profiles
- public_services
- public_pages
- branding_settings
- domains

### Audit
- audit_events

### Files
- files
- file_links

---

## 5. Contact vs Member

A person can exist as a lead/contact before becoming a member.

Recommended model:

`contacts`
- identity/contact information

`members`
- fitness-business member relationship

A member references a contact.

This avoids duplicate person records when a lead converts.

Do not use email as uniqueness across the platform. Many customers:
- share email
- lack email
- change email

Phone numbers should be normalized but uniqueness requirements must be tenant-configurable and carefully scoped.

---

## 6. Phone Normalization

Store:
- raw input optionally for audit/migration
- normalized E.164 where valid
- country code
- verification state if verification exists

Kenya-oriented UX may default country selection but data model must remain international.

---

## 7. Schedule Model

Separate recurring intent from actual occurrence.

### Schedule Template
Example:
- Reformer Pilates
- every Tuesday and Thursday
- 18:00
- Africa/Nairobi
- trainer A
- room 2
- capacity 12

### Occurrence
Concrete:
- 2026-08-20T15:00:00Z
- capacity 12
- trainer A
- status scheduled

Occurrences may be materialized ahead of time to simplify booking and exceptions.

Never mutate the historical past when editing a recurrence. Apply changes from an effective date.

---

## 8. Capacity

Capacity may be constrained by:
- service limit
- room
- equipment count
- trainer
- explicit occurrence override

The final bookable capacity should be computed from configured constraints and materialized/validated transactionally.

A booking is counted only in states that reserve capacity.

---

## 9. Membership Entitlements

Do not hard-code “monthly unlimited” logic.

Represent entitlements:
- unlimited access to service category
- N credits
- N visits
- branch access
- booking priority
- booking window
- discount
- trainer-specific entitlement

Keep the first implementation simple but choose a model that can grow.

---

## 10. Credit Ledger

Session-pack credits should use a ledger:

```text
+10 package purchase
-1 booking consumption
+1 cancellation restoration
-1 manual adjustment
```

Ledger advantages:
- auditability
- correct reconstruction
- fewer mysterious “remaining sessions” bugs

Current balance may be cached/materialized but ledger is the authoritative history.

---

## 11. Membership Status

Store explicit workflow state plus dates:
- starts_at
- ends_at
- status
- paused_at?
- cancelled_at?

An “active” query must also respect dates and entitlement rules.

Do not rely only on a manually edited status field.

---

## 12. Payments

Recommended separation:

### payment_intents
The business request to collect money.

### provider_transactions
Provider-specific transaction records.

### payment_allocations
How successful money is applied:
- membership
- booking
- invoice
- wallet/credit

### refunds
Money returned.

This supports reconciliation when one payment covers multiple items or when a payment arrives unmatched.

---

## 13. Money Columns

Preferred PostgreSQL:
- `numeric` for decimal domain values, or
- integer minor units if application standardizes this fully

If minor units:
```text
amount_minor BIGINT
currency CHAR/VARCHAR ISO code
```

Never `FLOAT` for money.

---

## 14. Audit

Audit record should be append-only.

Avoid storing complete before/after objects containing:
- passwords
- tokens
- payment secrets
- unnecessary sensitive health data

Use:
- changed fields
- safe summaries
- protected encrypted detail only if a legitimate requirement exists

---

## 15. Sensitive Health-Adjacent Data

Fitness assessments, injuries and measurements can become sensitive.

Separate optional sensitive tables/fields from routine CRM data so access can be more restrictive.

Examples:
- assessment_profiles
- injury_notes
- measurements
- progress_records

Capabilities:
- `assessment:read`
- `assessment:write`

Do not allow reception roles by default.

Retention rules should be configurable.

---

## 16. Index Strategy

Index:
- tenant_id + common filter
- tenant_id + branch_id + status
- booking occurrence
- normalized phone
- membership member + status/date
- payments external provider reference
- webhook idempotency/provider event ID
- audit tenant + timestamp
- schedule occurrence start time

Review indexes from real query plans, not intuition alone.

---

## 17. Unique Constraints

Scope uniqueness correctly:

```text
unique(tenant_id, slug)
unique(tenant_id, branch_id, member_number)
unique(provider, provider_transaction_id) # if globally guaranteed
unique(tenant_id, idempotency_key, operation)
```

Avoid a global `unique(phone)`.

---

## 18. Foreign Keys

Use foreign keys for core integrity.

Choose delete rules explicitly:
- restrict for financial history
- cascade for true child configuration
- set null for optional historical actor references where appropriate

Avoid universal cascading deletes.

---

## 19. Migrations

Rules:
- migrations committed to source control
- immutable after production application
- reviewed in PR
- backward-compatible where zero-downtime deploy requires it
- large backfills separated from schema change when necessary
- migration tested against production-like database volume

Never manually “fix prod schema” without recording the equivalent migration.

---

## 20. Backups

Database design is incomplete without recovery.

Production must support:
- scheduled backup
- encrypted off-server copy
- retention policy
- restoration test
- documented RPO/RTO

A backup that has never been restored is an assumption.
