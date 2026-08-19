# FITOS API Endpoint Catalogue

Base: `/api/v1`

All authenticated endpoints derive tenant context from the authenticated session. Client-provided tenant IDs are never sufficient authorization.

## Authentication

### `POST /auth/login`
Request:
```json
{"email":"owner@example.com","password":"..."}
```

Returns user/tenant summaries and sets secure session cookie.

Errors:
```text
INVALID_CREDENTIALS
ACCOUNT_DISABLED
RATE_LIMITED
```

### `POST /auth/logout`
Revokes current session.

### `GET /auth/me`
Returns:
```json
{
  "user": {},
  "tenant": {},
  "branches": [],
  "permissions": []
}
```

## Organization

### `GET /organization`
Permission: `tenant:read`

### `PATCH /organization`
Permission: `tenant:settings`

## Branches

```text
GET    /branches
POST   /branches
GET    /branches/:branchId
PATCH  /branches/:branchId
POST   /branches/:branchId/deactivate
```

Permissions:
```text
branch:read
branch:create
branch:update
branch:deactivate
```

## Staff access

```text
GET   /users
POST  /users/invitations
PATCH /users/:userId/access
POST  /users/:userId/deactivate
```

Invitation payload:
```json
{
  "email": "trainer@example.com",
  "roleId": "uuid",
  "branchIds": ["uuid"]
}
```

Permission: `staff:manage`

## Contacts

```text
GET   /contacts
POST  /contacts
GET   /contacts/:contactId
PATCH /contacts/:contactId
```

Search:
```text
?query=&branchId=&cursor=&limit=
```

## Leads

```text
GET   /leads
POST  /leads
GET   /leads/:leadId
PATCH /leads/:leadId
POST  /leads/:leadId/stage
POST  /leads/:leadId/convert
```

## Members

```text
GET   /members
POST  /members
GET   /members/:memberId
PATCH /members/:memberId
GET   /members/:memberId/timeline
GET   /members/:memberId/memberships
GET   /members/:memberId/bookings
GET   /members/:memberId/payments
```

Create:
```json
{
  "contact": {
    "firstName": "Jane",
    "lastName": "Doe",
    "phone": "+254...",
    "email": null,
    "dateOfBirth": null
  },
  "homeBranchId": "uuid"
}
```

List filters:
```text
?query=
?status=
?branchId=
?membershipStatus=
?cursor=
?limit=
```

## Staff records

```text
GET   /staff
POST  /staff
GET   /staff/:staffId
PATCH /staff/:staffId
PUT   /staff/:staffId/branches
```

## Services

```text
GET  /services
POST /services
GET  /services/:serviceId
PATCH /services/:serviceId
POST /services/:serviceId/deactivate
```

## Schedule

```text
GET   /schedule/occurrences
POST  /schedule/templates
PATCH /schedule/templates/:templateId
POST  /schedule/occurrences
PATCH /schedule/occurrences/:occurrenceId
POST  /schedule/occurrences/:occurrenceId/cancel
```

Schedule query:
```text
?branchId=&from=&to=&trainerId=&serviceId=
```

## Bookings

```text
GET  /bookings
POST /bookings
GET  /bookings/:bookingId
POST /bookings/:bookingId/cancel
POST /bookings/:bookingId/reschedule
POST /bookings/:bookingId/check-in
```

Create:
```json
{
  "occurrenceId": "uuid",
  "memberId": "uuid",
  "paymentIntentId": null,
  "source": "staff"
}
```

Conflicts:
```text
409 BOOKING_CAPACITY_EXCEEDED
409 MEMBERSHIP_NOT_ELIGIBLE
409 CREDIT_INSUFFICIENT
```

## Public booking API

Base:
`/api/v1/public/:tenantSlug`

```text
GET  /profile
GET  /branches
GET  /services
GET  /availability
POST /bookings
```

Public endpoints:
- rate limited
- tenant-resolved by public slug/domain
- minimize personal-data enumeration
- transactionally validate booking capacity

## Membership plans

```text
GET   /membership-plans
POST  /membership-plans
GET   /membership-plans/:planId
PATCH /membership-plans/:planId
POST  /membership-plans/:planId/deactivate
```

## Member memberships

```text
POST /members/:memberId/memberships
PATCH /member-memberships/:id
POST /member-memberships/:id/cancel
POST /member-memberships/:id/renew
```

Pause is post-MVP:
```text
POST /member-memberships/:id/pause
```

## Payments

```text
GET  /payments
POST /payment-intents
GET  /payment-intents/:id
POST /payment-intents/:id/initiate
POST /payments/manual
POST /provider-webhooks/mpesa
GET  /payments/unmatched
POST /payments/:transactionId/match
POST /payments/:transactionId/refund
```

Refund permission: `payment:refund`

M-Pesa webhook must be:
- verified/authenticated as provider allows
- idempotent
- persisted
- processed safely
- independent from browser success UI

## Attendance

```text
GET  /attendance/today
POST /attendance/check-in
POST /attendance/override
GET  /schedule/occurrences/:id/roster
```

Override requires permission + reason.

## Reports

```text
GET /reports/overview
GET /reports/revenue
GET /reports/memberships
GET /reports/attendance
GET /reports/occupancy
GET /reports/leads
```

All reports display and accept:
- from
- to
- branch scope

## Audit

```text
GET /audit-events
```

Permission: `audit:read`

## Files

```text
POST   /files
GET    /files/:id
DELETE /files/:id
```

Private by default.

## Error response

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

## Stable core error codes

```text
VALIDATION_FAILED
UNAUTHENTICATED
FORBIDDEN
RESOURCE_NOT_FOUND
RATE_LIMITED
TENANT_ACCESS_DENIED
BRANCH_ACCESS_DENIED
MEMBER_NOT_FOUND
MEMBER_INACTIVE
BOOKING_CAPACITY_EXCEEDED
BOOKING_WINDOW_CLOSED
BOOKING_INVALID_STATE
MEMBERSHIP_NOT_ELIGIBLE
CREDIT_INSUFFICIENT
PAYMENT_NOT_FOUND
PAYMENT_ALREADY_PROCESSED
PAYMENT_AMOUNT_MISMATCH
PAYMENT_PROVIDER_UNAVAILABLE
REFUND_NOT_ALLOWED
INTEGRATION_UNAVAILABLE
UNEXPECTED_ERROR
```

## Pagination

```json
{
  "data": [],
  "page": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

Every response must carry `X-Request-Id`.
