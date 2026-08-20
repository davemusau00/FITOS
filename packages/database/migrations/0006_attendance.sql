-- Migration: 0006_attendance.sql
-- Phase 4: Attendance Records

CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"        uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "branch_id"        uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "occurrence_id"    uuid NOT NULL REFERENCES "schedule_occurrences"("id") ON DELETE RESTRICT,
  "member_id"        uuid NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "status"           varchar(30) NOT NULL DEFAULT 'checked_in',
  "checked_in_at"    timestamp with time zone,
  "actor_user_id"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "override_reason"  text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_attendance_records_occurrence"
  ON "attendance_records"("occurrence_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_member"
  ON "attendance_records"("member_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_tenant_branch"
  ON "attendance_records"("tenant_id", "branch_id");
