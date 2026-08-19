# FITOS Backend and API Architecture

## 1. Architectural Style

Use a modular NestJS application.

Each domain module should contain:
- controller
- application/service layer
- domain rules
- repository abstraction/access
- DTOs
- authorization policy
- events
- tests

Suggested layout:

```text
apps/api/src/
├─ main.ts
├─ app.module.ts
├─ common/
│  ├─ auth/
│  ├─ errors/
│  ├─ logging/
│  ├─ validation/
│  ├─ database/
│  └─ observability/
├─ modules/
│  ├─ identity/
│  ├─ tenancy/
│  ├─ crm/
│  ├─ members/
│  ├─ scheduling/
│  ├─ bookings/
│  ├─ memberships/
│  ├─ attendance/
│  ├─ billing/
│  ├─ payments/
│  ├─ notifications/
│  ├─ staff/
│  ├─ reporting/
│  ├─ websites/
│  ├─ integrations/
│  └─ audit/
└─ jobs/
```

---

## 2. Layer Responsibilities

### Controller
- HTTP concerns
- DTO parsing
- auth context
- status codes
- response serialization

### Application Service
- orchestrates use cases
- transaction boundaries
- permission policy calls
- domain events

### Domain Logic
- business invariants
- state transitions
- calculations
- eligibility

### Repository
- persistence
- tenant-scoped querying
- locking/transaction behavior
- no presentation logic

Do not place entire workflows in controllers.

---

## 3. API Convention

Base:

```text
/api/v1
```

Examples:

```text
GET    /api/v1/members
POST   /api/v1/members
GET    /api/v1/members/:id
PATCH  /api/v1/members/:id

POST   /api/v1/bookings
POST   /api/v1/bookings/:id/cancel
POST   /api/v1/bookings/:id/check-in

POST   /api/v1/payments
POST   /api/v1/payments/:id/refund

GET    /api/v1/reports/revenue
```

Use action endpoints for meaningful domain transitions rather than forcing every behavior into CRUD.

---

## 4. Request Context

Every authenticated request should resolve:
- user ID
- organization/tenant ID
- permitted branch IDs
- selected branch if required
- request/correlation ID
- session ID

Never accept tenant identity solely from arbitrary client input without verifying it against authenticated membership.

---

## 5. Validation

Validate at API boundary.

Validation must cover:
- type
- length
- format
- enum
- presence
- basic cross-field conditions

Business validation belongs in domain/application services:
- booking capacity
- membership eligibility
- credit balance
- refund eligibility
- state transition
- branch access

---

## 6. Error Contract

Standard response:

```json
{
  "error": {
    "code": "BOOKING_CAPACITY_EXCEEDED",
    "message": "This class is already full.",
    "details": {},
    "requestId": "req_..."
  }
}
```

Validation:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields are invalid.",
    "fields": {
      "phone": ["Phone number is invalid."]
    },
    "requestId": "req_..."
  }
}
```

Never return raw stack traces in production.

---

## 7. Status Codes

Use consistently:
- 200 successful read/update/action
- 201 created
- 204 successful no-content delete/transition where useful
- 400 malformed/business input
- 401 unauthenticated
- 403 authenticated but not permitted
- 404 resource absent in permitted tenant scope
- 409 state/capacity/idempotency conflict
- 422 only if team adopts it consistently for semantic validation
- 429 rate limited
- 500 unexpected
- 502/503 integration/upstream unavailable where appropriate

Do not leak whether another tenant’s resource exists. Unauthorized cross-tenant IDs should generally resolve as not found within scope.

---

## 8. Idempotency

Required for:
- payment initiation
- payment callback/webhook
- external booking creation if retryable
- notification webhook processing
- import jobs
- selected mobile/weak-network mutations

Support `Idempotency-Key` where client retries are plausible.

Store:
- tenant
- key
- operation
- request fingerprint if appropriate
- response/result reference
- expiry

---

## 9. Booking Transaction

A booking must be committed atomically.

Pseudo-flow:

```text
begin transaction
load schedule occurrence with lock / concurrency-safe capacity strategy
verify tenant + branch
verify booking window
verify member eligibility
verify capacity
reserve/consume credit if applicable
create booking
create ledger movement if credit consumed
write audit event
commit
emit async notification event
```

The email/WhatsApp notification must not be required for booking transaction success.

---

## 10. Payment Model

Separate:
- payment intent/request
- provider transaction
- internal allocation
- invoice/receipt
- refund

A provider callback is evidence of a payment event, not permission to rewrite unrelated business records.

Payment states must transition through explicit rules.

Persist raw provider event safely where policy permits, with sensitive fields redacted/encrypted as required.

---

## 11. Webhooks

Webhook endpoint requirements:
- provider signature/authentication validation
- idempotency
- minimal synchronous work
- persistence before async processing where possible
- retry-safe processing
- dead-letter or failed-event visibility
- request correlation
- never trust amount/reference solely because endpoint was called

---

## 12. Background Jobs

Use queues for:
- reminders
- renewal notifications
- webhook processing
- receipt generation
- bulk imports
- exports
- scheduled reports
- stale lead follow-ups
- payment reconciliation polling where provider requires it

Job requirements:
- named job type
- schema-versioned payload
- retry policy
- backoff
- idempotency
- dead-letter handling
- observable status

---

## 13. Authentication

Recommended:
- opaque session cookie stored server-side in Redis, or an equivalently revocable session design
- `HttpOnly`
- `Secure`
- appropriate `SameSite`
- session rotation
- short inactivity timeout configurable by risk
- explicit logout/revocation

High-privilege features should support MFA.

Do not store long-lived bearer credentials in browser localStorage as the default authentication model.

---

## 14. Authorization

Authorization is capability-based.

Examples:
- `member:read`
- `member:create`
- `booking:create`
- `booking:cancel`
- `payment:record`
- `payment:refund`
- `report:finance`
- `staff:manage`
- `tenant:settings`

Policy evaluates:
- capability
- tenant
- branch
- ownership/assignment if applicable
- resource sensitivity

---

## 15. OpenAPI

Generate and maintain OpenAPI documentation.

CI should fail if:
- generated client contracts drift unexpectedly
- undocumented endpoints appear where policy requires docs
- breaking API changes are introduced without version strategy

Use API examples for:
- booking conflict
- validation
- payment state
- pagination

---

## 16. Pagination

Use cursor pagination for high-growth event/transaction streams.

Offset pagination is acceptable for low-volume administration lists.

Standard list metadata should be consistent.

Avoid endpoints returning every member/payment in a tenant.

---

## 17. Filtering

Use explicit filters:
```text
?branchId=
?status=
?from=
?to=
?query=
?cursor=
?limit=
```

All filters must be tenant-scoped server-side.

---

## 18. Audit Events

Privileged mutations write append-only audit records:

```text
actor
tenant
branch
action
resourceType
resourceId
beforeSummary
afterSummary
requestId
ip metadata if legally appropriate
timestamp
```

Do not dump secret fields into audit logs.

---

## 19. Rate Limiting

At minimum:
- authentication endpoints
- password reset
- public booking lookup
- public lead forms
- payment initiation
- webhook endpoints based on provider behavior
- exports

Rate limiting must not break legitimate shared-NAT office use. Prefer user/session/tenant-aware strategies after authentication.

---

## 20. API Definition of Done

- tenant scope enforced
- authorization tested
- DTO validation tested
- domain rules tested
- transaction boundary defined
- errors use standard contract
- audit behavior defined
- integration retries defined
- idempotency defined if needed
- OpenAPI updated
- logs contain correlation ID
- no secrets or sensitive payloads logged
