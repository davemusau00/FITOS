#!/usr/bin/env sh
set -eu

: "${ALLOW_FITOS_RESTORE:?Set ALLOW_FITOS_RESTORE=YES_I_UNDERSTAND}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${BACKUP_IDENTITY_FILE:?BACKUP_IDENTITY_FILE is required}"

test "$ALLOW_FITOS_RESTORE" = "YES_I_UNDERSTAND" || {
  echo "Restore acknowledgement is invalid" >&2
  exit 1
}
test -f "$BACKUP_FILE" || { echo "Backup file does not exist: $BACKUP_FILE" >&2; exit 1; }
test -f "$BACKUP_IDENTITY_FILE" || {
  echo "Age identity file does not exist: $BACKUP_IDENTITY_FILE" >&2
  exit 1
}

checksum_file="${BACKUP_FILE}.sha256"
if test -f "$checksum_file"; then
  (
    cd "$(dirname "$BACKUP_FILE")"
    sha256sum -c "$(basename "$checksum_file")"
  )
fi

temporary="$(mktemp /tmp/fitos-restore-XXXXXX.dump)"
trap 'rm -f "$temporary"' EXIT
age --decrypt -i "$BACKUP_IDENTITY_FILE" -o "$temporary" "$BACKUP_FILE"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$RESTORE_DATABASE_URL" "$temporary"
printf '{"event":"restore.completed","source":"%s"}\n' "$(basename "$BACKUP_FILE")"
