#!/usr/bin/env sh
set -eu
set -o pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIRECTORY:?BACKUP_DIRECTORY is required}"
: "${BACKUP_OFFSITE_DIRECTORY:?BACKUP_OFFSITE_DIRECTORY is required}"
: "${BACKUP_ENCRYPTION_RECIPIENT:?BACKUP_ENCRYPTION_RECIPIENT is required}"

# Accept both age's raw recipient and the human-readable `Public key: ...`
# form emitted by age-keygen, so operator-provided values remain unambiguous.
BACKUP_ENCRYPTION_RECIPIENT="$(printf '%s' "$BACKUP_ENCRYPTION_RECIPIENT" | sed 's/^Public key: //')"

umask 077
mkdir -p "$BACKUP_DIRECTORY" "$BACKUP_OFFSITE_DIRECTORY"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
filename="fitos-${timestamp}.dump.age"
output="$BACKUP_DIRECTORY/$filename"
temporary="${output}.tmp"
offsite_temporary="$BACKUP_OFFSITE_DIRECTORY/${filename}.tmp"
run_metrics="$BACKUP_DIRECTORY/fitos_backup_run.prom"
success_metrics="$BACKUP_DIRECTORY/fitos_backup_success.prom"
succeeded=0

write_run_metrics() {
  result="$1"
  metric_temporary="${run_metrics}.tmp"
  printf '# HELP fitos_backup_last_run_success Whether the most recent backup run completed and copied off-server.\n' >"$metric_temporary"
  printf '# TYPE fitos_backup_last_run_success gauge\n' >>"$metric_temporary"
  printf 'fitos_backup_last_run_success %s\n' "$result" >>"$metric_temporary"
  printf '# HELP fitos_backup_last_run_timestamp_seconds Unix timestamp of the most recent backup attempt.\n' >>"$metric_temporary"
  printf '# TYPE fitos_backup_last_run_timestamp_seconds gauge\n' >>"$metric_temporary"
  printf 'fitos_backup_last_run_timestamp_seconds %s\n' "$(date +%s)" >>"$metric_temporary"
  mv "$metric_temporary" "$run_metrics"
}

cleanup() {
  status="$?"
  trap - EXIT
  rm -f "$temporary" "$offsite_temporary" "${run_metrics}.tmp" "${success_metrics}.tmp"
  if test "$succeeded" -ne 1; then
    write_run_metrics 0
  fi
  exit "$status"
}
trap cleanup EXIT
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
metric_temporary="${success_metrics}.tmp"
printf '# HELP fitos_backup_last_success_timestamp_seconds Unix timestamp of the latest successful encrypted off-server backup.\n' >"$metric_temporary"
printf '# TYPE fitos_backup_last_success_timestamp_seconds gauge\n' >>"$metric_temporary"
printf 'fitos_backup_last_success_timestamp_seconds %s\n' "$(date +%s)" >>"$metric_temporary"
printf '# HELP fitos_backup_last_success_size_bytes Size of the latest successful encrypted backup.\n' >>"$metric_temporary"
printf '# TYPE fitos_backup_last_success_size_bytes gauge\n' >>"$metric_temporary"
printf 'fitos_backup_last_success_size_bytes %s\n' "$(stat -c '%s' "$output")" >>"$metric_temporary"
mv "$metric_temporary" "$success_metrics"
write_run_metrics 1
succeeded=1
printf '{"event":"backup.completed","file":"%s","offsite":true}\n' "$filename"
