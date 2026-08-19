# FITOS Sprint 01 Implementation

## Sprint theme

**Foundation + Tenant Core + Member Core**

By the end of Sprint 01:

- repo boots locally
- CI passes
- staging VPS deployment works
- login/session works
- tenant context works
- roles/permissions work
- branch access works
- organization settings work
- members can be created, searched, viewed and edited
- staff access can be inspected/changed
- audit events exist
- database backup and restore are proven

Do not begin booking or payment implementation before these foundations are stable.

---

# Epic A — Repository and Tooling

## FITOS-001 Monorepo Bootstrap

Tasks:
- npm workspaces
- TypeScript base config
- ESLint
- apps/web
- apps/api
- apps/worker
- packages/ui
- packages/contracts
- packages/database
- packages/shared

Acceptance:
```text
npm ci
npm run build
npm run typecheck
npm test
```
work from repository root.

Estimate: 5 points.

## FITOS-002 Local Docker Dependencies

Services:
- PostgreSQL
- Redis

Acceptance:
`docker compose up -d postgres redis` yields healthy services.

Estimate: 3.

---

# Epic B — Database Foundation

## FITOS-003 Migration Framework

Implement migrations for:
- tenants
- branches
- users
- roles
- permissions
- role_permissions
- tenant_users
- user_branch_access
- sessions if DB-backed
- contacts
- members
- audit_events

Acceptance:
- blank DB applies all migrations
- migration status command
- test DB reset
- migration version tracked

Estimate: 8.

## FITOS-004 Permission and Role Seed

Seed stable permissions and default role definitions:
- Owner
- Manager
- Reception
- Trainer
- Finance

Acceptance:
- rerunning seed does not duplicate
- stable permission keys
- tests verify expected baseline

Estimate: 3.

---

# Epic C — Authentication

## FITOS-005 Session Authentication

Implement:
- secure password hashing
- login
- logout
- `/auth/me`
- server-side session state
- secure HttpOnly cookie
- expiry
- revocation
- rotation on authentication

Acceptance:
- valid login works
- invalid login is generic
- logout revokes
- expired session rejected
- no auth token in localStorage

Estimate: 8.

## FITOS-006 Login UI

Route:
`/login`

Acceptance:
- FITOS identity
- responsive
- keyboard-operable
- error/loading states
- authenticated redirect to `/app/overview`

Estimate: 3.

---

# Epic D — Tenant and Authorization Core

## FITOS-007 Request Context

Resolve per authenticated request:
- user
- tenant user
- tenant
- branch access
- permissions
- request ID

Acceptance:
- authenticated controllers receive consistent context
- client cannot switch tenant by changing arbitrary parameter

Estimate: 5.

## FITOS-008 Capability Guard

Implement permission decorator/guard:

```ts
@RequirePermission("member:create")
```

Acceptance:
- missing capability returns 403
- cross-tenant ID does not leak existence
- guard tests

Estimate: 5.

## FITOS-009 Organization API

```text
GET /organization
PATCH /organization
```

Fields:
- name
- timezone
- currency

Acceptance:
- validation
- permission
- audit

Estimate: 3.

## FITOS-010 Branch CRUD API

```text
GET /branches
POST /branches
GET /branches/:id
PATCH /branches/:id
POST /branches/:id/deactivate
```

Acceptance:
- tenant-scoped slug
- branch access
- no destructive historical delete
- audit

Estimate: 5.

## FITOS-011 Organization and Branch UI

Routes:
```text
/app/settings/organization
/app/settings/branches
/app/settings/branches/new
```

Acceptance:
- form validation
- loading/error
- responsive
- permission state
- successful update reflected immediately

Estimate: 5.

---

# Epic E — FITOS Design System and Shell

## FITOS-012 Tokens

Implement semantic tokens based on:
- Energy `#C6FF00`
- Pure `#FFFFFF`
- Steel `#6B6F76`
- Carbon `#121417`
- Jet `#0A0A0A`

Also:
- surfaces
- text hierarchy
- borders
- danger/success/warning/info
- spacing
- radii
- typography
- focus
- motion

Acceptance:
feature code does not hard-code the primary palette.

Estimate: 3.

## FITOS-013 UI Primitives

Sprint 01 subset:
- Button
- IconButton
- Input
- Select
- Checkbox
- FormField
- Alert
- Badge
- StatusBadge
- Modal
- AlertDialog
- Drawer
- Skeleton
- EmptyState
- PageHeader
- DataTable
- SearchBar

Acceptance:
- keyboard accessible
- visible focus
- disabled/loading states
- interactive component tests

Estimate: 8.

## FITOS-014 Admin Shell

Implement:
- side nav
- mobile drawer
- branch switcher
- user menu
- content canvas
- active route

Sprint links:
- Overview
- Members
- Staff
- Settings

Acceptance:
works from 360px through wide desktop.

Estimate: 5.

---

# Epic F — Member Core

## FITOS-015 Contact and Member Repository

Implement tenant-scoped persistence.

Acceptance:
- create/read/list/update
- normalized phone
- tenant filter cannot be omitted
- integration tests

Estimate: 5.

## FITOS-016 Members API

```text
GET /members
POST /members
GET /members/:id
PATCH /members/:id
GET /members/:id/timeline
```

Acceptance:
- name/phone search
- pagination
- branch filter
- validation
- audit create/update
- cross-tenant test

Estimate: 8.

## FITOS-017 Members List UI

Route:
`/app/members`

Acceptance:
- search
- branch filter
- status
- pagination
- loading
- empty
- filtered empty
- row navigation
- mobile presentation

Estimate: 5.

## FITOS-018 Create Member UI

Route:
`/app/members/new`

Fields:
- first name
- last name
- phone
- email
- DOB
- home branch

Acceptance:
- errors mapped to fields
- recoverable failure preserves input
- duplicate warning strategy
- successful create redirects

Estimate: 5.

## FITOS-019 Member Detail UI

Route:
`/app/members/:id`

Sprint tabs:
- Overview
- Timeline

Actions:
- Edit
- Deactivate, permission-gated

Acceptance:
- correct tenant
- status badge
- branch
- joined date
- audit timeline
- loading/error states

Estimate: 5.

---

# Epic G — Staff Access

## FITOS-020 Tenant User List

Return:
- user
- role
- branches
- status
- last login

Estimate: 3.

## FITOS-021 Staff UI

Route:
`/app/staff`

Acceptance:
- role
- branches
- status
- permission-aware actions

Estimate: 3.

## FITOS-022 Role/Branch Access Management

Acceptance:
- owner can change allowed access
- cannot accidentally remove/deactivate the final active owner
- every change audited
- user cannot grant privilege beyond authorization model

Estimate: 8.

---

# Epic H — Audit and Logging

## FITOS-023 Audit Service

Central interface:

```ts
audit.record({
  actor,
  tenantId,
  branchId,
  action,
  resourceType,
  resourceId,
  beforeSummary,
  afterSummary,
  requestId
})
```

Acceptance:
- append-only
- no passwords/tokens/sensitive notes
- transactionally coupled where practical

Estimate: 5.

## FITOS-024 Structured Logging

Production logs:
- JSON
- request ID
- event
- latency
- safe actor/tenant references
- error code

Acceptance:
- no cookie/password/secret leakage

Estimate: 3.

---

# Epic I — Testing

## FITOS-025 Tenant Isolation Suite

Test:
- organization
- branch
- staff
- members

Tenant A must not read/mutate Tenant B even with known UUID.

Estimate: 5.

## FITOS-026 Auth E2E

Test:
- login
- current session
- logout
- expiry
- forbidden route

Estimate: 3.

## FITOS-027 Member E2E

Flow:
login → create member → search → open → update → timeline.

Estimate: 3.

---

# Epic J — CI and Deployment

## FITOS-028 CI

Every PR:
- deterministic install
- format/lint
- typecheck
- unit
- integration
- migration-from-zero
- web build
- API build

Estimate: 5.

## FITOS-029 Production Docker Images

Create:
- web image
- API image
- worker image

Acceptance:
- reproducible
- API/worker non-root where practical
- health-check compatible

Estimate: 5.

## FITOS-030 Staging VPS

Install/configure:
- Docker
- Compose
- Nginx
- HTTPS
- production-like secrets
- PostgreSQL
- Redis

Acceptance:
- public HTTPS staging URL
- login works
- member flow works
- readiness passes

Estimate: 8.

---

# Epic K — Backup and Restore

## FITOS-031 Database Backup

Acceptance:
- timestamp
- compression
- failure exit code
- off-server destination abstraction
- documented retention

Estimate: 3.

## FITOS-032 Restore Drill

Acceptance:
- restore into clean DB
- login
- verify tenant
- verify branch
- verify member
- document elapsed restore procedure

Estimate: 3.

---

# Recommended execution order

```text
001 → 002 → 003 → 004
          ↓
005 → 006
↓
007 → 008
↓
009 → 010 → 011
↓
012 → 013 → 014
↓
015 → 016 → 017 → 018 → 019
↓
020 → 021 → 022
↓
023 → 024
↓
025 → 026 → 027
↓
028 → 029 → 030
↓
031 → 032
```

Frontend and backend tasks can run in parallel once request/response contracts are frozen.

---

# Sprint 01 exit criteria

All must be true:

- CI green
- staging deployed over HTTPS
- two demo tenants
- separate branches and members
- cross-tenant IDs rejected
- owner login/session/logout works
- member CRUD works desktop and compact mobile
- staff role/branch changes audited
- no P0/P1 bug
- production-style Docker images built
- DB backup created
- backup restored successfully
- release tag identifies deployed commit
