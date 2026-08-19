# FITOS Exact Repository Tree

```text
fitos/
├─ apps/
│  ├─ web/
│  ├─ api/
│  └─ worker/
├─ packages/
│  ├─ ui/
│  ├─ contracts/
│  ├─ shared/
│  ├─ database/
│  ├─ auth/
│  ├─ config/
│  └─ testing/
├─ infra/
│  ├─ docker/
│  ├─ nginx/
│  ├─ scripts/
│  └─ compose/
├─ docs/
│  ├─ adr/
│  ├─ api/
│  └─ runbooks/
├─ .github/workflows/
├─ .env.example
├─ compose.yaml
├─ compose.production.yaml
├─ package.json
├─ package-lock.json
├─ tsconfig.base.json
├─ eslint.config.js
└─ README.md
```

## `apps/web`

```text
apps/web/
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ bootstrap.tsx
│  │  ├─ providers/
│  │  ├─ router/
│  │  └─ shell/
│  ├─ features/
│  │  ├─ auth/
│  │  ├─ onboarding/
│  │  ├─ overview/
│  │  ├─ branches/
│  │  ├─ members/
│  │  ├─ leads/
│  │  ├─ staff/
│  │  ├─ services/
│  │  ├─ schedule/
│  │  ├─ bookings/
│  │  ├─ memberships/
│  │  ├─ payments/
│  │  ├─ attendance/
│  │  ├─ reports/
│  │  ├─ website/
│  │  ├─ settings/
│  │  └─ member-portal/
│  ├─ components/
│  ├─ lib/
│  │  ├─ api/
│  │  ├─ dates/
│  │  ├─ money/
│  │  ├─ phone/
│  │  ├─ permissions/
│  │  └─ telemetry/
│  ├─ styles/
│  ├─ assets/
│  ├─ test/
│  └─ main.tsx
├─ index.html
├─ vite.config.ts
└─ package.json
```

### Feature convention

```text
features/members/
├─ api/
├─ components/
├─ pages/
├─ schemas/
├─ hooks/
├─ utils/
└─ __tests__/
```

Pages orchestrate. Components render. `api/` owns transport. Schemas own client-form parsing. Do not create circular cross-feature imports.

## `apps/api`

```text
apps/api/src/
├─ main.ts
├─ app.module.ts
├─ common/
│  ├─ auth/
│  ├─ decorators/
│  ├─ errors/
│  ├─ filters/
│  ├─ guards/
│  ├─ interceptors/
│  ├─ logging/
│  ├─ pagination/
│  ├─ pipes/
│  ├─ request-context/
│  └─ validation/
├─ modules/
│  ├─ identity/
│  ├─ tenancy/
│  ├─ organizations/
│  ├─ branches/
│  ├─ users/
│  ├─ crm/
│  ├─ members/
│  ├─ staff/
│  ├─ services/
│  ├─ scheduling/
│  ├─ bookings/
│  ├─ memberships/
│  ├─ attendance/
│  ├─ billing/
│  ├─ payments/
│  ├─ notifications/
│  ├─ reports/
│  ├─ websites/
│  ├─ files/
│  ├─ integrations/
│  └─ audit/
├─ health/
└─ config/
```

### Backend module convention

```text
modules/bookings/
├─ bookings.module.ts
├─ bookings.controller.ts
├─ bookings.service.ts
├─ bookings.repository.ts
├─ dto/
├─ domain/
├─ policies/
├─ events/
└─ __tests__/
```

Controllers handle HTTP. Services orchestrate use cases and transactions. Domain objects own business invariants. Repositories own persistence and must be tenant-scoped.

## `apps/worker`

```text
apps/worker/src/
├─ main.ts
├─ worker.module.ts
├─ processors/
│  ├─ notifications.processor.ts
│  ├─ payments.processor.ts
│  ├─ reports.processor.ts
│  └─ imports.processor.ts
└─ schedulers/
   ├─ membership-expiry.scheduler.ts
   └─ booking-reminder.scheduler.ts
```

## `packages`

### `packages/ui`
FITOS design-system primitives only. No feature API fetching.

### `packages/contracts`
DTO contracts, enums, event schemas and stable error codes.

### `packages/database`
Schema, migrations, seeds, database client and migration scripts.

### `packages/shared`
Presentation-independent utilities only.

### Dependency direction

Allowed:
```text
apps/* -> packages/*
api -> database/contracts/shared
web -> ui/contracts/shared
worker -> contracts/database/shared
```

Disallowed:
```text
ui -> web feature
contracts -> database implementation
shared -> feature
api -> web
```
