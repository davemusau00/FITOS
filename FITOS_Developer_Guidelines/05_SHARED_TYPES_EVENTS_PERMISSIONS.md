# FITOS Shared Types, Events and Permissions

## Request context

```ts
export interface RequestActor {
  userId: string;
  tenantId: string;
  tenantUserId: string;
  branchIds: string[];
  permissions: PermissionKey[];
}
```

## Money

```ts
export interface Money {
  amountMinor: string;
  currency: string;
}
```

Serialize large minor-unit amounts as strings across JSON boundaries.

## Permission catalogue

```text
tenant:read
tenant:settings

branch:read
branch:create
branch:update
branch:deactivate

member:read
member:create
member:update
member:deactivate
member:export

lead:read
lead:create
lead:update
lead:assign
lead:convert
lead:export

staff:read
staff:manage
role:manage

service:read
service:manage
schedule:read
schedule:manage

booking:read
booking:create
booking:update
booking:cancel
booking:override

membership:read
membership:manage
membership:override

attendance:read
attendance:checkin
attendance:override

payment:read
payment:record
payment:match
payment:refund
payment:export

report:operations
report:finance
report:export

audit:read

assessment:read
assessment:write
assessment:export
```

## Default roles

### Owner
All tenant-level capabilities.

### Manager
All operations, optionally excluding role management/refunds/tenant security configuration.

### Reception
Member read/create/update, booking, attendance, schedule read, payment recording, membership read.

### Trainer
Schedule and assigned-client access; sensitive assessment rights only if explicitly enabled.

### Finance
Payment and finance-report access.

## Status enums

### Member
```text
active
inactive
suspended
archived
```

### Lead
```text
new
contacted
trial_booked
trial_completed
offer
joined
lost
```

### Booking
```text
pending
confirmed
checked_in
attended
cancelled
no_show
waitlisted
```

### Membership
```text
scheduled
active
paused
expired
cancelled
exhausted
```

### Payment
```text
initiated
pending
succeeded
failed
cancelled
refunded
partially_refunded
unmatched
```

## Domain event envelope

```ts
interface DomainEvent<T> {
  eventId: string;
  type: string;
  version: number;
  tenantId: string;
  occurredAt: string;
  payload: T;
}
```

Core events:
```text
member.created
member.updated
member.deactivated
lead.created
lead.stage_changed
lead.converted
booking.created
booking.cancelled
booking.rescheduled
booking.checked_in
membership.activated
membership.renewed
membership.expired
payment.intent_created
payment.succeeded
payment.failed
payment.matched
payment.refunded
attendance.checked_in
notification.requested
notification.sent
notification.failed
```

Queue jobs:
```text
notifications.send
payments.process_webhook
payments.reconcile
reports.generate_export
imports.contacts
memberships.expire
bookings.send_reminder
```

## Error envelope

```ts
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
    fields?: Record<string, string[]>;
    details?: Record<string, unknown>;
  };
}
```

Stable audit action keys:
```text
tenant.updated
branch.created
branch.updated
branch.deactivated
user.invited
user.access_changed
user.deactivated
member.created
member.updated
member.deactivated
booking.created
booking.cancelled
payment.recorded
payment.matched
payment.refunded
membership.activated
attendance.override
```
