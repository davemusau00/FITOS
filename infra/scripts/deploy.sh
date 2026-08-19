#!/usr/bin/env sh
set -eu

: "${FITOS_RELEASE_TAG:?FITOS_RELEASE_TAG is required}"
test -f .env.production || { echo ".env.production is missing" >&2; exit 1; }

docker compose -f compose.yaml -f compose.production.yaml pull
docker compose -f compose.yaml -f compose.production.yaml run --rm api npm run db:migrate --workspace=@fitos/database
docker compose -f compose.yaml -f compose.production.yaml up -d --remove-orphans
curl --fail --silent --show-error http://127.0.0.1/api/v1/health/ready >/dev/null
printf '%s\n' "FITOS release ${FITOS_RELEASE_TAG} is ready."
