#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIRECTORY:?BACKUP_DIRECTORY is required}"
: "${BACKUP_ENCRYPTION_RECIPIENT:?BACKUP_ENCRYPTION_RECIPIENT is required}"

umask 077
mkdir -p "$BACKUP_DIRECTORY"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$BACKUP_DIRECTORY/fitos-${timestamp}.dump.age"
temporary="${output}.tmp"

trap 'rm -f "$temporary"' EXIT
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" | age -r "$BACKUP_ENCRYPTION_RECIPIENT" -o "$temporary"
mv "$temporary" "$output"
find "$BACKUP_DIRECTORY" -type f -name 'fitos-*.dump.age' -mtime +"${BACKUP_RETENTION_DAYS:-30}" -delete
printf '%s\n' "Created encrypted FITOS backup: $output"
