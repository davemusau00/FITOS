# 05 — Data Model & API Contracts

## New contract files

`equipment.ts`, `inventory.ts`, `assessments.ts`, `therapy.ts`, `sites.ts`, `integrations.ts`, `platform.ts`, `notifications.ts`, `tasks.ts`, `member-identity.ts`.

## New API modules

EquipmentModule, InventoryModule, AssessmentsModule, TherapyModule, SitesModule, IntegrationsModule, NotificationsModule, TasksModule, PlatformModule, PublicModule and MemberIdentityModule.

## Proposed database entities

### Equipment

`equipment_models`, `equipment_assets`, `equipment_pools`, `equipment_pool_assets`, `equipment_unavailability`, `equipment_maintenance_records`, `equipment_calibration_records`, `service_resource_requirements`, `occurrence_resource_reservations`.

### Credentials

`credential_types`, `staff_credentials`, `service_credential_requirements`.

### Assessments

`assessment_definitions`, `assessment_protocol_versions`, `assessment_metric_definitions`, `assessment_sessions`, `assessment_results`, `assessment_attachments`, `assessment_imports`, `assessment_batteries`, `assessment_battery_items`, `member_assessment_programs`.

### Therapy

`therapy_modalities`, `therapy_protocols`, `therapy_protocol_versions`, `therapy_sessions`, `therapy_session_parameters`, `therapy_session_equipment`, `safety_checklist_templates`, `safety_checklist_responses`, `consent_records`.

### Inventory

`inventory_items`, `inventory_locations`, `inventory_lots`, `stock_movements`, `suppliers`, `purchase_orders`, `purchase_order_lines`, `stocktakes`, `stocktake_lines`, `reorder_rules`, `service_consumable_requirements`, `session_consumption`.

### Sites

`site_configs`, `site_themes`, `site_pages`, `site_sections`, `site_navigation`, `media_assets`, `seo_metadata`, `custom_domains`, `published_site_versions`.

### Integrations

`integration_connections`, `integration_sync_checkpoints`, `integration_import_jobs`, `integration_import_errors`, `external_subject_links`, `external_test_links`.

### SaaS platform

`platform_plans`, `platform_plan_capabilities`, `tenant_subscriptions`, `tenant_feature_overrides`, `feature_flags`, `usage_counters`, `platform_support_notes`.

### Member identity

`member_identities`, `member_sessions`, `member_login_challenges`, `member_preferences`.

### Productivity

`tasks`, `notifications`.

## Resource requirement model

ServiceResourceRequirement fields: serviceId, requirementType (`room|equipment_pool|equipment_asset|credential`), resourceRef, quantity, quantityMode (`fixed|per_attendee`), bufferBeforeMinutes, bufferAfterMinutes, required.

Capacity calculation must remain transaction-safe.

## Public API

GET `/api/v1/public/:tenantSlug/site`
GET `/api/v1/public/:tenantSlug/services`
GET `/api/v1/public/:tenantSlug/coaches`
GET `/api/v1/public/:tenantSlug/branches`
GET `/api/v1/public/:tenantSlug/schedule`
GET `/api/v1/public/:tenantSlug/services/:slug`
POST `/api/v1/public/:tenantSlug/leads`
POST `/api/v1/public/:tenantSlug/reservations`

Public DTOs must be separate from internal DTOs.

## Member API

GET `/api/v1/member/me`
GET/POST `/api/v1/member/bookings`
POST `/api/v1/member/bookings/:id/cancel`
POST `/api/v1/member/bookings/:id/reschedule`
GET `/api/v1/member/membership`
GET `/api/v1/member/attendance`
GET `/api/v1/member/assessments`
GET `/api/v1/member/progress`
GET `/api/v1/member/notifications`

Server derives memberId from member session, never from arbitrary request payload.

## Equipment API

GET/POST `/api/v1/equipment/models`
GET/POST `/api/v1/equipment/assets`
GET/PATCH `/api/v1/equipment/assets/:id`
GET/POST `/api/v1/equipment/pools`
POST `/api/v1/equipment/assets/:id/maintenance`
POST `/api/v1/equipment/assets/:id/calibration`
POST `/api/v1/equipment/assets/:id/unavailability`

## Assessments API

GET/POST `/api/v1/assessment-definitions`
GET/POST `/api/v1/assessments`
GET `/api/v1/assessments/:id`
POST `/api/v1/assessments/:id/results`
POST `/api/v1/assessments/:id/complete`
POST `/api/v1/assessments/import`
GET `/api/v1/members/:memberId/assessments`
GET `/api/v1/members/:memberId/progress`

## Therapy API

GET/POST `/api/v1/therapy/modalities`
GET/POST `/api/v1/therapy/protocols`
GET/POST `/api/v1/therapy/sessions`
GET/PATCH `/api/v1/therapy/sessions/:id`
POST `/api/v1/therapy/sessions/:id/complete`

## Inventory API

GET/POST `/api/v1/inventory/items`
GET `/api/v1/inventory/stock`
POST `/api/v1/inventory/movements`
GET/POST `/api/v1/inventory/suppliers`
GET/POST `/api/v1/inventory/purchase-orders`
POST `/api/v1/inventory/stocktakes`
POST `/api/v1/sessions/:id/consumption`

## Integration adapter concept

```ts
interface ExternalDataAdapter {
  providerKey: string;
  healthCheck(connectionId: string): Promise<IntegrationHealth>;
  listSubjects?(cursor?: string): Promise<ExternalSubjectPage>;
  listTests?(since?: string): Promise<ExternalTestPage>;
  fetchTest?(externalTestId: string): Promise<NormalizedImport>;
  importFile?(input: ImportFile): Promise<NormalizedImport>;
}
```

Adapters output normalized FITOS data. Domain logic never depends on vendor DTOs.

## Multi-tenancy acceptance

Every new repository query requires tenantId from request context, validates branch access where relevant, rejects cross-tenant IDs, prevents cross-tenant associations and has automated tenancy tests.
