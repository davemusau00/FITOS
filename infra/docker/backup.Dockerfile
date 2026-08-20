FROM postgres:18-alpine
RUN apk add --no-cache age
COPY infra/scripts/backup-postgres.sh /usr/local/bin/fitos-backup
COPY infra/scripts/restore-postgres.sh /usr/local/bin/fitos-restore
COPY infra/scripts/verify-restore.sh /usr/local/bin/fitos-verify-restore
RUN chmod 0555 /usr/local/bin/fitos-backup /usr/local/bin/fitos-restore /usr/local/bin/fitos-verify-restore
ENTRYPOINT ["/usr/local/bin/fitos-backup"]
