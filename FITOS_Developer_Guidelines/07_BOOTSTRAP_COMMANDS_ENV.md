# FITOS Bootstrap, Commands and Environment

## Root scripts

Illustrative root `package.json`:

```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently \"npm:dev:web\" \"npm:dev:api\" \"npm:dev:worker\"",
    "dev:web": "npm run dev --workspace=apps/web",
    "dev:api": "npm run start:dev --workspace=apps/api",
    "dev:worker": "npm run dev --workspace=apps/worker",
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "db:migrate": "npm run migrate --workspace=packages/database",
    "db:seed": "npm run seed --workspace=packages/database",
    "db:reset:test": "npm run reset:test --workspace=packages/database"
  }
}
```

## Local first boot

```bash
git clone <repo>
cd fitos
cp .env.example .env
npm ci
docker compose up -d postgres redis
npm run db:migrate
npm run db:seed
npm run dev
```

## `.env.example`

```bash
NODE_ENV=development
APP_ENV=local

WEB_PORT=5173
API_PORT=3000

WEB_PUBLIC_URL=http://localhost:5173
API_PUBLIC_URL=http://localhost:3000

DATABASE_URL=postgresql://fitos:fitos@localhost:5432/fitos
REDIS_URL=redis://localhost:6379

SESSION_SECRET=change-me
SESSION_TTL_SECONDS=28800
CSRF_SECRET=change-me

DEFAULT_TIMEZONE=Africa/Nairobi
DEFAULT_CURRENCY=KES

LOG_LEVEL=debug

STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=.data/uploads

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=no-reply@example.test

MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_BASE_URL=

WHATSAPP_PROVIDER=disabled
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_SECRET=
```

## Environment rules

Production API startup must fail if required configuration is absent or insecure.

Never silently:
- use development session secret
- switch production payments to sandbox
- allow wildcard credentialed CORS
- expose database credentials to Vite

Client environment variables are public.

## Local seed data

Tenant A:
```text
FITOS Demo Gym
Kilimani branch
Owner
Reception
5 members
```

Tenant B:
```text
FITOS Demo Pilates
Westlands branch
Owner
3 members
```

Two tenants are mandatory because tenant-isolation tests require realistic separate data.

## Database commands

Required:
```bash
npm run db:migrate
npm run db:seed
npm run db:status
npm run db:create:migration -- <name>
npm run db:reset:test
```

## Test commands

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:tenancy
```

## Build

```bash
npm run build
```

Expected outputs:
```text
apps/web/dist
apps/api/dist
apps/worker/dist
```

## Production server layout

```text
/opt/fitos/
├─ compose.yaml
├─ compose.production.yaml
├─ .env.production
├─ releases/
├─ backups/
└─ infra/
```

Secret file:
- owned by deploy account
- restrictive permissions
- excluded from Git

## Production topology

```text
Internet
   |
 Nginx 80/443
   |--------------------|
 static React           /api
                         |
                       API
                      /   \
                Postgres  Redis
                         |
                       Worker
```

PostgreSQL and Redis do not expose public host ports.

## Health

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

Readiness checks critical dependencies without leaking credentials or verbose internals.

## Production Compose command

```bash
docker compose   -f compose.yaml   -f compose.production.yaml   up -d
```

Migrations run as an explicit deployment step before/with controlled application rollout, not as a surprise side effect of every API container boot.

## Deployment sequence

1. CI passes.
2. Build/tag release images.
3. Verify recent DB backup.
4. Pull release.
5. Run migrations.
6. Start/update containers.
7. Readiness.
8. Web smoke.
9. Login smoke.
10. Member-read smoke.
11. Observe logs/metrics.
12. Mark release successful.

## Rollback

Maintain previous image tag.

Application rollback is allowed when new schema remains backward compatible.

Do not blindly reverse destructive database migrations.

## Backups

At minimum:
- daily PostgreSQL logical backup
- compressed
- encrypted off-VPS copy
- retention
- restore drill

## Nginx requirements

- static React build
- SPA fallback to `index.html`
- `/api/` reverse proxy
- HTTPS redirect
- TLS
- security headers
- request size limit
- real client forwarding headers

Never run `vite preview` as the production web server.
