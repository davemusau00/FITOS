#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIRECTORY:?BACKUP_DIRECTORY is required}"
: "${BACKUP_OFFSITE_DIRECTORY:?BACKUP_OFFSITE_DIRECTORY is required}"
: "${BACKUP_ENCRYPTION_RECIPIENT:?BACKUP_ENCRYPTION_RECIPIENT is required}"

umask 077
mkdir -p "$BACKUP_DIRECTORY" "$BACKUP_OFFSITE_DIRECTORY"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
filename="fitos-${timestamp}.dump.age"
output="$BACKUP_DIRECTORY/$filename"
temporary="${output}.tmp"
offsite_temporary="$BACKUP_OFFSITE_DIRECTORY/${filename}.tmp"

trap 'rm -f "$temporary" "$offsite_temporary"' EXIT
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" | age -r "$BACKUP_ENCRYPTION_RECIPIENT" -o "$temporary"
mv "$temporary" "$output"
(
  cd "$BACKUP_DIRECTORY"
  sha256sum "$filename" >"${filename}.sha256"
)
cp "$output" "$offsite_temporary"
mv "$offsite_temporary" "$BACKUP_OFFSITE_DIRECTORY/$filename"
cp "$BACKUP_DIRECTORY/${filename}.sha256" "$BACKUP_OFFSITE_DIRECTORY/${filename}.sha256"
cmp -s "$output" "$BACKUP_OFFSITE_DIRECTORY/$filename"
find "$BACKUP_DIRECTORY" -type f -name 'fitos-*.dump.age' -mtime +"${BACKUP_RETENTION_DAYS:-30}" -delete
find "$BACKUP_DIRECTORY" -type f -name 'fitos-*.dump.age.sha256' -mtime +"${BACKUP_RETENTION_DAYS:-30}" -delete
find "$BACKUP_OFFSITE_DIRECTORY" -type f -name 'fitos-*.dump.age' -mtime +"${BACKUP_OFFSITE_RETENTION_DAYS:-90}" -delete
find "$BACKUP_OFFSITE_DIRECTORY" -type f -name 'fitos-*.dump.age.sha256' -mtime +"${BACKUP_OFFSITE_RETENTION_DAYS:-90}" -delete
printf '{"event":"backup.completed","file":"%s","offsite":true}\n' "$filename"
