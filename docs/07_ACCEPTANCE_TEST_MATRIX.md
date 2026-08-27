# 07 — Acceptance Test Matrix

## Global

- Major routes render correctly at 360, 390, 768, 1024 and 1440 widths.
- Keyboard focus is visible.
- Backend independently enforces capabilities.
- Cross-tenant IDs are rejected.
- Branch switch updates all branch-aware screens.

## Public site

- Anonymous visitor can load public site.
- Invalid tenant slug returns safe 404.
- No private/internal fields leak.
- Public lead/reservation works.
- Public schedule respects public visibility.

## Member identity

- Member cannot access staff app.
- Staff email match cannot impersonate a member.
- Member session maps explicitly to member identity.
- Member cannot access another member by changing request ID.

## Insights

- Every KPI comes from real query.
- Date/branch filters alter result.
- Zero-data state works.
- CSV export matches filters.

## Automation

- Enable/disable persists.
- Worker executes only eligible active rule.
- Idempotent triggers do not duplicate side effects.
- Run history records success/failure.
- Failures are visible and retryable.

## Equipment

- Out-of-service asset cannot reserve.
- Maintenance blocks use.
- Pool quantity constrains capacity.
- Cross-tenant asset cannot satisfy another tenant service.

## Inventory

- Stock cannot silently go negative unless authorized override with reason.
- Lot/expiry preserved.
- Stocktake creates audit adjustment.
- Session consumption creates stock movement.

## Assessments

- Historical observations are append-only.
- Value/unit/source/provenance stored.
- Duplicate import detected.
- Reviewer/audit preserved.
- Cross-tenant/member leakage impossible.

## Therapy

- Protocol version preserved after edits.
- Required credential enforced.
- Required safety checklist enforced when configured.
- Equipment reservation linked.
- Sensitive notes permission enforced.

## Device integrations

- Invalid credentials show disconnected state.
- Sync checkpoint prevents replay storm.
- Mapping version stored.
- Unknown metrics quarantined, not silently discarded.

## Website builder

- Draft does not alter published site.
- Publish creates recoverable version.
- Broken block fails safely.
- Custom domain belongs to one tenant.
- Tenant cannot edit another site.

## SaaS plans

- Capability gates work server-side.
- Quota exceeded returns clear error.
- Platform override audited.
- Trial expiry does not delete tenant data.
