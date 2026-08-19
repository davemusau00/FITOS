# FITOS restore drill

Run this at least quarterly on an isolated server/database.

1. Provision a clean PostgreSQL instance and set a non-production `DATABASE_URL`.
2. Decrypt the selected backup using a key stored outside the backup location.
3. Restore with `pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" < dump`.
4. Run reviewed migrations only if the release requires them.
5. Start the API and authenticate with a designated test account.
6. Verify a tenant, branch, member, booking/payment history once those modules are live, and record elapsed RTO.

Never restore a production backup into local development or staging without approved sanitization.
