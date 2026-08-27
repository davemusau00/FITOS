Yes. The next FITOS sprint should be treated as a **product-completion sprint**, not a feature-expansion sprint.

## Implementation status ledger

Last updated: 2026-08-28. This ledger records work verified in the current
worktree; it is intentionally conservative and does not claim the sprint is
complete.

### Verified complete

- [x] Separate Command, Ops, Front Desk, Coach, Practice, Member and Platform routes/shells exist.
- [x] Staff multi-role assignments, persisted workspace preference, server-resolved `defaultWorkspace` and `availableWorkspaces` are implemented.
- [x] Platform authentication has separate token lifecycle, logout/revoke-all/current-user behavior, and token hashes are not returned.
- [x] Platform overview, tenant directory/control records, lifecycle transitions and feature registry are implemented.
- [x] Public reservations use transactional capacity locking with confirmed/waitlist outcomes; Drizzle concurrency coverage passes.
- [x] Automation provider dispatch, simulation mode, durable action results and authenticated internal task/CRM action callback are implemented.
- [x] Internal automation branch resolution uses a dedicated tenant projection and does not weaken normal user branch-scope rules.
- [x] Internal automation commands require an explicit configured actor identity for audit integrity.
- [x] Insights and dashboard projections have had fabricated fallback values removed; CSV export and neutral no-data states are present.
- [x] Branch-aware Front Desk search, keyboard controls, session-aware check-in, duplicate protection, quick member drawer and responsive drawer styling are implemented.
- [x] Front Desk explicitly distinguishes confirmed session check-in from facility check-in when no booking exists.
- [x] Public Member Portal navigation no longer points to staff login.
- [x] Public tenant pages no longer claim trainer certification or invent timetable duration when configuration is absent.
- [x] Public timetable weekday selection and filtering use the tenant timezone instead of browser-local `Date.getDay()`.
- [x] Public reservation success state reflects the server response (`confirmed` or `waitlisted`) and displays a reservation reference.
- [x] Public timetable exposes explicit available versus full/waitlist action labels from server capacity data.
- [x] Plan-based quota definitions are centralized and shared by Drizzle and in-memory adapters; missing feature capability data fails closed.
- [x] Metric definitions are documented in `docs/METRIC_DEFINITIONS.md`.
- [x] Member portal now consumes a typed server-provided booking eligibility result instead of relying only on frontend credit checks.
- [x] Eligibility projections honor membership expiry in both Drizzle and in-memory adapters; in-memory coverage also evaluates service credits, duplicate bookings and full sessions.
- [x] Drizzle portal eligibility now evaluates each service's credit requirement, duplicate confirmed bookings, effective capacity/full state and active membership before presenting a bookable occurrence.
- [x] Web destructive actions use FITOS confirmation modals; no native `alert`, `confirm` or `prompt` calls remain.
- [x] Members table has a responsive mobile card renderer with quick-view and profile actions; the remaining priority tables still require the full mobile matrix.
- [x] Bookings table has a responsive mobile card renderer with status, session context and authorized cancellation action.
- [x] Attendance log has a responsive mobile card renderer with status, branch, member, notes and authorized status update action.
- [x] Leads table has a responsive mobile card renderer with stage, contact, follow-up, detail and converted-member actions.
- [x] Membership plan catalog has a responsive mobile card renderer with pricing, status, duration, credits, branch and visibility context.
- [x] Services catalog has a responsive mobile card renderer with type, status, capacity, pricing, branch, visibility and authorized edit action.
- [x] Staff directory has a responsive mobile card renderer with multi-role assignments, branch access, status and authorized role-edit action.
- [x] Recurring schedule catalog has a responsive mobile card renderer with weekday/time, materialization window, status and authorized extension action.
- [x] Unmatched payments reconciliation has a responsive mobile card renderer with amount, method, reference, timestamp and reconciliation action.
- [x] Payments ledger has a responsive mobile card renderer with amount, branch, allocation, status, timestamp and authorized refund/void actions.
- [x] Member detail booking and payment history tables have responsive mobile cards preserving status, timing, credits and allocation context.
- [x] Lead-to-member conversion now has a database-enforced tenant/contact uniqueness invariant (`0026_unique_member_contact`) to prevent duplicate members under concurrent conversion.
- [x] Drizzle lead conversion uses conflict-safe member insertion and canonical re-read, so concurrent conversions reuse the tenant/contact member instead of surfacing an insert conflict.
- [x] CRM lead tasks now support durable completion through a tenant-scoped API endpoint, repository implementations, audit event and UI action with due-date display.
- [x] CRM task completion has focused tenant-isolation and idempotency coverage in the in-memory integration suite.
- [x] CRM lead task creation accepts an optional due date/time and persists it through the existing server contract for truthful follow-up queues.
- [x] Platform tenant controls now support audited capability mutation through a platform-only API and entitlement toggles in the tenant directory.
- [x] Member booking cancellation now requires an explicit confirmation modal and explains that credit restoration follows server cancellation policy.

### Verified checks

- [x] Formatting, lint, package typechecks, database-backed API tests and production build passed in the latest complete local run.
- [x] Latest focused API/worker/web checks passed for the incremental slices above, including worker internal-dispatch tests and API tenancy/security tests.
- [x] Configured Playwright suite passed 8/8, including role-boundary coverage and the pilot journey updated for the intentional Command access boundary.

### Verification snapshot — 2026-08-28

- API: typecheck passed; PostgreSQL-enabled run passed 43/43 tests, including all 8 Drizzle integration tests.
- Worker: typecheck passed; 7 dispatcher/processor/metrics tests passed.
- Web: typecheck passed; web test passed.
- Full local `npm run check`: passed with PostgreSQL enabled, including lint, all package builds/typechecks, tests, and production build.
- Focused pilot Playwright journey: passed after updating its Command-access assertion.
- Full required golden/adversarial Playwright matrix: still pending; the configured 8-test suite is green but does not yet cover every journey listed below.

### Still in progress / not yet verified complete

- [ ] Full golden-path and adversarial E2E journeys covering all role handoffs, member self-service, public reservation outcomes and branch switching.
- [ ] Full mobile acceptance matrix across every priority page, including mobile table-card coverage and modal focus behavior.
- [ ] Complete CRM follow-up/conversion workflow and role-specific onboarding/settings coverage.
- [ ] Full Platform entitlement mutation UI and support/audit workflows.
- [ ] Complete end-to-end validation of worker-to-API internal automation execution with configured callback secrets and a real persisted lead target.
- [ ] Complete remaining eligibility policy states for waitlist behavior, booking windows, service inclusion, branch access and cancellation/rescheduling rules.
- [ ] Final accessibility, terminology, activity timeline and archive/delete audit across all modules.

### Explicitly deferred for this sprint

Payments/provider work, billing infrastructure, deployment, CI/branch protection,
Prometheus/backups, AI, marketplace, native apps, payroll, accounting and
other items listed in the deferred scope below remain out of scope.

The architecture is now broad enough. FITOS already has separate Command, Ops, Front Desk, Coach, Practice, Member and Platform surfaces, which is the correct direction for “same operating system, different cockpit.” The repo also now implements those separate routes rather than forcing everyone through one giant `/app` shell.

The development goal now should be:

> **Make every existing FITOS surface feel complete, predictable, responsive and commercially usable before adding another major domain.**

And for this sprint specifically:

**DO NOT spend engineering time on payments, M-Pesa, billing infrastructure, deployment, GitHub Actions, branch protection or CI repair.** Those are explicitly deferred.

# FITOS PRODUCT COMPLETION DIRECTIVE

## 1. Sprint objective

The target is not “more screens.”

The target is:

**A user should be able to run a normal gym, studio or wellness-business day inside FITOS without encountering fake data, dead buttons, unfinished workflows, confusing navigation, desktop-only layouts or screens that look finished but do nothing.**

By the end of this sprint, FITOS should feel less like a sophisticated beta and more like a coherent SaaS product.

The dev team should evaluate every screen using six questions:

| Question                                                                 | Requirement             |
| ------------------------------------------------------------------------ | ----------------------- |
| Can I understand it immediately?                                         | UX clarity              |
| Can I perform the expected action?                                       | Feature completeness    |
| Does the action actually persist?                                        | Functional truth        |
| Does it work on phone/tablet/desktop?                                    | Responsiveness          |
| Does the right role see the right thing?                                 | Workspace + permissions |
| Does the screen behave correctly when data is empty, loading or invalid? | Product resilience      |

If any answer is **no**, that screen is unfinished.

---

# 2. Freeze feature expansion

Until the following completion work is finished:

**Do not add another major domain.**

That means no major new:

- finance functionality
- payroll
- AI assistant
- marketplace
- new fitness vertical
- native app
- accounting
- payment provider work
- subscription billing engine
- complicated hardware integration

Assessments, therapy, inventory, equipment and Sites already stretch FITOS into a broad platform.

The machine has enough limbs. Now teach it to walk beautifully.

---

# 3. Protect the role-specific workspace architecture

The current architecture now has:

```text
/app        FITOS Command
/ops        FITOS Ops
/reception  FITOS Front Desk
/coach      FITOS Coach
/practice   FITOS Practice
/member     FITOS Member
/platform   FITOS Platform
```

This should become a hard product rule.

Do not gradually stuff everything back into `/app`.

Each workspace must have its own:

- navigation
- information density
- primary actions
- landing page
- mobile behavior
- terminology
- shortcuts
- empty states

The owner sees the business.

The manager sees today's operation.

Reception sees arrivals.

The trainer sees sessions and members.

The practitioner sees appointments and records.

The member sees bookings and membership.

Platform staff see SaaS health and tenant administration.

This distinction was established in the FITOS workspace architecture and should remain foundational.

---

# 4. Finish workspace switching

The current shared surface shell already checks `availableWorkspaces` and persists workspace selection through the API.

Finish the UX around this.

A multi-role owner/trainer should see something like:

```text
Workspace

✓ Command
  Coach
```

Switching should:

1. update the server preference
2. navigate
3. retain branch when appropriate
4. refresh permission-sensitive data
5. show an error toast if switching fails
6. remember the workspace after login

Do not reload the entire browser application.

Add workspace switching to Command as well so transitions work symmetrically.

---

# 5. Finish FITOS Command

The owner dashboard must become a genuine executive operating screen, not a collection of module totals.

Current work using `todayOverview(activeBranchId)` is the right direction.

The final Command screen should prioritize:

```text
Business health
Today
Needs attention
Member health
Lead health
Capacity
Upcoming operational risks
```

Recommended hierarchy:

```text
GOOD MORNING, DAVID

WESTLANDS
Thursday 27 August

486 ACTIVE MEMBERS
+3 today

92 EXPECTED VISITS
38 checked in

14 SESSIONS TODAY
3 almost full

31 ACTIVE LEADS
6 follow-ups due

NEEDS ATTENTION
12 members at risk
4 memberships expiring
3 follow-ups overdue
2 sessions >90% capacity
```

Do not make every section a table.

Owners need **signals first, records second**.

---

# 6. Fix remaining metric semantics

Every label must correspond exactly to what the API returns.

For example, current Overview uses `newToday` for the Leads KPI while displaying language implying active funnel membership.

That should become either:

```text
NEW LEADS TODAY
6
```

or use an actual:

```text
activeLeads
```

aggregate.

Apply this discipline everywhere.

Never show:

```text
Retention
Growth
Conversion
Performance
Utilization
Active
```

unless there is an explicit definition behind the number.

---

# 7. Build a FITOS “Attention Centre” pattern

This should become a reusable product component.

The system should surface exceptions such as:

```text
Membership expiring
Member inactive
Credits almost exhausted
Lead follow-up overdue
Session nearly full
Waitlist available
Trainer conflict
Equipment unavailable
Incomplete assessment
Automation failure
```

Each item must be actionable.

Example:

```text
6 leads overdue for follow-up

[Review Leads]
```

not merely:

```text
6 overdue
```

This pattern should appear differently in:

- Command
- Ops
- Coach
- Front Desk
- Platform

but share a common underlying design system.

---

# 8. Finish FITOS Ops

The manager workspace should become the “next six hours” screen.

Primary sections:

```text
Happening Now

Next Sessions

Expected Arrivals

Staff On Duty

Capacity Alerts

Operational Issues

Follow-Ups Due
```

Quick actions:

```text
Book Member
Add Walk-In
Create Session
Add Member
Open Front Desk
```

Avoid long-term executive analytics here.

Ops must answer:

> What needs intervention today?

---

# 9. Finish Front Desk as a speed tool

The reception interface has improved significantly and now properly uses the shared branch context.

Now optimize it for **2–3 second operations**.

The search input should support:

```text
/
/ focus search

ArrowDown
ArrowUp

Enter
select

Escape
clear
```

Search by:

```text
name
phone
member number
email
```

Results must show enough information to disambiguate similar names.

Example:

```text
AMINA NJERI
FIT-00231
0712 *** ***
Active

18:00 Pilates Foundations
Confirmed

[Check In]
```

---

# 10. Make check-in session aware

Current Front Desk ultimately performs a generic member check-in.

Upgrade this.

When the receptionist selects a member:

```text
Is there a confirmed booking between
-30 minutes and +120 minutes?
```

If yes:

```text
Amina Njeri

18:00 Pilates Foundations
Confirmed

[Check Into Pilates]
[Facility Visit Instead]
```

If multiple:

```text
Which session are they attending?
```

If none:

```text
No scheduled booking found.

[Facility Check-In]
[Book Session]
```

Guard against duplicate check-ins.

---

# 11. Add quick member drawer

Reception should not navigate away merely to inspect someone's account.

Selecting a member should open a right-side drawer on desktop and bottom sheet/full-screen sheet on mobile.

Show:

```text
Member
Status
Membership
Credits
Upcoming booking
Last visit
Warnings
```

Quick actions:

```text
Check In
Book
View Membership
Add Note
Open Full Profile
```

This pattern can later be reused in CRM and bookings.

---

# 12. Complete session roster workflows

Trainer and reception should both have useful session rosters.

Roster needs:

```text
Booked
Arrived
Late
Absent
Cancelled
Waitlisted
```

Actions:

```text
Mark present
Mark no-show
Undo attendance
Add walk-in
Open member
```

Bulk action:

```text
Mark remaining attendees present
```

but require confirmation.

---

# 13. Finish FITOS Coach

The trainer workspace should center around **My Day**.

Not gym analytics.

Example:

```text
JANE'S DAY

09:00 Strength Foundations
8 booked
6 arrived

11:00 PT
Amina Njeri

13:00 Assessment
Kevin Mwangi

17:30 HIIT
14 booked
```

Clicking a session should reveal:

```text
Roster
Attendance
Relevant notes
Programs
Member restrictions
```

Trainer navigation should stay narrow:

```text
My Day
Schedule
Members
Assessments
Programs / Notes
Profile
```

---

# 14. Finish FITOS Practice

Since therapy and assessments already exist, make Practice coherent rather than leaving them as isolated modules.

Home:

```text
Appointments Today

Notes Requiring Completion

Follow-Ups Due

Recent Assessments
```

Opening a client should show:

```text
profile
assessments
therapy history
notes
appointments
```

Do not expose irrelevant business administration.

---

# 15. Complete the Member product

The member portal should feel like a fitness product, not a smaller admin portal.

Primary mobile navigation:

```text
Home
Book
Schedule
Membership
Profile
```

No sidebars on mobile.

Home should show:

```text
NEXT SESSION

Pilates Foundations
Tomorrow · 18:00

6 CREDITS REMAINING

THIS MONTH
7 visits
```

Then:

```text
Book another session
```

---

# 16. Make member booking genuinely self-service

Every occurrence returned to the member client should include authoritative eligibility.

Example response:

```ts
{
  canBook: false,
  reasonCode: "INSUFFICIENT_CREDITS",
  message: "You need 2 credits but have 1 remaining."
}
```

Possible reason codes:

```text
FULL
WAITLIST_ONLY
ALREADY_BOOKED
INSUFFICIENT_CREDITS
MEMBERSHIP_EXPIRED
MEMBERSHIP_INACTIVE
OUTSIDE_BOOKING_WINDOW
SERVICE_NOT_INCLUDED
WRONG_BRANCH
CANCEL_WINDOW_PASSED
```

The frontend should never recreate booking policy logic independently.

---

# 17. Complete member cancellation and rescheduling

A modern member expects:

```text
Book
Cancel
Reschedule
Join Waitlist
Leave Waitlist
```

If cancellation would lose credits:

```text
This session begins in 2 hours.

Your cancellation window has passed.
1 credit will not be returned.

[Keep Booking]
[Cancel Anyway]
```

No mysterious error message after pressing cancel.

---

# 18. Finish public booking

The public site now supports an actual reservation rather than merely collecting a lead, which is an important step forward.

Now polish the journey.

Expected flow:

```text
Public Site
↓
Timetable
↓
Select Class
↓
Contact Details
↓
Confirm Reservation
↓
Confirmed / Waitlisted
```

After success show:

```text
YOUR SPOT IS CONFIRMED

Pilates Foundations
Friday 18:00
Studio A

Reference: FT-7A92
```

Do not merely say:

```text
We'll contact you shortly
```

if the reservation is actually confirmed.

---

# 19. Make capacity states visually obvious

Every booking surface should consistently expose:

```text
AVAILABLE
3 LEFT
FULL
WAITLIST
CANCELLED
```

Use a single shared capacity component.

Examples:

```text
12 / 12
FULL
Join Waitlist
```

or:

```text
9 / 12
3 LEFT
Reserve
```

The repository now performs row-level locking for public capacity decisions, which is the correct backend foundation.

---

# 20. Correct timezone handling everywhere

Avoid:

```ts
new Date(x).getDay();
```

for tenant-business scheduling logic.

Use:

```text
tenant timezone
branch timezone override
```

everywhere class-day boundaries matter.

This affects:

- public timetable
- Today's sessions
- booking windows
- reporting
- reminders
- attendance windows
- opening hours

A Nairobi gym should not suddenly think Tuesday has become Wednesday because someone's browser happens to be elsewhere.

---

# 21. Remove public-site fabricated claims

Public templates must never invent facts.

Remove generic assumptions such as:

```text
Certified trainers
5-star experience
High-performance facility
Opening hours
Address
Member count
Years in business
```

unless configured.

Current public UI still contains some template-style marketing language.

Public rendering should be:

```text
data exists → show it
data missing → omit section
```

not:

```text
data missing → invent a nice-looking answer
```

---

# 22. Fix all identity navigation

There must be zero ambiguity between:

```text
Staff Login
Member Login
Platform Login
```

Current public footer still contains a Member Portal link pointing to the staff login route.

Fix all occurrences.

Use:

```text
Staff Login → /login

Member Portal → /member?tenant=slug

Platform → /platform/login
```

---

# 23. Complete authentication UX

The platform now has different user identities, so the product needs full identity journeys.

Build:

```text
Staff
/login
/forgot-password
/reset-password/:token

Member
/member/login
/member/forgot-password
/member/reset-password/:token

Platform
/platform/login
```

Also:

```text
/invite/:token
```

for staff invitations.

Temporary passwords should not become the normal invitation workflow.

---

# 24. Add proper session-expired handling

Do not throw users back onto login with no explanation.

Show:

```text
YOUR SESSION EXPIRED

For security, please sign in again.

[Sign In]
```

Preserve the previous URL.

After login:

```text
return to intended route
```

---

# 25. Build staff invitations properly

Owner flow:

```text
Invite Staff

Name
Email
Role
Branches

[Send Invitation]
```

Staff receives an invitation token.

Then:

```text
Accept invitation
Set password
Complete profile
Enter assigned workspace
```

Invitation states:

```text
pending
accepted
expired
revoked
```

---

# 26. Finish multi-role staff

The repository now supports multiple staff role assignments.

Build the UX completely around that.

Example:

```text
JANE WANGARI

Manager
Trainer

Branches
✓ Westlands
✓ Kilimani

Available workspaces
✓ Ops
✓ Coach
```

Do not force Jane into a single role dropdown if the data model already knows better.

---

# 27. Build proper Settings information architecture

The attached platform/tenant settings architecture correctly distinguishes:

**Platform owns the SaaS.
Tenant owns the business.
Branch owns local operations.
Users own personal settings.**

Turn `/app/settings` into a real control centre.

Recommended structure:

```text
BUSINESS
Business Profile
Branches
Regional Settings

OPERATIONS
Booking Rules
Scheduling
Attendance
Memberships & Credits

PEOPLE
Team
Roles & Permissions
Member Settings
CRM

EXPERIENCE
Member Portal
FITOS Sites
Branding
Notifications

FACILITY
Rooms
Equipment
Inventory

DATA
Import
Export
Audit

SECURITY
Authentication
Sessions
Access

ACCOUNT
Plan & Usage
Feature Access
```

Payments remain hidden/deferred.

---

# 28. Complete Branch settings

The backend already supports richer branch details than the current UI has historically exposed.

A branch needs:

```text
Name
Phone
Email
Address
City
Country
Timezone
Operating Hours
Rooms
Services
Team
```

Branch page:

```text
GENERAL
HOURS
ROOMS
SERVICES
TEAM
BOOKING RULES
PUBLIC INFO
```

---

# 29. Add operating hours

Support:

```text
Monday     05:30–22:00
Tuesday    05:30–22:00
...
Sunday     Closed
```

Also design for:

```text
Temporary closure
Holiday hours
Maintenance closure
```

A closed branch should not accidentally expose bookable availability.

---

# 30. Complete Booking Rules

Tenant defaults:

```text
Booking opens
Booking closes
Cancellation window
Maximum future bookings
Maximum daily bookings
Waitlist enabled
Auto promotion
Late cancellation handling
No-show handling
```

Service may override tenant defaults.

Eventually resolve:

```text
Service override
↓
Branch override
↓
Tenant default
```

Do not scatter these rules across components.

---

# 31. Complete Attendance rules

Settings should govern:

```text
Early check-in window
Late check-in window
Facility check-in
Session booking requirement
Duplicate prevention
Reception override
Trainer attendance permissions
```

The UI should explain current effective rules.

---

# 32. Complete Membership rules

Memberships currently exist as a domain.

Now complete normal lifecycle expectations:

```text
Draft
Active
Paused/Frozen
Expired
Cancelled
```

Actions:

```text
Activate
Freeze
Unfreeze
Cancel
Extend
Add Credits
Adjust Credits
```

Sensitive manual adjustments require:

```text
reason
actor
timestamp
```

Payment-related activation remains deferred.

---

# 33. Make credit history understandable

A member's credit balance alone is insufficient.

Show ledger:

```text
+10  Membership activated
-1   Pilates booking
+1   Valid cancellation
-1   Strength class
+2   Staff adjustment
```

For staff adjustments:

```text
Reason required
```

This reduces disputes dramatically.

---

# 34. Finish CRM workflow

CRM should work as a pipeline, not merely a table.

Default stages:

```text
New
Contacted
Trial Booked
Trial Completed
Offer
Joined
Lost
```

Lead card should show:

```text
name
source
interest
assigned staff
last activity
next task
```

Drag/drop can come later.

First make stage changes reliable and mobile-friendly.

---

# 35. Finish follow-up tasks

CRM requires actual follow-up functionality.

Lead page:

```text
Next follow-up
Tomorrow 10:00

Assigned to
Jane

[Complete]
[Reschedule]
```

Also surface overdue tasks in:

```text
Command
Ops
CRM
```

---

# 36. Complete lead conversion

Conversion should be a deliberate workflow.

```text
CONVERT TO MEMBER

Existing contact found?
Amina Njeri

Member number
Preferred branch
Membership
Start date

[Create Member]
```

Do not duplicate contacts unnecessarily.

---

# 37. Complete Automations rather than expanding them

The worker now has real automation dispatch and simulation support.

That is good.

But `create_staff_task` and `update_crm_stage` still return skipped because durable internal handlers are not yet implemented.

Finish those.

Required action types:

```text
Send Email
Send SMS
Send WhatsApp
Create Staff Task
Update CRM Stage
```

Do not add another 12 actions until these five are reliable.

---

# 38. Make automation execution states explicit

Every execution should show:

```text
Queued
Processing
Succeeded
Failed
Skipped
Simulated
```

Individual action result:

```text
Delivered
Failed
Skipped
Simulated
```

Never use vague:

```text
Done
```

for an external communication.

---

# 39. Test Run must clearly mean simulation

Default:

```text
TEST AUTOMATION

Simulation mode
No messages will be sent.

[Run Simulation]
```

Then show:

```text
Trigger matched
Conditions passed

Action 1
WhatsApp
SIMULATED

Action 2
Create staff task
SIMULATED
```

Only expose real delivery when providers are intentionally configured.

---

# 40. Hide payment-dependent automation triggers

Because payments are deferred, do not expose triggers such as:

```text
Payment failed
Payment received
Invoice overdue
```

as if they are operational.

Either:

```text
hide
```

or:

```text
Coming with FITOS Pay
```

---

# 41. Finish Insights truthfulness

Insights must have a zero-fabrication rule.

If comparison data doesn't exist:

```text
No comparison data
```

not:

```text
+8%
```

If retention cannot be calculated:

```text
—
```

which the latest code has begun doing correctly.

Audit every metric for fallback constants.

Especially inspect:

```text
retention
lead conversion
heatmaps
program performance
occupancy
member growth
```

Remove any demo fallbacks.

---

# 42. Define analytics metrics formally

Create a simple internal specification.

Example:

```text
ACTIVE MEMBER
Member whose current membership state permits use.

90-DAY RETENTION
Members active 90 days ago who remain active today / eligible cohort.

OCCUPANCY
confirmed attendance or bookings / effective session capacity.

LEAD CONVERSION
converted leads / qualified leads in defined period.
```

Frontend labels must derive from these definitions.

---

# 43. Buttons must obey the “truth rule”

Every visible action must be one of three things:

```text
WORKS
```

or:

```text
DISABLED
with explanation
```

or:

```text
HIDDEN
```

Never:

```text
button that looks functional but is decorative
```

Audit every screen for:

```text
Export
Send WhatsApp
Upgrade
Publish
Invite
Edit
Delete
Download
Print
Share
Retry
```

---

# 44. Standardize responsive behavior

Set formal product breakpoints.

```text
<640px
Phone

640–899px
Large phone / small tablet

900–1199px
Tablet / compact desktop

1200px+
Desktop
```

Every feature is incomplete until tested at all four widths.

---

# 45. Kill horizontal-scroll tables on phones

Tables are acceptable on desktop.

On phone, transform important tables into cards.

Example Members desktop:

```text
Name | Membership | Last Visit | Status | Branch
```

Phone:

```text
AMINA NJERI
Active Membership

Last visit
Yesterday

Westlands

ACTIVE

[Open]
```

Implement one shared component:

```text
<DataTable
  desktopColumns={...}
  mobileRenderer={...}
/>
```

Use it throughout.

---

# 46. Mobile navigation by workspace

Do not simply shrink the desktop sidebar.

Recommended:

**Member**

```text
Home
Book
Schedule
Membership
Profile
```

**Front Desk**

Minimal interface, no global sidebar.

**Coach**

```text
Today
Schedule
Members
Profile
```

**Ops**

compact drawer or bottom action rail.

Command can use a drawer because owners access more modules.

---

# 47. Touch ergonomics

Interactive controls should generally have at least approximately:

```text
44×44 px
```

Targets that must be touch-safe:

```text
buttons
tabs
day selectors
dropdown triggers
table actions
checkboxes
calendar arrows
close icons
```

Do not place five 18px icons next to each other and call it mobile responsive.

---

# 48. Fix modal behavior on phones

Desktop:

```text
centered modal
```

Phone:

```text
bottom sheet
```

or full-screen workflow.

Rules:

```text
No modal wider than viewport
No buttons below inaccessible keyboard
No unscrollable content
Focus trapped
Escape closes when safe
Unsaved changes protected
```

---

# 49. Create standard page states

Every data-driven page must have:

```text
Loading
Loaded
Empty
Error
Permission denied
Offline/network failure where applicable
```

Not just spinner vs success.

Example empty CRM:

```text
NO LEADS YET

New enquiries from your public site and staff
will appear here.

[Add Lead]
```

---

# 50. Improve loading UX

Avoid blank screens.

Use:

```text
skeleton cards
skeleton rows
placeholder schedule
```

for major workspaces.

Do not block the entire app because one widget is loading.

---

# 51. Build meaningful error UX

Translate domain errors.

Bad:

```text
409 CONFLICT
```

Good:

```text
This class is now full.

You can join the waitlist instead.

[Join Waitlist]
```

Bad:

```text
INSUFFICIENT_CREDITS
```

Good:

```text
Amina has 1 credit remaining.
This class requires 2.
```

---

# 52. Add global toast notifications

Mutations should acknowledge success.

Examples:

```text
Member created
Booking confirmed
Attendance updated
Lead moved to Trial
Branch saved
Automation simulated
```

Error toast:

```text
Booking couldn't be created.
The session became full.
```

Do not silently mutate UI state.

---

# 53. Add undo where appropriate

Good candidates:

```text
Archive lead
Remove staff assignment
Cancel booking
Mark no-show
```

Toast:

```text
Booking cancelled.

[Undo]
```

Use only where rollback semantics are safe.

---

# 54. Replace browser dialogs

No:

```js
confirm();
alert();
prompt();
```

Use FITOS:

```text
Modal
ConfirmationDialog
DangerDialog
```

Consistent styling and messaging.

---

# 55. Standardize forms

Every FITOS form should use shared:

```text
label
hint
required state
validation
error
disabled
loading
success
```

Do not use placeholder text as the only label.

For phone:

```text
Kenyan-friendly normalization
```

Display readable format while storing canonical normalized values.

---

# 56. Protect unsaved edits

When editing:

```text
Business settings
Site content
Automation
Membership
Service
Schedule
```

and the user attempts to leave:

```text
You have unsaved changes.

[Discard]
[Keep Editing]
```

---

# 57. Improve global search

FITOS should eventually support a command/search pattern.

Search across permitted entities:

```text
Members
Leads
Bookings
Staff
Services
```

Typing:

```text
Amina
```

could produce:

```text
MEMBERS
Amina Njeri

LEADS
Amina W.

BOOKINGS
Amina Njeri · Pilates · Today
```

Do not expose entities the user's permissions do not allow.

---

# 58. Build entity breadcrumbs/context

When opening:

```text
Members → Amina Njeri → Attendance
```

the user should always understand where they are.

Complex pages should expose:

```text
breadcrumb
entity name
status
primary action
```

---

# 59. Improve member detail architecture

Avoid a single endlessly scrolling profile.

Recommended tabs:

```text
Overview
Membership
Bookings
Attendance
Notes
Assessments
Activity
```

Depending on permission and feature availability.

Overview:

```text
identity
membership
credits
next booking
last visit
risk status
```

---

# 60. Add activity timelines

Reusable component:

```text
27 Aug
Checked into Pilates

26 Aug
Booking created

24 Aug
Membership adjusted
+2 credits

21 Aug
Lead converted
```

Useful for:

```text
member
lead
staff
tenant platform record
```

---

# 61. Make archive vs delete explicit

Operational data should generally be:

```text
Archived
Inactive
Cancelled
```

rather than physically deleted.

Audit all delete buttons.

Use actual deletion only for appropriate non-record entities.

Examples that usually should not hard delete:

```text
member
attendance
booking history
membership
lead after conversion
assessment
therapy record
audit event
```

---

# 62. Complete Sites without turning it into Wix

Keep Sites schema-driven.

Sections:

```text
Hero
Services
Schedule
Coaches
Locations
About
CTA
Contact
```

Each section:

```text
enabled
content
order
```

Preview:

```text
Desktop
Tablet
Mobile
```

Publish explicitly.

Do not allow raw HTML builders yet.

---

# 63. Finish Sites publishing states

Use:

```text
Draft
Published
Changed since publish
Unpublished
```

Show:

```text
Last published
27 Aug · 14:41
```

Changes must not automatically become public unless explicitly designed that way.

---

# 64. Add onboarding by role

Owner onboarding:

```text
Business
Branch
Services
Membership
Schedule
Team
Public Booking
```

Trainer onboarding:

```text
Profile
Availability
Assigned sessions
```

Reception onboarding:

```text
Search
Check-in
Booking
```

Member onboarding:

```text
Profile
Membership
First booking
```

Do not give everyone the same checklist.

---

# 65. Make onboarding server-derived

Do not calculate onboarding completion purely from frontend local assumptions.

Return:

```ts
{
  business: true,
  branch: true,
  services: true,
  membership: false,
  schedule: false,
  team: true,
  publicBooking: false
}
```

Then build UI around it.

---

# 66. Complete Platform as a control plane

FITOS Platform is now its own surface, which is correct.

Build toward:

```text
Overview
Tenants
Implementation
Features
Usage
Support
System
Audit
```

But for this completion sprint prioritize:

```text
Overview
Tenant directory
Tenant detail
Lifecycle status
Implementation
```

before adding advanced operations.

The Platform/Tenant/Branch/User sovereignty model from the planning material should guide every settings decision.

---

# 67. Finish Platform tenant detail

Opening a tenant should give:

```text
Tenant
Status
Plan
Activation
Branches
Staff count
Member count
Feature access
Usage
Created
```

Then:

```text
Overview
Usage
Entitlements
Branches
Users
Activation
Audit
```

Do not expose raw member records by default.

---

# 68. Platform logout must revoke the token

The API now has a proper platform logout endpoint.

The frontend should call it before deleting the local token.

Flow:

```text
POST /platform/auth/logout
↓
clear client credential
↓
redirect
```

Not merely:

```text
localStorage.removeItem(...)
```

---

# 69. Build Account/Profile settings

Every staff user should have:

```text
Name
Email
Phone
Password
Preferred workspace
Notification preferences
Active sessions
```

Tenant owner settings and individual-account settings are different things.

Do not bury user account security inside organization settings.

---

# 70. Add import UX

This is commercially important for onboarding real gyms.

Support initially:

```text
Members CSV
Staff CSV
Services CSV
```

Flow:

```text
Upload
Map Fields
Validate
Preview
Import
Results
```

Before import:

```text
1,248 valid
23 warnings
7 errors
```

Never silently import malformed records.

---

# 71. Add export UX

Exports can remain simple.

Examples:

```text
Members CSV
Attendance CSV
Leads CSV
Bookings CSV
```

If large:

```text
Preparing export…
```

then downloadable when ready.

This is not payment-related and strongly improves trust in a business platform.

---

# 72. Add audit visibility

Owners should be able to inspect important changes.

Examples:

```text
Jane changed Amina's credits
6 → 8

Dave changed cancellation window
6h → 12h

Manager marked booking no-show
```

Audit is especially important for:

```text
membership
credits
attendance overrides
permissions
settings
staff access
```

---

# 73. Accessibility baseline

Require:

```text
Keyboard usable
Visible focus
Semantic labels
Form errors connected to fields
Color not sole status indicator
Reasonable contrast
Screen reader names for icon buttons
```

This also improves automation and testing quality later.

---

# 74. Design-system cleanup

Stop solving the same problem separately in every feature.

Create canonical components for:

```text
PageHeader
SectionHeader
KpiCard
StatusBadge
CapacityBadge
DataTable
MobileEntityCard
EmptyState
ErrorState
Skeleton
Modal
Drawer
ConfirmationDialog
Toast
Tabs
SearchInput
FilterBar
DatePicker
MemberChip
BranchSelector
ActivityTimeline
AttentionItem
```

The SaaS should start to feel built from one grammar.

---

# 75. Standardize density

Use three density modes conceptually:

```text
Executive
spacious, signals-first

Operations
medium, action-heavy

Front Desk
large controls, speed-first
```

Do not make Reception look like Analytics.

Do not make Command look like a POS.

---

# 76. Standardize terminology

Pick canonical words and enforce them.

Example:

```text
Member
not Client/User/Customer randomly

Session
not Class/Event/Occurrence in human UI

Branch
not Location/Facility randomly

Trainer
or Coach, decide surface language

Membership
Credits
Booking
Check-in
Lead
```

Internal technical nouns like `occurrence` should not leak into customer UI.

---

# 77. Add a product-wide feature completion checklist

A feature is **not complete** merely because its Create page works.

Every feature must support, where applicable:

```text
Discover
List
Search
Filter
View
Create
Edit
Change status
Archive/delete
Permissions
Branch scoping
Validation
Success feedback
Errors
Loading
Empty state
Phone layout
Tablet layout
Desktop layout
Activity/audit where relevant
```

This becomes the team's definition of product completeness.

---

# 78. Module completion targets

Before calling this sprint finished:

| Module         | Completion target |
| -------------- | ----------------: |
| Command        |               95% |
| Ops            |               95% |
| Front Desk     |               95% |
| Coach          |               90% |
| Practice       |               90% |
| Members        |               95% |
| CRM            |               90% |
| Booking        |               95% |
| Scheduling     |               95% |
| Attendance     |               95% |
| Memberships    |               90% |
| Public booking |               95% |
| Member portal  |               95% |
| Automations    |            85–90% |
| Insights       |               90% |
| Sites          |            85–90% |
| Settings       |               90% |
| Platform       |            85–90% |
| Responsive UX  |               95% |

Payment completeness is excluded.

CI completeness is excluded.

---

# 79. Golden journeys the team must manually validate

### Owner

```text
Login
→ Command
→ switch branch
→ inspect attention
→ add member
→ assign membership
→ create booking
→ inspect schedule
→ review CRM
```

### Reception

```text
Login
→ Front Desk
→ search Amina
→ see booking
→ check into correct class
→ inspect member
→ book another session
```

### Trainer

```text
Login
→ Coach
→ open today's class
→ view roster
→ mark attendance
→ open member
→ add permitted note
```

### Member

```text
Login
→ see membership/credits
→ browse schedule
→ book class
→ see booking
→ cancel/reschedule
```

### Public visitor

```text
Tenant site
→ timetable
→ reserve
→ confirmed/waitlist
→ member sign-in route
```

### Platform admin

```text
Platform login
→ overview
→ tenants
→ inspect tenant
→ lifecycle action
→ audit
→ logout
```

If any journey requires a developer to explain what to click next, the UX is not finished.

---

# 80. Responsive acceptance matrix

Manually inspect every priority page at:

```text
390 × 844
768 × 1024
1024 × 768
1440 × 900
```

Required:

```text
No body horizontal scroll
No inaccessible controls
No clipped dialogs
No overlapping typography
No tiny touch targets
No desktop table forced onto phone
No hidden primary action
No content underneath fixed navigation
```

---

# 81. The sprint priority order

Tell the team to execute in this order:

### Wave 1: Core operating experience

```text
Role/workspace navigation polish
Command
Ops
Front Desk
Coach
Branch context
Responsive shell
```

### Wave 2: Core journeys

```text
Booking
Scheduling
Attendance
Membership
Member portal
Public booking
```

### Wave 3: Customer management

```text
Members
CRM
Staff roles
Invitations
Settings
```

### Wave 4: Product intelligence

```text
Automations
Insights
Sites
```

### Wave 5: SaaS administration

```text
Platform tenant management
Onboarding
Import/export
Audit
```

### Wave 6: Polish

```text
mobile
tablet
accessibility
empty states
loading
errors
toasts
confirmation dialogs
terminology
design consistency
```

Only after this should the team return to deferred infrastructure/payment work.

---

# Explicitly deferred

Put this section into the sprint brief so nobody “helpfully” wanders sideways:

```text
OUT OF SCOPE

M-Pesa
Cards
Payment providers
Payment reconciliation expansion
Self-service billing
Subscription charging
Financial reporting
Production deployment
Infrastructure expansion
CI repair
GitHub Actions
Branch protection
Prometheus work
Backups
AI assistant
Marketplace
Native apps
Payroll
Accounting
```

The existing Payments route should be feature-flagged or clearly labelled unavailable rather than becoming a magnet for engineering time.

---

# Definition of Done

The team should not say “v2 is done” until:

1. Every primary role lands in a purpose-built workspace.
2. Every visible primary button works or is intentionally disabled/hidden.
3. Branch-sensitive operations use the active branch consistently.
4. Staff and member identities never cross over.
5. Public users can actually reserve a class.
6. Members can actually manage their bookings.
7. Reception can check someone in rapidly and correctly.
8. Trainers can run their day without owner screens.
9. No analytics card fabricates numbers.
10. No public page fabricates business facts.
11. Every primary workflow survives empty data.
12. Every primary workflow displays useful failures.
13. Forms behave consistently.
14. Mutations show success/error feedback.
15. Tables have proper mobile alternatives.
16. Priority screens work at phone, tablet and desktop widths.
17. Settings are logically organized by platform/tenant/branch/user.
18. Incomplete payment features do not masquerade as complete.
19. Incomplete integrations do not claim successful delivery.
20. A normal fitness business day can run end-to-end without leaving FITOS.

The single instruction I would pin above the developers' desks is:

> **Stop measuring FITOS by how many modules exist. Measure it by how few moments make a real user wonder “what am I supposed to do now?” Every screen must tell the truth, every important action must finish its job, and every workspace must feel designed for the human sitting in it.**

That is the work that will move FITOS from roughly **high-80s product maturity into the 90%+ zone**, without touching the intentionally deferred payment or CI layers.
