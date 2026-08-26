# FITOS Metric Definitions

All time windows use the tenant timezone. Branch-scoped metrics include only records belonging to the selected branch and respect the operator's authorized branch IDs.

## Active member

A member whose member record is active and who has at least one membership with active status covering the measurement timestamp. A missing membership is not counted as active for retention or entitlement metrics.

## Class occupancy

Confirmed reservations divided by the occurrence's effective capacity. Effective capacity is the configured occurrence capacity after resource or room constraints. Cancelled and waitlisted reservations are excluded from occupancy.

## Retention (90d)

Members who joined at least 90 days ago and remain active at day 90, divided by members whose 90-day measurement window has completed. If the comparison cohort is empty, display no comparison period rather than zero or an invented trend.

## Lead conversion

Joined members divided by qualified leads in the selected period. Leads without a qualified status are excluded from the denominator. If no completed comparison period exists, the UI displays a no-data state.

## Comparison periods

Trend percentages compare the current selected period with the immediately preceding period of equal length. Metrics without a complete prior period must return `null` and render as unavailable.

## No-data rule

Unknown, unavailable, or insufficient data is represented as `null` in API contracts and as an explicit no-data state in the UI. Product-facing code must not substitute operational values such as `0`, `15`, `8`, or `-2` merely to fill a chart.
