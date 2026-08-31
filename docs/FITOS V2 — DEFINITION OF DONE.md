# FITOS V2 — DEFINITION OF DONE

Use this checklist on every significant implementation or PR.

A task is **not done** until all applicable items are checked.

## Product

- [ ] Solves a documented user/roadmap gap.
- [ ] Existing architecture was inspected before adding new abstractions.
- [ ] UI behavior matches what the copy promises.
- [ ] No new dead controls or placeholder success states.
- [ ] Empty/loading/error states exist where needed.

## Contracts & Backend

- [ ] Shared contracts are authoritative.
- [ ] Server validates inputs.
- [ ] Server enforces permissions.
- [ ] Tenant isolation is enforced.
- [ ] Branch behavior is explicit.
- [ ] Capability gating is enforced where applicable.
- [ ] Important mutations return canonical state or durable job ID.

## Persistence

- [ ] Result survives refresh.
- [ ] Result survives navigation.
- [ ] Result survives logout/login when applicable.
- [ ] Multi-record operations are transactional where required.
- [ ] Audit/history/ledger exists where appropriate.
- [ ] Migration is forward-only.

## Frontend

- [ ] Mutation has pending state.
- [ ] Duplicate submission is prevented.
- [ ] Validation errors are understandable.
- [ ] Success feedback is clear.
- [ ] Failed mutation is recoverable.
- [ ] Correct queries are invalidated/refetched.
- [ ] Permission-inaccessible actions are hidden or explained.
- [ ] Capability-inaccessible actions are hidden or explained.

## Branch / Scope

- [ ] Correct branch scope appears in query keys.
- [ ] Switching branch cannot leave stale data.
- [ ] All Locations behavior is correct where supported.
- [ ] Mutations requiring a branch require a concrete branch.

## Quality

- [ ] No unnecessary `any`.
- [ ] No unsafe `as unknown as` contract bypass.
- [ ] No new duplicated page-level design system.
- [ ] Shared UI primitives used where practical.
- [ ] Static presentation uses shared semantic CSS; remaining inline styles are demonstrably data-driven.
- [ ] Responsive behavior checked.
- [ ] Keyboard/focus behavior checked.

## Tests

- [ ] Domain logic test added/updated where applicable.
- [ ] Persistence/integration test added where applicable.
- [ ] Tenant/branch boundary test added where applicable.
- [ ] Component test added for reusable UI behavior where applicable.
- [ ] E2E test added/updated for business-critical flow.
- [ ] Failure state is tested.
- [ ] Reload/persistence behavior is tested where important.

## CI

- [ ] Roadmap gap evidence is updated with the exact verification scope.
- [ ] Format passes.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Migrations pass.
- [ ] Seed passes.
- [ ] API/integration/security tests pass.
- [ ] Playwright passes.
- [ ] Build passes.
- [ ] Required production validation passes.

## Final Gate

Membership hold, resume, and renewal are examples of the required bar: each is persisted, permission-gated, audited, covered by integration tests, and surfaced with recoverable UI feedback. Account export, plan-change, cancellation, and deletion requests now meet the same local persistence/audit boundary, with explicit confirmation for deletion and no automatic destructive execution. The notification inbox now meets the local persistence, ownership, read-state, deep-link, and recoverable UI bar for those lifecycle events. Platform support notes and account-recovery cases now persist tenant scope, actor/evidence, audit history, and recoverable UI state, with tenant-scoped staff-session revocation for verified recovery subjects. Scoped system notices now meet the scheduling, expiry, audience filtering, per-user acknowledgement, and recoverable UI bar. Booking reschedule, waitlist promotion, entitlement-override capture, Coach roster signals, and member-tag assignment now meet the local contract/persistence/audit boundary described in the roadmap, while their broader workflows remain explicitly partial. Shared query failures likewise expose a keyboard-operable retry action on the verified tenant and Platform surfaces. Evidence is recorded in the roadmap matrix; payment collection is intentionally excluded.

### Evidence boundary

Local typechecks, tests, and builds are necessary evidence for a change, but do not substitute for hosted CI, Playwright browser execution, production-image validation, or a verified deployment. Queue schemas and API handoffs do not count as fulfilled worker behavior until a consumer updates durable state. Record each verification at the scope in which it was actually run.

Before merge, answer **YES** to all three:

- [ ] Can a seeded permitted user perform the workflow without developer knowledge?
- [ ] Does the persisted system state match what the interface shows?
- [ ] Would a regression in this workflow be caught by automated tests?

If any answer is **NO**, the implementation is not complete.
