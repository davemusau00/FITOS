# FITOS deployment runbook

1. Confirm CI is green and record the release tag/image digest.
2. Verify a recent encrypted backup; do not deploy with a failed backup job.
3. Put reviewed production values in `/opt/fitos/.env.production` with restrictive permissions.
4. Run `FITOS_RELEASE_TAG=<tag> infra/scripts/deploy.sh` from the release directory. The script builds immutable release artifacts, starts private data services, applies the compiled migration runner, then starts the application services.
5. Check `/api/v1/health/ready`, login, member read, logs, and metrics.
6. Keep the previous image tag. Roll back application images only when migrations remain backward compatible.

Run an encrypted backup with `docker compose --profile operations run --rm backup`. The production off-site path must be a mounted remote volume or sync target on infrastructure separate from the VPS. A local directory on the same disk does not satisfy the pilot gate.

Production must set `FITOS_REPOSITORY=drizzle`; the in-memory adapter is development-only.

Terminate TLS at the VPS edge (for example, a managed load balancer or a certbot-managed Nginx companion) and forward the original `X-Forwarded-Proto` header. PostgreSQL and Redis must never be exposed publicly.
