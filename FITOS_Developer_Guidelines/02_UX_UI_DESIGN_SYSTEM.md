# FITOS UX/UI and Design System Guidelines

## 1. Experience Direction

FITOS should feel:

- athletic
- precise
- premium
- youthful
- technical
- calm under pressure
- fast
- data-confident

The interface must not feel:
- like legacy accounting software
- like a bodybuilding poster
- like a crypto dashboard
- excessively gamified
- crowded
- neon for neon’s sake

The brand can be visually energetic while operational screens remain disciplined.

---

## 2. Brand Foundation

### Core Palette

Use tokens rather than hard-coded colors.

```css
:root {
  --fitos-energy: #C6FF00;
  --fitos-pure: #FFFFFF;
  --fitos-steel: #6B6F76;
  --fitos-carbon: #121417;
  --fitos-jet: #0A0A0A;

  --surface-0: #0A0A0A;
  --surface-1: #121417;
  --surface-2: #191C20;
  --surface-3: #22262B;

  --text-primary: #FFFFFF;
  --text-secondary: #B6BBC3;
  --text-muted: #858B94;

  --border-subtle: rgba(255,255,255,.08);
  --border-strong: rgba(255,255,255,.16);
  --focus-ring: #C6FF00;

  --success: #5BE28C;
  --warning: #FFCE56;
  --danger: #FF6464;
  --info: #6DB7FF;
}
```

The lime accent is an action/energy signal, not a wallpaper color.

### Accent Usage
Use Energy for:
- primary CTA
- active navigation
- focus indication where appropriate
- selected states
- positive data emphasis when semantically neutral
- brand moments

Do not use Energy for:
- long body text
- every icon
- every chart series
- error/success semantics
- large full-screen backgrounds in the admin UI

---

## 3. Typography

The brand direction uses a technical geometric grotesk.

If **PP Neue Machina** is properly licensed, use it in brand/headline applications according to the license. Do not bundle or redistribute font files without the correct license.

Recommended system fallback strategy:

```css
font-family:
  "PP Neue Machina",
  "Space Grotesk",
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

### Type Roles
- Display: marketing moments only
- H1: page context
- H2/H3: groups and subsections
- Body: high legibility
- Label: short controls
- Numeric: tabular numbers for dashboards
- Caption: supporting metadata

Use `font-variant-numeric: tabular-nums` for money, counts and time.

Avoid excessive all caps in workflows. All caps may be used for small brand labels and compact data captions.

---

## 4. Spacing and Layout

Use an 8-point base rhythm with 4px half-step support.

Suggested tokens:

```text
4, 8, 12, 16, 24, 32, 40, 48, 64, 80
```

### Admin Shell
Desktop:
- left navigation: 248–280px
- content max width where reading benefits from it
- data tables may use full available width
- utility/header area 64–72px

Tablet:
- collapsible navigation
- preserve table context
- use drawers for secondary detail

Mobile:
- bottom or compact primary navigation only for member portal
- admin interface may use a drawer
- no horizontal viewport scrolling except intentionally scrollable tables
- reception actions should remain reachable one-handed where practical

---

## 5. Shape Language

FITOS visual DNA comes from the stylized F:
- forward lean
- clipped angles
- controlled curvature
- split planes
- velocity

Translate this into:
- section dividers
- image masks
- loading skeleton accents
- cards with subtle clipped corners selectively
- brand-pattern backgrounds
- chart annotations

Do not make every button or input polygonal. Form controls should prioritize usability.

### Border Radius
Use a restrained scale:
- 6px: compact controls
- 10px: inputs/buttons
- 14px: cards
- 20px: large marketing surfaces

Avoid arbitrary radii.

---

## 6. Brand Pattern

The F symbol can create:
- tiled outline pattern
- oversized low-contrast watermark pattern
- diagonal velocity pattern
- tone-on-tone embossed pattern

Rules:
- pattern opacity in admin UI generally 2–6%
- never reduce text contrast
- avoid pattern beneath dense forms
- use on authentication, onboarding, empty states, marketing and branded reports
- preserve exact geometry of the master F mark

---

## 7. Navigation Architecture

### Admin Navigation
Recommended top-level:
- Overview
- Members
- Leads
- Bookings
- Schedule
- Memberships
- Payments
- Attendance
- Staff
- Reports
- Website
- Settings

Top-level navigation must reflect actual jobs, not backend modules.

### Context Switching
Organization/branch switcher:
- always show current branch context
- prevent accidental cross-branch edits
- remember user’s last branch
- clearly identify “All branches” reporting mode
- mutation screens should never silently operate across all branches

---

## 8. Page Anatomy

Standard admin page:

```text
Page title
Supporting context / branch
Primary action

Optional KPI strip

Filter/search row

Main content
  table / cards / calendar / form

Context panel or drawer
```

Avoid placing primary actions in unpredictable locations.

---

## 9. Tables

Tables are core ERP infrastructure.

Requirements:
- sticky header for long tables
- sortable columns where meaningful
- query-string-backed filters
- persistent filters per user where useful
- pagination or virtualization for large datasets
- column visibility where advanced users need it
- row actions accessible by keyboard
- no information hidden only behind hover
- export clearly separated from destructive actions

### Mobile Tables
Do not squeeze 10 columns into 360px.

Use:
- priority columns
- horizontally scrollable data grid only when comparison requires it
- record cards for transactional lists where better
- detail drawer/sheet

---

## 10. Forms

### Rules
- labels never rely on placeholder text
- mark optional fields, not every required field
- group related fields
- show validation near the field
- preserve data after recoverable server errors
- prevent double submission
- disable submit only when necessary
- show progress for multi-step onboarding
- provide meaningful defaults
- display currency/timezone explicitly where ambiguity exists

### Long Forms
Prefer:
- sections
- progressive disclosure
- save-and-continue for setup flows
- sticky summary/actions for complex forms

Avoid giant accordion forests.

---

## 11. Booking UX

Booking is a revenue workflow.

Customer booking should require the minimum viable steps:

1. choose service/class
2. choose time
3. identify customer
4. validate eligibility/package
5. pay if required
6. confirm

Show:
- time
- location
- trainer
- remaining capacity only if business allows it
- cancellation terms
- price
- package/credit usage
- confirmation

Never allow a button to imply confirmed booking before server confirmation.

---

## 12. Front Desk UX

Reception mode should be exceptionally fast.

Recommended home:
- member search with autofocus
- QR scan action
- today’s classes
- recent check-ins
- unresolved front-desk exceptions
- quick payment action
- quick booking action

Search should support:
- name
- phone
- email
- member number

A check-in flow should usually require no more than:
search/scan → verify → check in.

---

## 13. Dashboard UX

The dashboard is not a chart museum.

Top row:
- revenue/collections
- check-ins
- active members
- today’s bookings
- occupancy or expiring memberships depending on persona

Then:
- exceptions requiring attention
- trend chart
- membership/lead funnel
- operational schedule

Every KPI must define:
- calculation
- date range
- branch scope
- currency
- comparison period
- drill-down route

---

## 14. Status System

Use consistent semantic states.

Booking:
- pending
- confirmed
- checked_in
- attended
- cancelled
- no_show
- waitlisted

Payment:
- initiated
- pending
- succeeded
- failed
- cancelled
- refunded
- partially_refunded
- unmatched

Membership:
- scheduled
- active
- paused
- expired
- cancelled
- exhausted

Never use color alone. Pair color with icon/text.

---

## 15. Feedback and Motion

Motion should communicate causality.

Use motion for:
- drawer entry
- route/content transition sparingly
- success acknowledgement
- reordering
- expanding contextual detail
- skeletons

Avoid:
- large bouncing KPIs
- decorative auto-play loops in admin
- long easing that delays work

Respect `prefers-reduced-motion`.

---

## 16. Accessibility Baseline

Target WCAG 2.2 AA for core workflows.

Requirements:
- visible keyboard focus
- logical focus order
- semantic headings
- proper labels
- accessible dialogs
- escape closes dismissible overlays
- no keyboard traps
- color contrast checks
- touch targets sized for real mobile use
- screen-reader-friendly status updates
- icons with accessible names where interactive
- errors summarized for long forms
- charts have data-table or textual equivalents where information is essential

---

## 17. Empty, Loading and Error States

Every screen must design all three.

### Empty
Explain:
- what this is
- why it matters
- how to create the first item

### Loading
Use:
- skeletons for layout retention
- spinners for indeterminate small actions
- button progress for mutations

### Error
State:
- what failed
- whether data is safe
- what the user can do
- retry if safe
- reference ID for support on unexpected server errors

---

## 18. Component Inventory

The internal `packages/ui` should include:

- Button
- IconButton
- LinkButton
- Input
- TextArea
- Select
- Combobox
- MultiSelect
- Checkbox
- RadioGroup
- Switch
- DatePicker
- TimePicker
- DateRangePicker
- PhoneInput
- MoneyInput
- FormField
- FieldError
- Badge
- StatusBadge
- Avatar
- Tooltip
- Popover
- DropdownMenu
- Modal
- AlertDialog
- Drawer
- Sheet
- Toast
- Alert
- Tabs
- Breadcrumbs
- Pagination
- EmptyState
- Skeleton
- DataTable
- KPI
- ChartFrame
- SearchBar
- FilterBar
- CommandPalette
- Calendar
- Timeline
- AuditEvent
- PageHeader
- AppShell

Do not copy a third-party component library visually without adapting it into FITOS tokens and behavior.

---

## 19. UX Review Checklist

Before merging a feature:
- can a first-time user identify the primary action?
- is branch context clear?
- are status and payment meanings unambiguous?
- does it work at 360px, 768px, 1366px and wide desktop?
- does keyboard navigation work?
- does empty state exist?
- does slow API state exist?
- is destructive behavior confirmed?
- does user input survive recoverable error?
- can the action be audited?
- is success obvious without being noisy?
