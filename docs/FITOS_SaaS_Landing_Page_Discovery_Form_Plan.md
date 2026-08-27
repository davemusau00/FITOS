# FITOS SaaS Landing Page + Business Discovery / Account Seeding Plan

**Repository baseline reviewed:** `v2` @ `2f59aad1d3e779c94eccb3e20b5ec5223e3a3a11`  
**Purpose:** Add the missing FITOS SaaS marketing front door and a structured discovery/onboarding flow that captures enough business detail for the FITOS team to configure and seed a tenant on the client's behalf.

## 1. Current repo status relevant to this plan

The current `v2` router includes `/login`, `/signup`, `/app/*`, `/onboarding`, `/member/*`, and `/:tenantSlug`. There is currently **no dedicated FITOS SaaS marketing landing-page route**.

Recent `v2` work already includes tenant signup, public tenant APIs, member auth first pass, branch context, equipment, inventory, assessments, therapy, assessment provenance, service equipment requirements, and member Assessment/Therapy tabs. The landing-page discovery system therefore extends the existing platform rather than replacing `/signup` or tenant onboarding.

## 2. New public SaaS routes

### Marketing

- `/` — FITOS SaaS landing page
- `/features`
- `/solutions`
- `/solutions/gyms`
- `/solutions/studios`
- `/solutions/performance`
- `/solutions/rehab-wellness`
- `/pricing` — plan explanation only; payment not required yet
- `/contact`
- `/configure` — full discovery wizard
- `/configure/:submissionId/resume` — secure resume link
- `/thank-you`

Existing `/signup` remains self-service tenant creation and `/:tenantSlug` remains tenant public websites. Reserved FITOS marketing routes must be matched before `/:tenantSlug`.

## 3. Landing page conversion strategy

The landing page supports three intents:

1. **Start FITOS** → `/signup` for self-service setup.
2. **Configure FITOS for my business** → `/configure` for assisted setup and developer seeding.
3. **Talk to FITOS** → short contact/demo form.

The assisted-setup route is the primary discovery flow.

## 4. SaaS landing-page structure

### Hero

**Everything fitness. One OS.**

Run members, bookings, schedules, memberships, attendance, performance testing, therapy, equipment, inventory, websites and growth from one operating system.

Primary CTA: **Configure FITOS for my business**  
Secondary CTA: **Start FITOS**  
Tertiary CTA: **See how it works**

### Product proof

Members, Bookings, Front Desk, Assess, Therapy, Equipment, Inventory, Automations, Insights, Sites.

### Solutions

Gyms; Pilates/Yoga/Boutique Studios; Personal Training; Physio/Rehab; Performance Labs; Recovery/Wellness; Multi-location Facilities.

### Built around how you operate

Explain that FITOS can be configured around branches, staff, memberships, classes, equipment, testing, therapy, inventory and custom workflows.

CTA: **Tell us how your business works**.

### Advanced facility

Body composition, metabolic testing, strength/power testing, therapy/recovery protocols, equipment scheduling, consumables and longitudinal progress. Do not imply a vendor API exists unless the connector is live.

### Website + customer experience

Public schedule, tenant website, member portal, booking and FITOS Sites roadmap.

### Automation / Insights

Use only actual or clearly marked upcoming capabilities.

### Plans

Explain conceptual SaaS tiers without payment collection.

### Final CTA

**Build your FITOS setup plan**.

## 5. Discovery wizard UX

Use a multi-step adaptive wizard, not one giant form.

1. About Your Business
2. What You Need
3. Locations
4. Services
5. Schedule & Booking
6. Memberships
7. Team
8. Facilities & Equipment
9. Assessments / Performance
10. Therapy / Recovery
11. Members & Data Migration
12. CRM & Leads
13. Website
14. Member Experience
15. Automations
16. Inventory
17. Analytics
18. Integrations
19. Branding
20. Files & Existing Data
21. Priorities & Timeline
22. Final Workflow Questions
23. Review
24. Submit

Conditional logic hides irrelevant sections, for example no therapy → hide Therapy, no testing → hide Assess, one branch → simplify multi-location questions, no stock → hide Inventory.

## 6. Form content

### About Your Business

Contact name, role, business name, email, phone/WhatsApp, website, social links, country, city, timezone, currency, business category, free-text description, acquisition source.

Business categories include Gym, Fitness Studio, Pilates, Yoga, PT, Physio/Rehab, Sports Performance, Wellness, Recovery, Medical Fitness, Nutrition, Martial Arts, Swimming, Dance, Functional Fitness, Corporate Wellness, Longevity and Other.

### What You Need

Problem/capability checklist covering bookings, members, memberships, attendance, scheduling, CRM, follow-ups, website, member portal, equipment, inventory, assessments, therapy, automations, retention, analytics, multi-location, permissions, spreadsheet/software replacement and custom workflows.

Each capability is tagged Need at launch / Need soon / Nice to have / Not sure. Capture ranked top-five priorities.

### Locations

Branch count and expansion plans. Per branch: name, address, contacts, hours, manager, member estimate, daily footfall, services and notes. Capture cross-branch access, branch-specific memberships/pricing, shared trainers and manager visibility.

### Services

Repeater: name, category, booking type, description, duration, capacity, branches, trainer requirement, room, reference price, credits, public visibility, trial availability, cancellation cutoff, booking notice and notes.

Types: class, PT, appointment, consultation, assessment, therapy, recovery, facility, equipment, court, event, workshop, bootcamp and custom.

### Schedule & Booking

Recurring session repeater plus booking horizon, notice, cancellation, no-show, waitlist, guest, walk-in, staff override, member/public eligibility, max daily bookings, equipment constraints and credential constraints. Allow timetable upload.

### Memberships / Packages

Plan name, description, price reference, duration, credits, unlimited, eligible services/branches, trial, freeze, renewal, visibility and rules for expiry, rollover, family/corporate/trainer/service-specific plans.

### Team

Counts by role plus optional staff repeater with name, email, phone, role, branches, services, specialties, credentials and permissions.

### Facilities & Equipment

Rooms plus equipment repeater: name, manufacturer, model, category, quantity, branch, room, serials, maintenance/calibration, capacity impact and website visibility.

### Assessments / Performance

Body composition, InBody, VO2max, RMR, CPET, strength, force plates, jump, dynamometry, ROM, movement, gait, sprint/agility, balance, vitals, lactate and custom. Device repeater captures manufacturer/model, current data storage, CSV/PDF/cloud availability and desired integration. Prompt examples can include InBody 970/970S, VALD systems, COSMED and PNOE. Capture assessor, consultation prerequisite, retest interval, member-visible metrics and assessment batteries.

### Therapy / Recovery

Physio, manual therapy, NEUBIE/NeuFit, electrical stimulation, AlterG, pneumatic compression/Normatec, cryotherapy, hyperbaric oxygen, infrared sauna, sauna, cold immersion, red light, mobility, stretch therapy, sports massage and custom. Capture session duration, practitioner requirement, equipment, protocol, intake, consent, safety checklist, notes and follow-up.

### Members & Data Migration

Active member count, current storage/software, fields collected, import requirement and file upload.

### CRM / Leads

Sources, customizable pipeline, assignment, tasks, follow-up dates, attribution, lost reasons, trials and referrals.

### Website

Current URL, keep/replace/integrate, pages wanted, visual style, domain and content. Upload brand assets, photography, trainer/facility images, testimonials and brochures.

### Member Experience

Browse, book, cancel, reschedule, credits, membership, attendance, assessments, progress, therapy history, notifications, profile and FITOS Pass.

### Automations

Channels plus booking confirmations/reminders, cancellations, trial/lead follow-up, expiry/renewal, inactivity, birthday, retest, therapy follow-up, maintenance, calibration, low stock, credential expiry and custom automations.

### Inventory

Categories and requirements for suppliers, POs, branch stock, lot/batch, expiry, low stock, stocktakes and service-linked consumption.

### Analytics

Rank members, growth, attendance, occupancy, cancellations, no-shows, expiry, retention, lead conversion, trainer use, branch performance, equipment use, assessment progress, therapy use and inventory. Ask: **What question do you wish your current software could answer?**

### Existing Software & Integrations

Repeater for tool, purpose and keep/replace/integrate, including access-control systems.

### Branding & Customization

Logo, brand guide, fonts, colors, photography, standard/branded/highly customized/white-label preference and free-text custom workflow.

### Files & Existing Data

Uploads for members, leads, staff, timetable, pricing, services, equipment, inventory, branches, bios, branding, assessment protocols, therapy protocols, reports and current-system exports. Capture explicit permission for the implementation team to configure, seed and test the account.

### Priorities & Timeline

Launch features, phase-two features, future ideas, target date, urgency, optional budget range and desired implementation assistance.

### Final Workflow Questions

1. Describe the journey from discovery to regular member.
2. Describe a normal busy day.
3. Which administrative task wastes the most staff time?
4. What frustrates clients most?
5. If FITOS solved one problem perfectly, what would it be?

## 7. Data model

Do not create a tenant automatically from every enquiry.

### implementation_inquiries

- id
- status: draft | submitted | qualified | needs_clarification | approved | converted | archived
- contactName
- businessName
- email
- phone
- country
- businessType
- createdAt
- submittedAt
- assignedToUserId
- convertedTenantId nullable

### implementation_inquiry_payloads

- inquiryId
- schemaVersion
- payloadJson
- updatedAt

Use versioned JSON for discovery answers because this is draft configuration data, not the canonical production domain.

### implementation_inquiry_uploads

Private uploaded files and metadata.

### implementation_inquiry_events

Audit/status events.

## 8. Developer seed manifest

After submission, normalize into a versioned `TenantSeedManifest` covering Business, Branches, Staff, Services, Rooms, Equipment, Memberships, Schedule Templates, CRM, Assessments, Therapy, Inventory, Website, Automations, Integrations and Custom Requirements.

Never apply unreviewed enquiry data automatically.

Workflow:
Inquiry submitted → normalize → implementation review → clarification → seed preview → approval → create/select tenant → apply safe sections transactionally → imports → validation report → client review → go live.

## 9. Platform admin UI

Add:

- `/platform/inquiries`
- `/platform/inquiries/:inquiryId`

Detail includes contact/business, completion, requested features, branch/service summary, specialized equipment, assessments/therapy, uploads, custom requirements, implementation notes, status and assigned implementer.

Actions: Request clarification, Mark qualified, Build seed preview, Attach tenant, Create tenant from approved inquiry, Export implementation brief, Archive.

## 10. Security / privacy

- signed secure resume tokens;
- private uploads;
- malware/virus scanning before processing;
- upload size/type limits;
- abandoned-draft retention policy;
- staff access auditing;
- explicit consent;
- do not solicit unnecessary individual health information during sales enquiry;
- never automatically publish uploaded files.

## 11. Roadmap insertion

Add inside **Phase 2 — Self-Service SaaS Platform**.

### Phase 2A — SaaS Landing Page & Assisted Setup Funnel

#### Sprint 2A.1 — FITOS Marketing Shell

- `/` marketing route;
- responsive landing page;
- feature and solution sections;
- assisted-setup CTA;
- self-service signup CTA;
- SEO/meta;
- analytics-event abstraction;
- reserved-route handling before `/:tenantSlug`.

#### Sprint 2A.2 — Discovery Wizard

- adaptive wizard;
- autosave;
- progress;
- conditional sections;
- uploads;
- resume later;
- validation;
- review;
- consent;
- submission.

#### Sprint 2A.3 — Implementation Inbox & Seed Manifest

- inquiry persistence;
- platform inquiry list/detail;
- qualification;
- seed-manifest normalization;
- validation report;
- implementation notes;
- tenant conversion workflow;
- audit.

**Exit:** a prospective customer can describe their business, upload existing operational data, and give the FITOS implementation team enough structured information to configure and seed their tenant without a second discovery spreadsheet.

## 12. Backlog additions

### Epic B0 — SaaS Marketing & Assisted Onboarding

- B0001 SaaS landing-page route
- B0002 Responsive marketing shell
- B0003 Solutions/feature sections
- B0004 Assisted-setup CTA
- B0005 Discovery contracts
- B0006 Inquiry persistence
- B0007 Adaptive wizard engine
- B0008 Draft autosave
- B0009 Secure resume
- B0010 Conditional sections
- B0011 File uploads
- B0012 Review/submit
- B0013 Consent capture
- B0014 Platform inquiry inbox
- B0015 Inquiry detail
- B0016 Qualification workflow
- B0017 Seed-manifest generator
- B0018 Seed preview/validation
- B0019 Create tenant from approved inquiry
- B0020 Attach inquiry to tenant
- B0021 Import handoff/report
- B0022 Conversion analytics

## 13. Acceptance criteria

- `/` does not collide with tenant slugs.
- Landing page works at 360, 390, 768, 1024 and 1440 widths.
- Discovery can start without an account.
- Draft can be securely resumed.
- Irrelevant sections remain hidden.
- Submission survives refresh/network interruption.
- Uploaded files remain private.
- Submission does not auto-create a production tenant.
- FITOS staff can review and qualify it.
- Seed preview is deterministic and versioned.
- Applying approved seed data is auditable.
- Duplicate submission handling exists.
- Form is phone-friendly.
- Client can switch to self-service signup at any time.
- Payment information is not requested.
