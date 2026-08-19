# FITOS Engineering Standards, Git and CI

## 1. Engineering Principles

- explicit beats clever
- domain names beat abbreviations
- correctness beats premature optimization
- server authority beats frontend assumptions
- boring infrastructure is a feature
- tenant isolation is part of every query
- business states are modelled, not guessed from UI
- every integration can fail
- every retry can duplicate
- every migration reaches production eventually

---

## 2. TypeScript

Enable strict mode.

Avoid:
- `any` without documented boundary reason
- non-null assertion as routine
- giant union casts
- untyped JSON from integrations

Use:
- discriminated unions
- typed DTOs
- exhaustive state handling
- parsing at trust boundaries

---

## 3. Naming

Use domain language.

Good:
- `MembershipEntitlement`
- `BookingOccurrence`
- `PaymentAllocation`

Bad:
- `DataManager`
- `Helper2`
- `GymObj`
- `ProcessThing`

Booleans:
- `isActive`
- `canRefund`
- `hasConsent`

Functions:
- verbs
- `createBooking`
- `calculateRemainingCredits`

---

## 4. Functions

Prefer:
- small
- explicit inputs
- explicit output
- minimal side effects

Business workflows may be longer when transaction logic benefits from staying visible. Do not fragment code into meaningless one-line wrappers merely to satisfy a function-length rule.

---

## 5. Comments

Comments explain:
- why
- invariant
- external oddity
- risk
- temporary migration behavior

Do not narrate obvious code.

---

## 6. Git Branching

Recommended trunk-oriented:
- `main` always releasable
- short-lived feature branches
- pull requests
- feature flags for incomplete high-risk work

Branch examples:
```text
feat/booking-waitlist
fix/payment-idempotency
chore/postgres-indexes
```

---

## 7. Commit Messages

Use clear conventional style:

```text
feat(bookings): add capacity conflict handling
fix(payments): make callback processing idempotent
refactor(members): move phone normalization to contact service
test(tenancy): add cross-tenant payment access cases
```

Commits should tell future developers what changed.

---

## 8. Pull Requests

PR description:
- problem
- solution
- screenshots for UI
- migration impact
- security/permission impact
- tests
- rollout notes
- follow-ups

High-risk labels:
- payments
- tenancy
- auth
- migration
- sensitive-data
- infrastructure

These require additional review.

---

## 9. Review Rules

Reviewer asks:
- is tenant scope explicit?
- are permissions correct?
- can this retry duplicate?
- can this transaction race?
- is money represented safely?
- does this expose sensitive data?
- does failure leave partial state?
- is migration safe?
- are errors useful?
- is UI consistent with design system?
- are tests protecting the invariant?

---

## 10. CI Pipeline

On every PR:

```text
install locked dependencies
format check
lint
typecheck
unit tests
integration tests
build web
build api
database migration test
security/dependency scan
secret scan
```

Protected `main` requires CI success.

---

## 11. Lockfiles

Commit lockfile.

Production build uses deterministic install:
```text
npm ci
```

Dependency upgrades should be intentional.

---

## 12. Dependency Governance

Before adding dependency:
- is it maintained?
- is it necessary?
- bundle/runtime impact?
- security history?
- can platform/library capability already solve it?
- does it create lock-in?

Avoid multiple libraries for the same problem.

---

## 13. Feature Flags

Use for:
- staged modules
- risky payment behavior
- tenant-specific beta
- migration transitions

Flags must have:
- owner
- purpose
- expiry/removal plan

Do not allow permanent flag archaeology.

---

## 14. API Breaking Changes

Prefer additive.

When breaking:
- version or coordinated release
- migrate clients
- document deprecation
- telemetry confirms old path no longer used
- remove later

---

## 15. Database Review

Any schema PR should state:
- new tables/columns
- indexes
- lock risk
- backfill
- nullability
- foreign keys
- deletion behavior
- tenant scope
- rollback/forward fix plan

---

## 16. Security Review Triggers

Mandatory deeper review when changing:
- login/session
- permissions
- exports
- files
- M-Pesa/payment
- webhooks
- public forms
- tenant/domain routing
- sensitive assessment data
- support impersonation/access
- CSP/CORS
- secrets

---

## 17. Release Versioning

Use semantic or clear release tagging.

Record:
- commit
- image tag
- migration version
- deploy time
- operator/CI
- release notes

Production must always answer: “what exact code is running?”

---

## 18. Documentation Discipline

Update docs in same PR when:
- behavior changes
- permissions change
- env variable added
- migration process changes
- integration configuration changes
- operational runbook changes

Out-of-date deployment docs are production defects waiting politely.
