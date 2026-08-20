#!/usr/bin/env sh
set -eu

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

for table in tenants members bookings member_memberships credit_ledger_entries payment_transactions attendance_records; do
  count="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "select count(*) from ${table}")"
  test "$count" -gt 0 || {
    echo "Restore verification failed: ${table} has no pilot records" >&2
    exit 1
  }
  printf '{"event":"restore.table_verified","table":"%s","rows":%s}\n' "$table" "$count"
done

printf '%s\n' '{"event":"restore.verified"}'
