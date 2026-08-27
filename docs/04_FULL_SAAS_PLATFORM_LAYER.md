# 04 — Full SaaS Platform Layer

## Tenant lifecycle

trial → active → grace → suspended → cancelled → archived.

Required: public signup, owner bootstrap, trial dates, tenant slug, business type, country, timezone, currency, preferences, export, cancellation and deletion workflow.

## FITOS SaaS plans

Separate from fitness membership plans.

Starter: single branch, caps, core booking/member/attendance/basic site.

Pro: more branches, CRM, automation, analytics, member portal, assessments.

Business: advanced integrations, performance/therapy, higher limits, API/premium support.

Use capabilities such as `feature.assessments`, not scattered `if plan === pro` checks.

## Usage metering

Track branches, active staff, active members, automation runs/messages, storage, device integrations, website pages and API usage later. Enforce centrally.

## Feature flags

Global, plan, tenant and pilot scopes. Examples: assessments, therapy, inventory, public_booking_v2, advanced_insights, waitlist, device_inbody, device_vald.

## Platform admin

Separate `/platform` surface for tenants, plans, usage, feature flags, support, users, lifecycle, audit and account recovery.

Any support impersonation must be reasoned, short-lived, visibly indicated and fully audited.

## Tasks/notifications

Add cross-domain Task and Notification entities feeding Today and deep links.

## Import/export

CSV upload → map → preview → validate → resolve duplicates → import → failure report.

Support member, lead, membership and staff imports; provide exports for tenant-owned operational data.

## PWA

Manifest, install, safe offline shell, recent read-only cache where appropriate, network-aware errors and push-ready foundation later.
