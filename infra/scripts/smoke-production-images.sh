#!/usr/bin/env sh
set -eu

: "${FITOS_RELEASE_TAG:?FITOS_RELEASE_TAG is required}"

suffix="$$"
network="fitos-image-smoke-${suffix}"
postgres="fitos-image-smoke-postgres-${suffix}"
redis="fitos-image-smoke-redis-${suffix}"
api="fitos-image-smoke-api-${suffix}"
worker="fitos-image-smoke-worker-${suffix}"
nginx="fitos-image-smoke-nginx-${suffix}"

cleanup() {
  docker rm -f "$nginx" "$api" "$worker" "$postgres" "$redis" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker network create "$network" >/dev/null
docker run -d --name "$postgres" --network "$network" \
  -e POSTGRES_DB=fitos_smoke -e POSTGRES_USER=fitos -e POSTGRES_PASSWORD=fitos \
  --health-cmd='pg_isready -U fitos -d fitos_smoke' \
  --health-interval=1s --health-timeout=2s --health-retries=30 postgres:18-alpine >/dev/null
docker run -d --name "$redis" --network "$network" redis:8-alpine >/dev/null

attempt=0
until test "$(docker inspect --format='{{.State.Health.Status}}' "$postgres")" = "healthy"; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 30 || { docker logs "$postgres"; exit 1; }
  sleep 1
done

database_url="postgresql://fitos:fitos@${postgres}:5432/fitos_smoke"
docker run --rm --network "$network" -e DATABASE_URL="$database_url" \
  "fitos-api:${FITOS_RELEASE_TAG}" node packages/database/dist/migrate.js

docker run -d --name "$api" --network "$network" --network-alias api -p 127.0.0.1::3000 \
  -e NODE_ENV=production -e FITOS_REPOSITORY=drizzle -e DATABASE_URL="$database_url" \
  -e WEB_PUBLIC_URL=http://127.0.0.1:5173 \
  -e SESSION_SECRET=image-smoke-session-secret-at-least-32 \
  -e CSRF_SECRET=image-smoke-csrf-secret-at-least-32 \
  -e FITOS_RELEASE_TAG="$FITOS_RELEASE_TAG" "fitos-api:${FITOS_RELEASE_TAG}" >/dev/null
docker run -d --name "$worker" --network "$network" -p 127.0.0.1::9464 \
  -e REDIS_URL="redis://${redis}:6379" -e FITOS_RELEASE_TAG="$FITOS_RELEASE_TAG" \
  "fitos-worker:${FITOS_RELEASE_TAG}" >/dev/null

api_port="$(docker port "$api" 3000/tcp | sed -n '1{s/.*://;p}')"
attempt=0
until curl --fail --silent "http://127.0.0.1:${api_port}/api/v1/health/ready" | grep -Fq "\"release\":\"${FITOS_RELEASE_TAG}\""; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 30 || { docker logs "$api"; exit 1; }
  sleep 1
done

curl --fail --silent "http://127.0.0.1:${api_port}/api/v1/metrics" | grep -Fq \
  "fitos_build_info{release=\"${FITOS_RELEASE_TAG}\"} 1"

attempt=0
until docker logs "$worker" 2>&1 | grep -Fq '"event":"worker.ready"'; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 30 || { docker logs "$worker"; exit 1; }
  sleep 1
done

docker logs "$worker" 2>&1 | grep -Fq "\"release\":\"${FITOS_RELEASE_TAG}\""
worker_port="$(docker port "$worker" 9464/tcp | sed -n '1{s/.*://;p}')"
curl --fail --silent "http://127.0.0.1:${worker_port}/health/live" | grep -Fq '"status":"ok"'
curl --fail --silent "http://127.0.0.1:${worker_port}/metrics" | grep -Fq \
  "fitos_worker_build_info{release=\"${FITOS_RELEASE_TAG}\"} 1"

docker run -d --name "$nginx" --network "$network" -p 127.0.0.1::80 \
  "fitos-nginx:${FITOS_RELEASE_TAG}" >/dev/null
nginx_port="$(docker port "$nginx" 80/tcp | sed -n '1{s/.*://;p}')"
attempt=0
until curl --fail --silent "http://127.0.0.1:${nginx_port}/api/v1/health/live" >/dev/null; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 30 || { docker logs "$nginx"; exit 1; }
  sleep 1
done
test "$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:${nginx_port}/api/v1/metrics")" = "404"
printf '%s\n' '{"event":"production_images.smoke_passed"}'
