# FITOS deployment runbook

1. Confirm CI is green and record the release tag/image digest.
2. Verify a recent encrypted backup; do not deploy with a failed backup job.
3. Put reviewed production values in `/opt/fitos/.env.production` with restrictive permissions.
4. Run `FITOS_RELEASE_TAG=<tag> infra/scripts/deploy.sh` from the release directory.
5. Check `/api/v1/health/ready`, login, member read, logs, and metrics.
6. Keep the previous image tag. Roll back application images only when migrations remain backward compatible.

Production must set `FITOS_REPOSITORY=drizzle`; the in-memory adapter is development-only.
