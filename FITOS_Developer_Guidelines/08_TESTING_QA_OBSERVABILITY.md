# FITOS Testing, QA and Observability

## 1. Quality Strategy

Tests should protect business invariants, not chase a vanity coverage percentage.

Priority order:
1. money
2. tenant isolation
3. permissions
4. booking capacity
5. membership entitlements
6. attendance
7. integrations
8. user experience
9. reporting calculations

---

## 2. Test Pyramid

### Unit
Pure:
- money utilities
- membership eligibility
- cancellation policy
- booking-window calculations
- permission decisions
- status transitions
- timezone helpers

### Integration
With real/test database:
- repositories
- migrations
- booking transaction
- payment allocation
- credit ledger
- tenant scoping
- audit writes

### API
- validation
- auth
- permissions
- error contract
- pagination
- filters

### E2E
Real browser against deployed-like stack.

---

## 3. Mandatory E2E Journeys

### Organization Setup
owner signs in → creates branch → creates trainer → creates service → creates schedule.

### Lead Conversion
lead → trial → convert to member.

### Booking
member → book → capacity reserved → confirmation visible.

### Capacity Conflict
two concurrent attempts for final slot → exactly one succeeds.

### Membership
purchase/activate plan → booking consumes valid credit → cancellation restores according to policy.

### Attendance
booked member → check in → roster updates.

### Payment
initiate/record → provider success simulation → allocation → receipt.

### Refund
authorized role → refund → financial reports reflect net result.

### Permission
reception cannot refund if permission absent.

### Tenant Isolation
tenant A cannot access tenant B resource even with known ID.

### Session
logout revokes session.

---

## 4. Concurrency Tests

Required:
- final booking slot
- final session credit
- duplicate webhook
- repeated payment callback
- repeated refund request
- simultaneous check-in if unique rule applies

Concurrency bugs are production bugs even if normal UI tests pass.

---

## 5. Migration Tests

CI:
- create blank DB
- apply all migrations
- seed minimal dataset
- run schema-dependent tests

Release candidate:
- restore sanitized production-like snapshot where available
- apply new migrations
- measure duration/locks
- test rollback strategy if migration is not backward-compatible

---

## 6. Visual QA

Review:
- 360px
- 390px
- 768px
- 1024px
- 1366px
- 1440px+
- browser zoom 200% for critical pages

Browsers:
- current Chrome
- current Firefox
- current Edge
- current Safari where accessible

Critical components get visual regression snapshots:
- app shell
- data table
- form
- modal
- booking page
- member card/detail
- dashboard cards

---

## 7. Accessibility QA

Automated tools help but are insufficient.

Manual:
- keyboard-only booking
- keyboard-only member creation
- screen-reader labels on main forms
- focus after modal close
- error focus
- status announcements
- contrast
- reduced motion

---

## 8. Performance Testing

Measure:
- API p50/p95 latency
- dashboard load
- search
- booking mutation
- report generation
- bulk import
- export
- concurrent class booking

Load test before onboarding a high-volume tenant.

Performance test data should resemble real tenant distribution.

---

## 9. Observability

### Logs
Structured JSON in production.

### Metrics
At minimum:
- request count
- status rate
- latency
- active sessions
- DB pool utilization
- queue depth
- failed jobs
- webhook failures
- payment callback failures
- booking conflicts
- integration latency

### Health Endpoints
- `/health/live`
- `/health/ready`

Liveness:
process alive.

Readiness:
critical dependencies sufficiently available to serve traffic.

Do not expose internal dependency secrets or verbose diagnostics publicly.

---

## 10. Business Telemetry

Operational product events:
- member_created
- lead_created
- lead_converted
- booking_created
- booking_cancelled
- checkin_created
- membership_activated
- payment_succeeded
- payment_unmatched

Analytics payloads must not include sensitive health content.

---

## 11. Alerting

Alert on:
- API unavailable
- error rate spike
- DB disk pressure
- failed backups
- queue backlog
- repeated payment webhook failure
- certificate expiry risk
- low VPS disk
- memory exhaustion/restarts
- suspicious auth failures

Do not alert on every individual user validation error.

---

## 12. Release QA Gate

Release blocked if:
- type errors
- lint errors
- critical tests fail
- migration fails
- unresolved high severity security issue
- tenant-isolation regression
- payment regression
- backup failure
- critical accessibility regression in primary flows
- broken build

---

## 13. Bug Severity

### P0
- tenant data leak
- payment corruption
- irreversible data loss
- total outage
- authentication bypass

### P1
- booking/membership core unavailable
- major reconciliation error
- privilege escalation
- widespread corrupted state

### P2
- feature impaired with workaround
- reporting defect not corrupting source truth

### P3
- cosmetic/minor usability

P0 requires incident procedure, not ordinary backlog handling.
