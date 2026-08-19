#!/usr/bin/env sh
set -eu

: "${FITOS_RELEASE_TAG:?FITOS_RELEASE_TAG is required}"
test -f .env.production || { echo ".env.production is missing" >&2; exit 1; }

compose="docker compose -f compose.yaml -f compose.production.yaml"

$compose build --pull api worker nginx
$compose up -d --wait postgres redis
$compose run --rm --no-deps api node packages/database/dist/migrate.js
$compose up -d --remove-orphans
curl --fail --silent --show-error http://127.0.0.1/api/v1/health/ready >/dev/null
printf '%s\n' "FITOS release ${FITOS_RELEASE_TAG} is ready."
