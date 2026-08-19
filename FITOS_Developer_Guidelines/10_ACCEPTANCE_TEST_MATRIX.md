# FITOS Acceptance Test Matrix

| ID | Area | Scenario | Expected |
|---|---|---|---|
| A01 | Auth | valid login | session created |
| A02 | Auth | invalid login | generic rejection |
| A03 | Auth | logout | session revoked |
| A04 | Auth | expired session | 401 |
| T01 | Tenancy | tenant A requests tenant B member ID | inaccessible |
| T02 | Tenancy | tenant A passes tenant B branch | no leakage |
| P01 | Permission | reception opens role management | forbidden |
| P02 | Permission | owner changes access | allowed + audit |
| B01 | Branch | create branch | visible only in tenant |
| B02 | Branch | duplicate slug in tenant | conflict |
| M01 | Member | create member | contact + member created |
| M02 | Member | search local phone variant | normalized match |
| M03 | Member | update member | saved + audit |
| M04 | Member | server validation error | form retained |
| S01 | Schedule | trainer collision | blocked/warned per policy |
| BK01 | Booking | book open slot | confirmed |
| BK02 | Booking | race for last slot | exactly one success |
| BK03 | Booking | invalid entitlement | rejected |
| BK04 | Booking | eligible cancel | correct state/credit |
| MB01 | Membership | activate 10 credits | ledger +10 |
| MB02 | Membership | eligible booking | ledger -1 |
| MB03 | Membership | eligible cancel | ledger +1 |
| PAY01 | Payment | initiate M-Pesa | pending, not paid |
| PAY02 | Payment | valid callback | succeeds |
| PAY03 | Payment | duplicate callback | no duplicate |
| PAY04 | Payment | unmatched transaction | review queue |
| PAY05 | Payment | manual match | allocation + audit |
| PAY06 | Payment | unauthorized refund | forbidden |
| AT01 | Attendance | booked check-in | event created |
| AT02 | Attendance | duplicate check-in | prevented |
| AT03 | Attendance | override | reason + audit |
| R01 | Report | revenue range | matches payments |
| R02 | Report | branch filter | branch-only |
| R03 | Report | refund | net adjusts |
| UI01 | UX | 360px member create | usable |
| UI02 | UX | keyboard login | usable |
| UI03 | UX | keyboard member create | usable |
| UI04 | UX | 200% browser zoom | core flow usable |
| SEC01 | Security | CSRF attempt | rejected |
| SEC02 | Security | tampered tenant context | rejected |
| SEC03 | Security | secret scan frontend | no secrets |
| SEC04 | Security | dangerous CSV formula | neutralized |
| OPS01 | Ops | dependency unavailable | readiness fails |
| OPS02 | Ops | backup | generated |
| OPS03 | Ops | restore | verified |
| OPS04 | Ops | previous app image | rollback possible |

## Sprint 01 release blockers

```text
A01-A04
T01-T02
P01-P02
B01-B02
M01-M04
UI01-UI04
SEC01-SEC03
OPS01-OPS04
```

A release is not successful because the deployment command returned zero. It is successful when the deployed system passes its smoke and acceptance checks.
