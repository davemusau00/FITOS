# 06 — Sitemap & Screen Inventory — Remaining Work

## Existing routes to evolve
- `/app/overview` → role-aware Today.
- `/app/reception` → advanced Front Desk.
- `/app/insights` → real data.
- `/app/automations` → real persistence/execution.
- `/member/*` → dedicated member identity/API.
- `/:tenantSlug` → FITOS Sites renderer.

## New app routes

### Performance
`/app/performance`, `/app/assessments`, `/app/assessments/new`, `/app/assessments/:assessmentId`, `/app/assessment-batteries`, `/app/progress`, `/app/therapy`, `/app/therapy/protocols`, `/app/therapy/sessions/:sessionId`.

### Equipment
`/app/equipment`, `/app/equipment/assets/:assetId`, `/app/equipment/pools`, `/app/equipment/maintenance`, `/app/equipment/calibration`.

### Inventory
`/app/inventory`, `/app/inventory/items/:itemId`, `/app/inventory/suppliers`, `/app/inventory/purchase-orders`, `/app/inventory/stocktakes`, `/app/inventory/movements`.

### Sites
`/app/site`, `/app/site/pages`, `/app/site/pages/:pageId`, `/app/site/navigation`, `/app/site/theme`, `/app/site/media`, `/app/site/domains`, `/app/site/seo`, `/app/site/preview`.

### SaaS account/platform
`/signup`, `/trial`, `/account`, `/account/plan`, `/account/usage`, `/account/export`, `/account/cancel`, plus `/platform/*` administration routes.

## Member profile additions
Overview | Membership | Bookings | Attendance | Assessments | Therapy | Progress | Notes | Activity.

## Equipment dashboard
KPIs: assets, available, in use, maintenance, calibration due. Asset detail shows model, serial, location, status, schedule usage, maintenance, calibration, documents and downtime.

## Performance Lab dashboard
Tests today, pending review, retests due, device availability and recent results.

## Therapy workspace
Today's sessions, protocols, follow-ups and equipment availability.

## Inventory screens
Stock, consumables, retail, suppliers, purchase orders, stocktakes and movements.

## Website builder
Left block library, center preview, right settings on desktop. Stacked editor/preview on mobile.

Controlled blocks: Hero, Classes, Schedule, Trainers, Memberships, Assessments, Therapy, Equipment, Testimonials, Locations, Gallery, FAQ, CTA, Contact, Trial and Rich Text.

## Responsive requirement
Desktop uses tables/calendars/split panes. Tablet uses compact data and drawers. Mobile uses cards, filter sheets, bottom sheets, sticky actions, agenda views and search-first workflows. Primary mobile workflows must not depend on horizontal desktop tables.
