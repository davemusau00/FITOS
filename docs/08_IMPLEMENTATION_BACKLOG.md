# 08 — Implementation Backlog

## Epic A — Finish current SaaS prototypes

A001 Persistent BranchContext
A002 Branch-aware query helpers
A003 Public tenant read API
A004 Public lead/reservation API
A005 Member identity schema
A006 Member login/session API
A007 Member-scoped API
A008 Replace hard-coded Insights metrics
A009 Aggregate analytics queries
A010 Persist automation definitions
A011 Automation worker execution
A012 Automation run history
A013 Reception expected arrivals
A014 Reception entitlement warnings
A015 Real occupancy counts

## Epic B — Self-service SaaS

B001 Public signup
B002 Tenant bootstrap transaction
B003 Trial lifecycle
B004 SaaS plan schema
B005 Capability package engine
B006 Usage counters
B007 Quota enforcement
B008 Account settings/export/cancel
B009 Feature flags
B010 Platform tenant admin

## Epic C — SaaS productivity

C001 Global tasks
C002 Today action queue
C003 Notifications center
C004 Member tags
C005 Segments
C006 Saved views
C007 CSV import framework
C008 Member import
C009 Lead import
C010 Membership/staff import

## Epic D — Equipment

D001 Contracts
D002 Migrations
D003 Repository
D004 API
D005 Asset registry UI
D006 Pools
D007 Service requirements
D008 Occurrence reservations
D009 Resource-aware capacity
D010 Downtime
D011 Maintenance
D012 Calibration
D013 Alerts

## Epic E — Inventory

E001 Contracts/schema
E002 Stock movements
E003 Dashboard
E004 Suppliers
E005 Purchase orders
E006 Lots/expiry
E007 Stocktakes
E008 Reorder rules
E009 Service BOM
E010 Session consumption

## Epic F — Assess

F001 Contracts/schema
F002 Definitions/categories
F003 Protocol versioning
F004 Metric definitions
F005 Sessions
F006 Results
F007 Attachments/provenance
F008 Performance Lab UI
F009 Member Assessments tab
F010 Progress charts
F011 Batteries
F012 Retest scheduling

## Epic G — Therapy

G001 Modalities
G002 Protocols/versioning
G003 Sessions
G004 Parameters/equipment
G005 Safety checklists
G006 Consent linkage
G007 Credentials
G008 Service credential requirements
G009 Therapy workspace
G010 Member Therapy tab

## Epic H — Integrations

H001 Connection schema
H002 Adapter contract
H003 Sync worker/checkpoints
H004 Generic CSV import
H005 Mapping/versioning
H006 Subject matching
H007 Duplicate detection
H008 Import error queue
H009 InBody adapter
H010 VALD adapter
H011 COSMED import
H012 PNOE import
H013 Generic therapy-device import

## Epic I — FITOS Sites

I001 Site config/theme
I002 Pages/sections/navigation
I003 Media/SEO
I004 Builder shell
I005 Dynamic class/schedule/trainer/membership blocks
I006 Assessments/therapy/equipment blocks
I007 Preview
I008 Publish/versioning
I009 Custom domains

## Epic J — Specialty experience

J001 Public assessment booking
J002 Public therapy booking
J003 Resource-aware public availability
J004 Member assessment results/progress
J005 Member notifications
J006 Member reschedule
J007 PWA shell

## Epic K — Analytics

K001 Occupancy
K002 No-show/cancellation
K003 Lead conversion
K004 Retention
K005 Equipment utilization/downtime
K006 Assessment volume/retest adherence
K007 Inventory consumption/wastage/expiry
K008 Report presets/export

## Epic L — Platform ops

L001 Platform capabilities
L002 Tenant search/detail
L003 Tenant lifecycle
L004 Plans/capabilities editor
L005 Usage dashboard
L006 Feature flags UI
L007 Support notes/access
L008 Platform audit
L009 Account recovery

## Epic M — Payments

Final phase only. See dedicated document.

## Do not do yet

- Do not build vendor-specific core tables.
- Do not scrape proprietary device dashboards/reports.
- Do not remotely control medical/therapy equipment without explicit vendor support.
- Do not expose internal DTOs through public APIs.
- Do not use email lookup as member authentication.
- Do not ship fake analytics numbers.
- Do not claim automations are active if not persisted/executed.
- Do not start payment-provider work before the final phase.
