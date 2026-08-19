# FITOS Frontend React Architecture

## 1. Goals

The web application must be:
- fast
- type-safe
- modular
- permission-aware
- testable
- responsive
- accessible
- resilient to slow networks
- easy to deploy as static production assets behind Nginx

Use React as the view layer and keep API/domain truth on the server.

---

## 2. Application Structure

```text
apps/web/src/
├─ app/
│  ├─ providers/
│  ├─ router/
│  ├─ auth/
│  ├─ query/
│  └─ bootstrap/
├─ features/
│  ├─ bookings/
│  ├─ members/
│  ├─ crm/
│  ├─ memberships/
│  ├─ payments/
│  ├─ attendance/
│  ├─ schedule/
│  ├─ staff/
│  ├─ reports/
│  └─ settings/
├─ components/
│  ├─ layout/
│  └─ domain-shared/
├─ lib/
│  ├─ api/
│  ├─ dates/
│  ├─ money/
│  ├─ permissions/
│  └─ telemetry/
├─ styles/
├─ assets/
└─ main.tsx
```

Feature folders own their routes, components, hooks, schemas and tests.

Do not create a single global `components` folder containing hundreds of unrelated domain components.

---

## 3. Routing

Use route-based code splitting for major modules.

Recommended route shape:

```text
/app
/app/overview
/app/members
/app/members/:memberId
/app/leads
/app/bookings
/app/schedule
/app/memberships
/app/payments
/app/attendance
/app/staff
/app/reports
/app/website
/app/settings

/book/:tenantSlug
/book/:tenantSlug/service/:serviceSlug
/member
/member/bookings
/member/membership
/member/payments
```

### Route Rules
- authentication gate at application shell
- permission gate at route and component action level
- server remains authoritative
- branch context encoded in application state and, where useful, query string
- filters that users may share/bookmark belong in URL search params
- modals that represent navigable records may use route-backed overlays

---

## 4. Server State

Use TanStack Query or equivalent for:
- fetching
- caching
- invalidation
- background refetch
- mutation lifecycle
- retry strategy

Do not mirror server entities into a large global state store.

### Query Keys

Centralize factories:

```ts
members.keys.all(tenantId)
members.keys.list(tenantId, branchId, filters)
members.keys.detail(tenantId, memberId)
```

Tenant and branch context must be present in cache identity where relevant.

### Retry
Do not retry:
- 400 validation
- 401 unauthenticated
- 403 forbidden
- 404 domain absence unless expected eventual consistency
- deterministic payment/business-rule failures

Retry network/5xx reads with bounded exponential backoff.

---

## 5. Client State

Use local component state by default.

Use a small state store only for:
- shell state
- command palette
- branch context
- temporary unsaved multi-step workflow state
- feature flags hydrated from server if needed

Never use global state as a second database.

---

## 6. API Client

All API access goes through a typed client layer.

```text
lib/api/
├─ client.ts
├─ errors.ts
├─ auth.ts
└─ generated-or-contracts/
```

Requirements:
- base URL from environment
- credentials/cookies configured centrally
- request ID correlation
- typed error parsing
- cancellation through AbortSignal
- no raw `fetch()` scattered across components

---

## 7. Forms

Use schema-based validation shared conceptually with API constraints.

Client validation improves UX but is not security.

Pattern:
1. form schema
2. default values
3. UI validation
4. server submission
5. map field errors
6. map global/domain errors
7. invalidate affected queries
8. navigate or confirm success

For monetary and quantity fields, convert display strings to domain-safe values explicitly.

---

## 8. Permissions

Frontend permission utilities improve experience but never replace API authorization.

Example:

```ts
can(user, "booking:create", { branchId })
can(user, "payment:refund", { branchId })
```

Use permissions to:
- hide actions user cannot perform
- disable actions when context is insufficient
- explain why an action is unavailable

Avoid role-name checks such as `if role === "ADMIN"` throughout UI. Check capabilities.

---

## 9. Dates and Time

Rules:
- API transmits ISO timestamps with timezone/UTC semantics
- recurring schedule payloads carry timezone-aware local schedule definitions
- frontend formats using organization/branch timezone
- never parse ambiguous locale date strings
- never store `new Date().toString()` as business data

Calendar views must handle daylight saving correctly even if Kenya does not use DST because FITOS may expand.

---

## 10. Money

Create a Money formatter utility.

```ts
formatMoney({ amountMinor: 1250000, currency: "KES" })
```

Do not:
- append `"Ksh"` ad hoc
- call `.toFixed()` on floating business values
- assume two minor digits for every currency

---

## 11. Component Boundaries

### Presentational Components
Receive data and callbacks.

### Feature Components
Know feature behavior.

### Page Components
Coordinate route, data dependencies and high-level layout.

### API Layer
Knows transport.

Do not make UI primitives fetch data.

---

## 12. Error Handling

Define typed frontend errors:
- ValidationError
- AuthenticationError
- AuthorizationError
- NotFoundError
- ConflictError
- RateLimitError
- IntegrationError
- UnexpectedError

Use route error boundaries for catastrophic view failures.

Mutation errors should preserve form state.

Unexpected errors should display a support reference/correlation ID.

---

## 13. Performance

Required:
- route code splitting
- image optimization
- lazy heavy charts/calendars
- virtualize only genuinely large lists
- prevent unnecessary request waterfalls
- use optimistic UI only when rollback semantics are clear
- debounced server search
- do not ship entire icon libraries
- profile before memoizing everything

Performance budgets:
- keep initial admin shell lean
- keep member booking experience especially small
- avoid sending large reference datasets on boot
- paginate server-side

---

## 14. Offline and Weak-Network Behavior

FITOS is not fully offline-first in MVP.

It must nevertheless:
- show connectivity failures clearly
- retain unsent form data locally for safe long forms where practical
- not falsely confirm bookings or payments offline
- gracefully retry idempotent reads
- avoid duplicate mutations after reconnect
- expose last-refreshed time on critical operational screens if stale data is possible

---

## 15. Styling Strategy

Use design tokens as CSS custom properties.

Feature components consume semantic tokens:
- `--color-action-primary`
- `--color-surface-raised`
- `--color-text-muted`

not raw brand hex values.

Keep:
- global reset
- token definitions
- typography
- motion
- utilities

in predictable layers.

---

## 16. Testing

Frontend:
- unit tests for pure utilities
- component tests for forms/permissions/status
- route integration tests
- E2E for critical journeys
- visual regression for core shells/components

Critical E2E:
- login
- create member
- create booking
- capacity conflict
- check-in
- payment record
- plan activation
- cancellation
- permission denial
- tenant isolation scenario

---

## 17. Build and Environment

Vite production output should be treated as immutable static assets.

Public environment variables prefixed for the client are not secrets.

Never place:
- API secrets
- database credentials
- payment credentials
- private signing keys

inside the frontend environment.

Nginx should serve the built SPA and route application paths to `index.html`, while `/api/` is proxied to the backend.

---

## 18. Frontend Definition of Done

A feature is not complete until:
- types compile
- lint passes
- tests pass
- no console errors
- responsive states reviewed
- keyboard path reviewed
- loading/empty/error states implemented
- permissions reflected
- analytics event defined if applicable
- API errors handled
- no tenant-sensitive data cached under a non-tenant query key
