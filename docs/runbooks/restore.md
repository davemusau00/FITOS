# FITOS restore drill

Run this at least quarterly on an isolated server/database.

1. Provision a clean PostgreSQL instance and set a non-production `DATABASE_URL`.
2. Verify the encrypted backup and its `.sha256` sidecar exist in the off-server location.
3. Mount the age identity read-only and set a clean, non-production `RESTORE_DATABASE_URL`.
4. Run `ALLOW_FITOS_RESTORE=YES_I_UNDERSTAND BACKUP_FILE=/offsite/<file>.dump.age BACKUP_IDENTITY_FILE=/identity/age-key.txt fitos-restore` inside the backup image.
5. Run `fitos-verify-restore`; it must find tenant, member, booking, membership, credit, payment, and attendance records.
6. Run reviewed migrations only if the restored release requires them.
7. Start the API, authenticate with a designated test account, and record elapsed RTO and release tag.

Never restore a production backup into local development or staging without approved sanitization.
