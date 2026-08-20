# FITOS Pilot Observability

The production stack exposes application, queue, database, Redis, host, and backup signals to an opt-in Prometheus profile. Prometheus is bound to `127.0.0.1:9090`; use an SSH tunnel for operator access and never publish it directly to the internet.

## Start monitoring

From the release directory, with a reviewed `.env.production`:

```sh
FITOS_ENV_FILE=.env.production FITOS_RELEASE_TAG=<immutable-tag> \
docker compose --env-file .env.production \
  -f compose.yaml -f compose.production.yaml -f compose.monitoring.yaml \
  --profile monitoring up -d
```

Validate targets from the VPS:

```sh
curl --fail http://127.0.0.1:9090/-/ready
curl --fail http://127.0.0.1:9090/api/v1/targets
```

All five `fitos-*` scrape targets must report `up`. Confirm the API and worker `build_info` metrics contain the deployed tag.

## Required alerts

The bundled rules surface API 5xx rate, target loss, worker failures/Redis loss, stale or failed backups, disk pressure, and memory pressure. Before pilot traffic, connect Prometheus to a reviewed Alertmanager destination owned by the operations team and fire a synthetic alert to prove delivery. Alert routing credentials belong in deployment secrets, not this repository.

## Failed jobs

BullMQ retains failed jobs for 30 days (bounded to 10,000). A failed or stalled job emits a structured event with job ID, attempts, and exhaustion state, increments a worker metric, and fires an alert. Investigate worker logs using the job ID before retrying. Do not delete failed jobs until the underlying operational effect is reconciled against PostgreSQL.

## Backup signal

Every backup attempt atomically writes `fitos_backup_run.prom`; successful encrypted off-server copies also update `fitos_backup_success.prom`. Node Exporter's textfile collector reads these files from the backup directory. Treat missing, failed, or older-than-25-hour success metrics as release-blocking.

## Incident triage

1. Record the release tag, UTC time, alert, and affected tenant/branch if known.
2. Check API request IDs and worker job IDs without copying session tokens or unnecessary PII.
3. Confirm PostgreSQL and Redis health before retrying mutations.
4. Reconcile bookings, credits, payments, and attendance against PostgreSQL truth.
5. Record remediation and follow-up in the incident log; complete a restore drill if data integrity is uncertain.
