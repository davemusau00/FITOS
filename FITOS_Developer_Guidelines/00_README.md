# FITOS Developer Guidelines
## Fitness Operating System

**Document set purpose:** This folder is the authoritative engineering handoff for building FITOS as a production-grade, multi-tenant fitness-business operating system.

**Primary deployment target:** A Linux VPS using Docker Compose and Nginx.

**Primary application shape:** React + TypeScript single-page web application backed by a Node.js/NestJS API, PostgreSQL, and Redis.

**Product principle:** Build a polished fitness product first and an ERP second. The user should feel speed, clarity, energy, confidence, and control. Administration must feel lighter after using FITOS, never heavier.

---

## 1. Product North Star

FITOS exists to replace fragmented fitness-business operations:

- WhatsApp booking threads
- manual M-Pesa reconciliation
- paper attendance registers
- Google Sheets membership lists
- disconnected trainers and schedules
- forgotten leads
- manual renewal reminders
- inconsistent reporting
- duplicate customer records
- separate website and booking tools

with one connected operating system.

### Core customer promise

> **Bookings. Members. Payments. Growth. One FITOS.**

### Product hierarchy

1. **Acquire** customers through a branded public web presence.
2. **Convert** them through fast booking, joining, and payment.
3. **Operate** the business through scheduling, memberships, staff, attendance, payments, and CRM.
4. **Retain** members through automated communication and customer intelligence.
5. **Understand** the business through reporting and operational analytics.
6. **Scale** into multiple branches, teams, and service lines.

---

## 2. Document Index

| File | Purpose |
|---|---|
| `01_PRODUCT_AND_SCOPE.md` | Product requirements, personas, scope, non-goals and platform principles |
| `02_UX_UI_DESIGN_SYSTEM.md` | FITOS experience principles, visual system, components, responsive behavior and accessibility |
| `03_FRONTEND_REACT_ARCHITECTURE.md` | React architecture, routing, state, data fetching, forms, permissions and frontend conventions |
| `04_BACKEND_API_ARCHITECTURE.md` | NestJS architecture, API standards, domain services, jobs, webhooks and error handling |
| `05_DATA_MODEL_MULTI_TENANCY.md` | PostgreSQL model, tenant isolation, core entities, constraints and audit strategy |
| `06_FEATURE_MODULE_SPECIFICATIONS.md` | Functional requirements for bookings, CRM, memberships, payments, attendance, websites and reporting |
| `07_SECURITY_PRIVACY_COMPLIANCE.md` | Authentication, authorization, sensitive data, OWASP baseline, logs and privacy-by-design |
| `08_TESTING_QA_OBSERVABILITY.md` | Unit, integration, E2E, performance, visual QA, logs, metrics, alerts and release gates |
| `09_DEVOPS_VPS_DEPLOYMENT.md` | Docker, Nginx, VPS, backups, SSL, deployment, rollback and disaster recovery |
| `10_ENGINEERING_STANDARDS_GIT_CI.md` | Code standards, Git workflow, CI quality gates, reviews and dependency governance |
| `11_IMPLEMENTATION_ROADMAP_ACCEPTANCE.md` | Delivery phases, milestone definitions and acceptance criteria |
| `12_ENV_CONFIG_INTEGRATIONS.md` | Environments, secrets, M-Pesa, WhatsApp, email, object storage and integration boundaries |
| `13_DEVELOPER_EXECUTION_CHECKLIST.md` | Day-to-day implementation checklist and definition of done |
| `14_TECHNICAL_REFERENCE_SNAPSHOT.md` | Technology decisions and official reference snapshot used for this guideline set |

---

## 3. Architectural Position

FITOS should begin as a **modular monolith**, not microservices.

A modular monolith provides:

- one deployable backend
- one primary relational database
- transactional integrity across bookings, payments, memberships and attendance
- lower DevOps overhead
- easier debugging
- simpler local development
- a clean path to split high-load modules later if evidence requires it

Domain boundaries must nevertheless be explicit so that future extraction is possible.

Recommended backend modules:

- Identity
- Tenancy
- Organizations
- Branches
- CRM
- Members
- Staff
- Scheduling
- Bookings
- Memberships
- Attendance
- Billing
- Payments
- Notifications
- Websites
- Reporting
- Integrations
- Audit
- Files

---

## 4. Repository Shape

```text
fitos/
├─ apps/
│  ├─ web/                  # React + Vite frontend
│  └─ api/                  # NestJS API
├─ packages/
│  ├─ ui/                   # FITOS design system components
│  ├─ shared/               # shared TypeScript types and utilities
│  ├─ contracts/            # API DTO contracts / generated client types
│  └─ config/               # lint, TypeScript, test config
├─ infra/
│  ├─ nginx/
│  ├─ docker/
│  └─ scripts/
├─ docs/
├─ compose.yaml
├─ compose.production.yaml
├─ package.json
└─ README.md
```

Do not share arbitrary business logic between client and server merely because both use TypeScript. Shared packages should contain contracts, schemas, safe enums and presentation-independent utilities.

---

## 5. Recommended Stack

### Web
- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- FITOS internal UI component package
- CSS variables/design tokens with utility classes or scoped CSS
- lightweight local state only where server state is inappropriate

### API
- Node.js LTS
- NestJS
- TypeScript
- REST
- OpenAPI
- PostgreSQL
- ORM with explicit migrations
- Redis for queues, sessions, cache and distributed locking where required
- background jobs for notifications, webhook retries and scheduled operational work

### Infrastructure
- Docker
- Docker Compose
- Nginx
- Linux VPS
- automated encrypted database backups
- TLS certificates
- centralized application logs
- uptime/health monitoring

---

## 6. Non-Negotiables

1. Multi-tenant isolation must be designed before the first business table.
2. Permissions must be checked server-side, not only hidden in the UI.
3. Payment callbacks must be idempotent.
4. Bookings must be protected against capacity race conditions.
5. Monetary values must use integer minor units or a fixed-precision decimal strategy, never binary floating-point.
6. Dates must be stored consistently and displayed in the business timezone.
7. Every tenant-owned record must be traceable to its tenant.
8. Every privileged mutation must be auditable.
9. Production secrets must never be committed.
10. `vite preview` is never a production server.
11. Production database changes must occur through reviewed migrations.
12. No direct database access from the browser.
13. Sensitive health-related information must be optional, access-controlled and minimized.
14. Destructive actions must have confirmation and, where practical, reversible states.
15. The application must remain usable at mobile reception-desk widths and common laptop widths.

---

## 7. Definition of “World-Class” for FITOS

World-class does not mean more animation or more features.

It means:

- an owner understands the dashboard within seconds
- reception can check in a member while speaking to them
- booking cannot accidentally overfill a class
- the product is fast on ordinary mobile networks
- keyboard users can operate core workflows
- loading, empty, error and permission states are designed
- data cannot leak between tenants
- payment states are explicit and reconcilable
- reports agree with underlying transactions
- deployments can be rolled back
- backups are tested, not merely configured
- developers can understand why a module exists and how it is allowed to interact with others

Treat these documents as product constraints, not suggestions.
