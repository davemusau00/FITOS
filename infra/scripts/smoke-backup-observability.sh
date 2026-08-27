#!/usr/bin/env sh
set -eu

: "${FITOS_RELEASE_TAG:?FITOS_RELEASE_TAG is required}"

suffix="$$"
network="fitos-backup-smoke-${suffix}"
postgres="fitos-backup-smoke-postgres-${suffix}"
backup_volume="fitos-backup-smoke-data-${suffix}"
offsite_volume="fitos-backup-smoke-offsite-${suffix}"
identity_volume="fitos-backup-smoke-identity-${suffix}"
image="fitos-backup:${FITOS_RELEASE_TAG}"

cleanup() {
  docker rm -f "$postgres" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  docker volume rm "$backup_volume" "$offsite_volume" "$identity_volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker network create "$network" >/dev/null
docker volume create "$backup_volume" >/dev/null
docker volume create "$offsite_volume" >/dev/null
docker volume create "$identity_volume" >/dev/null
docker run --rm -v "${identity_volume}:/identity" --entrypoint sh "$image" -c \
  'age-keygen -o /identity/key.txt >/dev/null 2>&1 && age-keygen -y /identity/key.txt | sed "s/^Public key: //" > /identity/recipient.txt'
recipient="$(docker run --rm -v "${identity_volume}:/identity:ro" --entrypoint sh "$image" -c 'cat /identity/recipient.txt')"

docker run -d --name "$postgres" --network "$network" \
  -e POSTGRES_DB=fitos_backup_test -e POSTGRES_USER=fitos -e POSTGRES_PASSWORD=fitos \
  --health-cmd='pg_isready -U fitos -d fitos_backup_test' \
  --health-interval=1s --health-timeout=2s --health-retries=30 postgres:18-alpine >/dev/null

attempt=0
until test "$(docker inspect --format='{{.State.Health.Status}}' "$postgres")" = "healthy"; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 30 || { docker logs "$postgres"; exit 1; }
  sleep 1
done

docker run --rm --network "$network" \
  -v "${backup_volume}:/backups" -v "${offsite_volume}:/offsite" \
  -e DATABASE_URL="postgresql://fitos:fitos@${postgres}:5432/fitos_backup_test" \
  -e BACKUP_DIRECTORY=/backups -e BACKUP_OFFSITE_DIRECTORY=/offsite \
  -e BACKUP_ENCRYPTION_RECIPIENT="$recipient" "$image" >/dev/null
docker run --rm -v "${backup_volume}:/backups:ro" --entrypoint sh "$image" -c \
  "grep -Fq 'fitos_backup_last_run_success 1' /backups/fitos_backup_run.prom && grep -Eq 'fitos_backup_last_success_size_bytes [1-9][0-9]*' /backups/fitos_backup_success.prom"

if docker run --rm --network "$network" \
  -v "${backup_volume}:/backups" -v "${offsite_volume}:/offsite" \
  -e DATABASE_URL='postgresql://fitos:wrong@missing:5432/fitos_backup_test' \
  -e BACKUP_DIRECTORY=/backups -e BACKUP_OFFSITE_DIRECTORY=/offsite \
  -e BACKUP_ENCRYPTION_RECIPIENT="$recipient" "$image" >/dev/null 2>&1; then
  echo "Expected an unavailable database backup to fail." >&2
  exit 1
fi
docker run --rm -v "${backup_volume}:/backups:ro" --entrypoint sh "$image" -c \
  "grep -Fq 'fitos_backup_last_run_success 0' /backups/fitos_backup_run.prom && grep -Fq 'fitos_backup_last_success_timestamp_seconds' /backups/fitos_backup_success.prom"

printf '%s\n' '{"event":"backup.observability_smoke_passed"}'
