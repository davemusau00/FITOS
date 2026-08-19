# FITOS Developer Execution Checklist

## Before Starting a Ticket

- [ ] Read related product specification.
- [ ] Identify persona and user goal.
- [ ] Confirm tenant/branch scope.
- [ ] Confirm permission required.
- [ ] Confirm data sensitivity.
- [ ] Confirm payment/financial impact.
- [ ] Confirm concurrency risk.
- [ ] Confirm integration dependency.
- [ ] Define success, empty, loading and error states.
- [ ] Define tests before implementation.

---

## UI Ticket

- [ ] Uses FITOS design tokens.
- [ ] Uses existing UI component before inventing new one.
- [ ] Primary action obvious.
- [ ] Mobile behavior designed.
- [ ] Keyboard path works.
- [ ] Focus visible.
- [ ] Labels accessible.
- [ ] Loading state.
- [ ] Empty state.
- [ ] Permission state.
- [ ] Validation state.
- [ ] Recoverable server error preserves user work.
- [ ] Status not represented by color alone.
- [ ] No sensitive data exposed to unauthorized role.
- [ ] Screenshots included in PR.

---

## API Ticket

- [ ] Route follows API conventions.
- [ ] DTO validated.
- [ ] Tenant scope resolved from authenticated context.
- [ ] Authorization policy executed.
- [ ] Business invariant implemented in domain/service.
- [ ] Transaction boundary defined.
- [ ] Idempotency considered.
- [ ] Race condition considered.
- [ ] Audit event considered.
- [ ] Standard error contract.
- [ ] OpenAPI updated.
- [ ] Logs use request ID.
- [ ] Tests include forbidden/cross-tenant case.

---

## Database Ticket

- [ ] `tenant_id` present where required.
- [ ] Branch scope correct.
- [ ] Foreign keys.
- [ ] Unique constraints correctly scoped.
- [ ] Indexes based on access path.
- [ ] Money uses safe representation.
- [ ] Date/time semantics documented.
- [ ] Delete behavior intentional.
- [ ] Sensitive columns identified.
- [ ] Migration tested from clean DB.
- [ ] Migration reviewed for production lock risk.

---

## Booking Ticket

- [ ] Capacity validated server-side.
- [ ] Concurrent final-slot case tested.
- [ ] Membership eligibility validated.
- [ ] Credit ledger transaction correct.
- [ ] Cancellation/reschedule audit retained.
- [ ] Notifications async.
- [ ] UI does not confirm before server commit.

---

## Payment Ticket

- [ ] Initiated is not treated as paid.
- [ ] Provider authenticity checked.
- [ ] Provider event deduplicated.
- [ ] Amount/currency/reference verified.
- [ ] Retry cannot duplicate allocation.
- [ ] Refund permission protected.
- [ ] Manual reconciliation audited.
- [ ] Financial report impact tested.

---

## Security Ticket

- [ ] No secret in frontend.
- [ ] No secret in logs.
- [ ] No raw stack trace.
- [ ] Input validated.
- [ ] Output encoding/sanitization correct.
- [ ] Rate limit considered.
- [ ] CSRF/CORS implications reviewed.
- [ ] File upload restrictions reviewed.
- [ ] Tenant isolation test added.
- [ ] Sensitive export behavior reviewed.

---

## Before Pull Request

- [ ] Format.
- [ ] Lint.
- [ ] Typecheck.
- [ ] Unit tests.
- [ ] Integration tests.
- [ ] Build web.
- [ ] Build API.
- [ ] Run migration test.
- [ ] Manual happy-path test.
- [ ] Manual failure test.
- [ ] Update docs.
- [ ] Add migration notes.
- [ ] Add rollout notes.

---

## Before Production Release

- [ ] CI green.
- [ ] Release tag/image identifiable.
- [ ] Production backup recent.
- [ ] Migration reviewed.
- [ ] Secrets configured.
- [ ] Staging smoke test.
- [ ] Production deploy.
- [ ] Readiness passes.
- [ ] Login smoke test.
- [ ] Booking smoke test.
- [ ] Payment provider health checked if changed.
- [ ] Logs checked.
- [ ] Metrics checked.
- [ ] Rollback version retained.

---

# Definition of Done

A FITOS feature is done only when:

> The correct user can complete the intended job, the wrong user cannot, the wrong tenant cannot see it, concurrency cannot corrupt it, failures are understandable, the behavior is tested, production can observe it, and another developer can maintain it.
