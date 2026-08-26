# FITOS Role Surfaces and Authentication Architecture

**Status:** Approved product architecture for the next UX/auth sprint  
**Scope:** Role-specific shells, workspaces, routing, authentication journeys, and dashboard selection  
**Constraint:** One FITOS modular monolith and one shared data model; multiple purpose-built operating environments

## Product principle

FITOS must not become one universal ERP dashboard with cards hidden by permissions. It should be the same operating system viewed through different cockpits:

| Surface          | Primary user           | Core question                                      |
| ---------------- | ---------------------- | -------------------------------------------------- |
| FITOS Command    | Owner / founder        | How is my business doing?                          |
| FITOS Ops        | Manager                | What needs attention today?                        |
| FITOS Front Desk | Reception              | Who is here, who is coming, and what do they need? |
| FITOS Coach      | Trainer / practitioner | Who am I training today?                           |
| FITOS Practice   | Therapist / assessor   | Which appointments and records need care?          |
| FITOS Member     | Customer               | What can I book and what do I have?                |
| FITOS Platform   | FITOS administrator    | Is the SaaS itself healthy?                        |

These surfaces share contracts, tenancy, branch context, permissions, notifications, and design tokens. They do not share navigation, density, default landing page, or primary workflow.

## Surface contracts

### FITOS Command

Route: `/app/*`, default for owners and founders.

The home screen is an executive view: active members, acquisition, retention, expected visits, bookings, exceptions, and trends. It should answer business questions within five seconds and keep reception-level actions secondary.

Navigation groups:

```text
COMMAND       Overview, Insights
OPERATIONS    Schedule, Bookings, Attendance
PEOPLE        Members, CRM, Memberships, Team
BUSINESS      Services, Equipment, Inventory
GROWTH        Automations, Sites
SYSTEM        Branches, Organization, Security, Subscription
```

### FITOS Ops

Route: `/ops/*`, default for managers.

The home screen is a six-hour operations board: sessions today, expected arrivals, checked-in members, near-capacity sessions, staff on duty, overdue follow-ups, current session, next sessions, and operational alerts.

Quick actions are `Book Member`, `Add Walk-In`, `Create Session`, `Add Member`, and `Open Front Desk`.

### FITOS Front Desk

Route: `/reception/*`, with `/reception` as the default landing page.

Use a minimal shell, large touch targets, prominent search, keyboard navigation, arriving-now sessions, recent arrivals, and context-aware actions for check-in, booking, membership, walk-in, and upcoming bookings. Do not show analytics, CRM pipelines, site configuration, or inventory by default.

### FITOS Coach

Route: `/coach/*`, default for trainers and coaches.

The primary entity is the assigned session. The home screen is `My Day`, showing classes, PT appointments, assessments, rosters, arrival status, member membership state, permitted assessment information, notes, programs, and restrictions.

Navigation:

```text
MY DAY        Schedule, Members, Assessments, Programs / Notes
PROFILE       Availability, My Performance, Account
```

### FITOS Practice

Route: `/practice/*`, default for therapists and assessment practitioners.

Prioritize appointments, clients, assessments, treatment notes, follow-ups, and schedule. This surface must respect specialized permissions and credentials and must not expose owner analytics, payroll, subscriptions, or global CRM by default.

### FITOS Member

Route: `/member/*` or tenant-aware `/:tenantSlug/member`.

Use the dedicated member session and a consumer-oriented mobile shell. Navigation is `Home`, `Book`, `My Schedule`, `Membership`, and `Profile`, with bottom navigation on mobile. Avoid admin tables and SaaS terminology.

### FITOS Platform

Route: `/platform/*`, with separate `/platform/login`.

This is a platform-admin application surface, not a tenant dashboard module. It reports tenant counts, SaaS activity, API/worker/queue health, implementation pipeline, subscriptions, feature flags, audit, and support metadata. Opening a tenant must not grant private operational access without an explicit, audited support-access action.

## Authentication and route boundaries

Authentication mode and product surface are separate concerns:

```text
public     -> marketing, signup, public tenant sites
tenant     -> staff tenant session and branch-scoped APIs
member     -> dedicated member session and member-scoped APIs
platform   -> opaque platform token and platform-admin APIs
```

Canonical routes:

```text
PUBLIC          /, /configure, /signup, /:tenantSlug
STAFF AUTH      /login, /forgot-password, /reset-password/:token, /invite/:token
OWNER           /app/*
MANAGER         /ops/*
RECEPTION       /reception/*
COACH           /coach/*
PRACTICE        /practice/*
MEMBER          /member/login, /member/*, /:tenantSlug/member/*
PLATFORM        /platform/login, /platform/*
```

Staff login remains `/login`; member and platform authentication must never be routed through it. Platform authentication must not require `fitos_session`. The backend remains authoritative for all permissions regardless of the selected shell.

Authentication failures have distinct UX:

- `401`: session-expired screen preserving the intended route.
- `403`: explicit unauthorized screen with an administrator/support explanation.
- `404`: missing or tenant-concealed resource.

## Server-resolved workspace selection

Staff `/auth/me` should evolve toward:

```ts
interface StaffIdentity {
  user: UserResponse;
  tenant: TenantSummary;
  roles: RoleResponse[];
  permissions: PermissionKey[];
  branchIds: string[];
  defaultWorkspace: "owner" | "ops" | "reception" | "coach" | "practice";
  availableWorkspaces: Array<"owner" | "ops" | "reception" | "coach" | "practice">;
}
```

Workspace selection is a UX decision derived from server-resolved roles, assignments, and capabilities. It is not a security decision. A multi-role user can switch workspace without logging out; every API request still uses the tenant session, active branch context, and server-side permission checks.

Recommended default precedence:

1. Persisted workspace if it remains available.
2. Server-provided `defaultWorkspace`.
3. Role-specific safe fallback: owner → Command, manager → Ops, reception → Front Desk, trainer → Coach, practitioner → Practice.
4. Explicit unauthorized state if no workspace is available.

Owners who are also trainers should see a workspace switcher such as `Owner Workspace` and `Trainer Workspace`, not a second login.

## Role-specific onboarding

Onboarding content follows the selected workspace:

| User           | First-login tasks                                           |
| -------------- | ----------------------------------------------------------- |
| Owner          | Business, services, schedule, team, members, public booking |
| Manager        | Review today, branch operations, alerts, follow-ups         |
| Reception      | Search, check-in, booking, walk-ins                         |
| Coach          | Profile, availability, assigned sessions, rosters           |
| Practitioner   | Availability, client records, assessment/treatment notes    |
| Member         | Contact confirmation, membership, first booking             |
| Platform admin | Platform health, implementation queue, support policy       |

Do not show irrelevant setup tasks to a user merely because the tenant has that feature.

## Shared data lenses

The same booking is intentionally represented differently by each surface:

```text
Command:     92 bookings today
Ops:         18:00 Pilates — 11 / 12 booked
Front Desk:  Amina Njeri — 18:00 Pilates — Expected
Coach:       Amina Njeri — Booked — Not arrived
Member:      Pilates Foundations — Today 18:00 — Booked
```

This is not duplicated domain data. It is separate read-model presentation over shared, tenant-safe contracts.

## Implementation sequence

1. Finish P0 auth-mode separation, platform token lifecycle, member boundary, and branch context.
2. Add workspace metadata to staff identity and define canonical workspace keys in shared contracts.
3. Extract the existing shell into shared layout primitives plus surface-specific shells.
4. Add server-selected redirects and explicit session-expired/unauthorized routes.
5. Build Ops, Front Desk, Coach, Practice, and Platform landing read models around existing domain data.
6. Move feature navigation into surface manifests; retain permission checks as backend security and client affordance checks.
7. Add workspace-switching for multi-role users and persist the selected workspace safely.
8. Add role-specific onboarding and route-level E2E coverage.

Do not create separate deployments or a second backend. Do not make role shells a reason to duplicate business rules, booking logic, branch selection, or authorization.

## Acceptance criteria

- Each supported role lands on its own shell and primary question.
- Owners, managers, receptionists, coaches, practitioners, members, and platform administrators never receive an irrelevant universal dashboard by default.
- A multi-role staff user can switch workspaces without a second login.
- Server-side authorization remains independent of route or workspace selection.
- Tenant and branch isolation applies identically across every surface.
- Member and platform authentication remain separate from staff tenant sessions.
- Mobile member and Front Desk workflows do not use squeezed admin tables.
- Session expiry preserves destination; unauthorized access explains the missing permission.
- Golden-path and adversarial E2E suites cover at least Command, Front Desk, Coach, Member, and Platform boundaries.
