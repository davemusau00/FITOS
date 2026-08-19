# FITOS Codebase Implementation Specification

This pack converts the FITOS product and engineering guidelines into an executable implementation plan for a production-grade, multi-tenant React web application deployable to a Linux VPS.

## Locked baseline

- React + TypeScript + Vite
- React Router
- TanStack Query
- React Hook Form + Zod
- NestJS + TypeScript REST API
- PostgreSQL
- Redis + background worker
- Docker + Docker Compose
- Nginx
- S3-compatible storage abstraction
- M-Pesa and WhatsApp provider adapters
- modular-monolith backend

## Primary surfaces

1. Admin application
2. Reception/front-desk mode
3. Public tenant booking portal
4. Member self-service portal
5. Platform administration later

## Implementation order

1. Foundation and tenancy
2. Authentication/authorization
3. Branches and staff access
4. CRM/member core
5. Services/scheduling
6. Booking
7. Memberships/credits
8. Payments
9. Attendance
10. Notifications
11. Reporting
12. Public tenant website

## Documents

| File | Purpose |
|---|---|
| `01_REPOSITORY_TREE.md` | Exact monorepo tree and package ownership |
| `02_DATABASE_SCHEMA_ERD.md` | PostgreSQL schema and Mermaid ERD |
| `03_API_ENDPOINT_CATALOGUE.md` | REST API endpoints and error model |
| `04_FRONTEND_ROUTE_SCREEN_MAP.md` | Routes and screen-by-screen UX/UI |
| `05_SHARED_TYPES_EVENTS_PERMISSIONS.md` | Shared enums, events and capabilities |
| `06_SPRINT_01_IMPLEMENTATION.md` | Sprint 01 tickets and acceptance criteria |
| `07_BOOTSTRAP_COMMANDS_ENV.md` | Bootstrap commands, env and deployment layout |
| `08_CODEBASE_CONVENTIONS.md` | Concrete implementation conventions |
| `09_PHASED_DELIVERY_BACKLOG.md` | Backlog after Sprint 01 |
| `10_ACCEPTANCE_TEST_MATRIX.md` | System acceptance matrix |

## Sprint 01 outcome

An owner can deploy FITOS, sign in, configure an organization and branches, manage staff access, create/search/edit members, and see audit history. Tenant A must never be able to read or mutate Tenant B.

Do not begin booking/payment complexity until this spine is stable.
