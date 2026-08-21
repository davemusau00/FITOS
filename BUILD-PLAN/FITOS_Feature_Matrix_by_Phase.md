# FITOS Feature Matrix by Phase

**Baseline:** `0d28885c3d52cd6e04d7561423845a86a15b3e4e`  
**Rule:** Payment provider integration is deferred to the final phase.

| Phase | Product Area | Feature | Current State | Target State | Priority |
|---|---|---|---|---|---|
| 0 | Shell | Permission-aware sidebar | Exists | Grouped role-aware nav | P0 |
| 0 | Shell | Global branch context | Partial | Persistent branch switcher | P0 |
| 0 | Shell | Quick Create | Missing | Universal create menu | P0 |
| 0 | Shell | Command palette | Missing | Search + actions | P1 |
| 0 | Shell | Toasts | Missing | App-level feedback | P0 |
| 1 | UI | Design tokens | Exists | Extended complete system | P0 |
| 1 | UI | Data table | Exists | Responsive DataView | P0 |
| 1 | UI | Mobile cards | Partial | Standardized | P0 |
| 1 | UI | Filter drawers | Missing | Mobile/tablet filters | P0 |
| 1 | UI | Bottom sheets | Missing | Mobile modal pattern | P1 |
| 1 | UI | Sticky mobile actions | Missing | Standardized | P0 |
| 2 | Onboarding | Business setup | Partial | Guided flow | P0 |
| 2 | Onboarding | Completion detection | Minimal | Auto-detected checklist | P0 |
| 2 | Onboarding | First schedule/member/booking | Missing from onboarding | Guided | P0 |
| 3 | Today | Owner dashboard | Basic | Operational command centre | P0 |
| 3 | Today | Reception dashboard | Missing | Expected arrivals/check-in | P0 |
| 3 | Today | Trainer dashboard | Missing | Today + rosters | P1 |
| 3 | Today | Exceptions/tasks | Missing | Action queue | P0 |
| 4 | Members | Directory | Exists | Responsive + saved views | P0 |
| 4 | Members | Member profile | Exists | Tabs + sticky summary | P0 |
| 4 | Members | Tags/segments | Missing | Segmentation | P1 |
| 4 | Leads | Lead table | Exists | Pipeline + list | P0 |
| 4 | Leads | Notes/tasks | Exists | Dedicated workspace | P0 |
| 4 | Leads | Lost reason | Browser prompt | Designed dialog | P0 |
| 5 | Memberships | Plans | Exists | Full plan builder | P0 |
| 5 | Memberships | Credit ledger | Exists | Polished audit view | P0 |
| 5 | Memberships | Holds | Partial | Hold/resume lifecycle | P1 |
| 5 | Memberships | Renewals | Missing/partial | Renewal queue | P1 |
| 5 | Memberships | Retention flags | Missing | At-risk / expiring | P0 |
| 6 | Schedule | FullCalendar week | Exists | Day/week/agenda | P0 |
| 6 | Schedule | Recurring templates | Exists | Polished manager | P0 |
| 6 | Schedule | Exceptions | Exists | UI-first override flow | P0 |
| 6 | Schedule | Occupancy | Partial | Visible on event cards | P0 |
| 6 | Schedule | Mobile agenda | Missing | Default mobile view | P0 |
| 6 | Schedule | Duplicate occurrence | Missing | Quick duplicate | P1 |
| 7 | Bookings | Staff wizard | Exists | Context-aware enhanced | P0 |
| 7 | Bookings | Capacity | Exists | Better visual warnings | P0 |
| 7 | Bookings | Entitlement preview | Partial | Pre-confirmation summary | P0 |
| 7 | Bookings | Reschedule | Limited | Full workflow | P0 |
| 8 | Attendance | Check-in search | Exists | Reception-first | P0 |
| 8 | Attendance | Member identity | ID-heavy | Human-readable | P0 |
| 8 | Attendance | Roster | Exists | Fast roster actions | P0 |
| 8 | Attendance | Expected arrivals | Missing | Today/reception | P0 |
| 9 | Public | Tenant site | Missing | Full branded site | P0 |
| 9 | Public | Public schedule | Missing | Responsive timetable | P0 |
| 9 | Public | Class detail | Missing | Public detail | P0 |
| 9 | Public | Booking without payment | Missing | Reservation flow | P0 |
| 10 | Portal | Member login | Missing | Self-service auth | P0 |
| 10 | Portal | Upcoming bookings | Missing | Mobile-first | P0 |
| 10 | Portal | Cancel/reschedule | Missing | Self-service | P0 |
| 10 | Portal | Membership/credits | Missing | Self-service | P0 |
| 11 | Automation | Template library | Missing | Reminder/retention | P0 |
| 11 | Automation | Trigger rules | Missing | Rule builder | P0 |
| 11 | Automation | Worker foundation | Exists | Productized | P0 |
| 11 | Automation | Run history | Missing | Automation audit UI | P1 |
| 12 | Analytics | Basic overview | Exists | Operational analytics | P0 |
| 12 | Analytics | Attendance analytics | Missing | Trends/no-shows | P0 |
| 12 | Analytics | Occupancy | Missing | Utilization | P0 |
| 12 | Analytics | Lead funnel | Missing | Source + conversion | P1 |
| 12 | Analytics | Retention | Missing | Cohort-ready | P1 |
| 12 | Analytics | Exports | Missing | CSV reports | P1 |
| 13 | Polish | Global search | Missing | Cross-domain | P1 |
| 13 | Polish | Saved views | Missing | Lists/pipelines | P1 |
| 13 | Polish | Keyboard shortcuts | Minimal | High-frequency | P1 |
| 13 | Polish | Visual regression | Missing | Key breakpoints | P1 |
| 13 | Polish | Accessibility | Partial | Full audit | P0 |
| 14 | Payments | Internal ledger | Exists | Productized | Final |
| 14 | Payments | M-Pesa STK | Missing | Live provider adapter | Final |
| 14 | Payments | M-Pesa callback | Missing | Idempotent callback | Final |
| 14 | Payments | Card provider | Missing | Live checkout | Final |
| 14 | Payments | Invoices | Missing | Invoice lifecycle | Final |
| 14 | Payments | Recurring billing | Missing | Provider-backed | Final |
| 14 | Payments | Financial analytics | Deferred | Revenue dashboard | Final |

## P0 Before Public Pilot
SaaS shell; responsive data system; onboarding; Today dashboard; member profile; leads workspace; memberships/retention; schedule UX; booking UX; attendance/reception; public site/schedule; member portal; automation foundation; operational analytics; accessibility/responsive QA.

## Explicitly Deferred
M-Pesa, card provider, recurring collection, invoices, payment links, payment recovery, and payment-derived revenue analytics.
