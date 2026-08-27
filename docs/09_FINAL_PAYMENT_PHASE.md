# 09 — FINAL PAYMENT PHASE

Payments remain intentionally last.

## Prerequisites

Do not start live provider work until self-service SaaS works, member/public identity is correct, booking/membership/attendance are polished, advanced resource model is stable, website/public booking is real, platform plan/capability model exists and release-readiness is credible.

## Fitness business payments

- Payment/invoice/receipt UX.
- Allocations, refunds, voids, reconciliation, unmatched transactions.
- M-Pesa adapter, STK Push, callbacks, verification, idempotency, failure/timeout handling, booking/membership allocation and receipts.
- Cards through an approved provider adapter.
- Cash/bank/manual references.
- Paybill/Till reconciliation where separately supported.

Current Safaricom/provider requirements must be freshly researched at implementation time.

## Recurring member billing

Billing agreement, due schedule, collection attempts, retries, grace, failure, member notice and tenant-configured account action.

## Financial analytics

Revenue, collected, outstanding, refunds, failed collections, branch/service/membership breakdown and payment method mix.

## FITOS SaaS billing

Separate from tenant member billing: trial conversion, tenant subscription, SaaS invoice, plan change, grace, past due, suspension, cancellation and reactivation.

Never reuse gym membership tables for FITOS SaaS subscriptions.

## Payment safety

Integer minor units, idempotency, audit, capabilities, secret isolation, webhook verification/replay defense, no PAN storage, strong reconciliation and PostgreSQL concurrency tests.

## Final exit

FITOS is monetization-complete only when tenant businesses can collect safely AND FITOS can bill tenant subscriptions safely.
