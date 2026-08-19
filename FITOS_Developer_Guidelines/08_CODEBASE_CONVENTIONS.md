# FITOS Codebase Conventions

## TypeScript

Use `strict: true`.

Avoid:
- `any`
- routine non-null assertions
- unsafe integration payload casts
- untyped JSON crossing trust boundaries

## DTO names

```text
CreateMemberRequest
UpdateMemberRequest
MemberResponse
MemberListItem
CreateBookingRequest
BookingResponse
```

Never return ORM/database entities directly.

## Repositories

Tenant-owned repository methods must require tenant context.

Forbidden:
```ts
findMemberById(id)
```

Preferred:
```ts
findMemberById(ctx, id)
```

Example:
```ts
interface MemberRepository {
  create(ctx: TenantContext, input: CreateMemberRecord): Promise<Member>;
  findById(ctx: TenantContext, id: MemberId): Promise<Member | null>;
  search(ctx: TenantContext, filters: MemberFilters): Promise<Page<Member>>;
}
```

## Services

Pattern:
```ts
class MembersService {
  async create(actor, input) {
    authorize(actor, "member:create");

    return transaction(async tx => {
      const contact = await ...
      const member = await ...
      await audit.record(...)
      return member
    });
  }
}
```

Controllers must not own domain rules.

## Transactions

Use a DB transaction for state that must succeed/fail together:
- lead conversion
- booking + credit consumption
- payment success + allocation
- refund + state change
- access changes + audit where practical

Notifications happen after commit.

## React Query

Query keys include tenant/branch scope when relevant.

```ts
memberKeys.list(tenantId, branchId, filters)
memberKeys.detail(tenantId, memberId)
```

Do not cache tenant-sensitive records under global IDs alone.

## Validation

Client:
- Zod
- React Hook Form

Server:
- DTO validation
- domain validation

Client validation is UX, not security.

## Dates

Never parse ambiguous date strings.

Use ISO across API boundaries.

Format through explicit branch timezone helpers.

## Money

API:
```json
{"amountMinor":"12845000","currency":"KES"}
```

Do not use binary floating point as business truth.

## Phone numbers

Normalize on the server.
Search normalizes input.
Preserve raw input only where useful for migration/audit.

## Audit

Privileged mutation explicitly emits a stable audit action.

Do not use “HTTP logs” as the only audit system.

## Logging

Structured production logs:
```json
{
  "event":"member.created",
  "tenantId":"...",
  "memberId":"...",
  "requestId":"..."
}
```

Never globally log request bodies, cookies, passwords or provider secrets.

## Errors

Use typed/stable error codes.

```ts
throw new DomainError("BOOKING_CAPACITY_EXCEEDED");
```

Central layer maps domain errors to HTTP.

## UI naming

Good:
```text
MemberForm
MemberSummaryCard
PaymentStatusBadge
BookingActionMenu
```

Bad:
```text
Thing
Box2
CustomWidget
```

## CSS

Use semantic tokens.

Do not:
- scatter raw FITOS hex values through feature code
- use `!important` as routine
- suppress focus
- create arbitrary spacing/radius systems

## Tests

Name tests after guarantees:

```text
rejects access to a member owned by another tenant
creates exactly one booking when two requests race for the final slot
```

## TODOs

Only ticketed:
```ts
// TODO(FITOS-412): remove legacy field after backfill
```

## Security review marker

PR template:
```text
[ ] Auth/session
[ ] Tenancy
[ ] Payments
[ ] Sensitive data
[ ] Exports
[ ] Public endpoints
[ ] Infrastructure
```

Any checked high-risk area requires an additional reviewer.
