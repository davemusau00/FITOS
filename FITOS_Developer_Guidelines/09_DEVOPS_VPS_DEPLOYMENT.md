# FITOS VPS Deployment and DevOps Guide

## 1. Production Target

Single Linux VPS for initial production.

Recommended topology:

```text
Internet
   |
   v
Nginx :80/:443
   |----------------------|
   v                      v
React static assets      /api proxy
                          |
                          v
                       NestJS
                          |
              -------------------------
              |                       |
              v                       v
          PostgreSQL                Redis
```

Only Nginx should be exposed publicly unless an explicit operational reason exists.

---

## 2. VPS Baseline

Minimum production baseline for early tenants:
- modern supported Ubuntu LTS or equivalent
- 2–4 vCPU
- 4–8 GB RAM
- SSD storage
- provider snapshots plus independent application/database backups

Sizing depends on workload. Monitor before scaling.

---

## 3. Server Hardening

Before application:
- create non-root deploy user
- SSH keys only
- disable password SSH where operationally appropriate
- firewall
- allow SSH from trusted sources if feasible
- expose 80/443
- automatic/security OS updates strategy
- fail2ban or equivalent if justified
- correct system time/NTP
- restricted Docker access
- log rotation
- backup destination configured

Anyone with unrestricted Docker daemon access effectively has root-equivalent power. Treat it accordingly.

---

## 4. Containers

Recommended production services:

```text
nginx
api
postgres
redis
worker
```

The React app can be built into an Nginx image or served from a static volume baked into the image.

Keep worker process separate if background jobs can impact API responsiveness.

---

## 5. Docker Compose Baseline

Illustrative only; adapt images, health checks, secrets and paths.

```yaml
services:
  nginx:
    build:
      context: .
      dockerfile: infra/nginx/Dockerfile
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      api:
        condition: service_healthy
    networks:
      - edge
      - app

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    env_file:
      - .env.production
    expose:
      - "3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app
      - data

  worker:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    command: ["node", "dist/worker.js"]
    restart: unless-stopped
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    networks:
      - data

  postgres:
    image: postgres:18
    restart: unless-stopped
    env_file:
      - .env.production
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    networks:
      - data

volumes:
  postgres_data:
  redis_data:

networks:
  edge:
  app:
  data:
```

Do not publish PostgreSQL/Redis host ports in production unless specifically required and firewall-protected.

---

## 6. Frontend Docker Build

Example:

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY packages packages
COPY apps/web apps/web

RUN npm ci
RUN npm run build --workspace=apps/web

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
```

Adapt monorepo copy order to preserve build caching.

Never use Vite preview as the production web server.

---

## 7. API Docker Build

Example multi-stage strategy:

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=apps/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
RUN npm ci --omit=dev

COPY --from=build /app/apps/api/dist ./apps/api/dist

USER node
CMD ["node", "apps/api/dist/main.js"]
```

Exact dependency layout may require workspace-aware pruning. Optimize only after a working reproducible build exists.

---

## 8. Nginx SPA and API

Illustrative:

```nginx
server {
    listen 80;
    server_name fitos.example.com;

    root /usr/share/nginx/html;
    index index.html;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://api:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

For production HTTPS:
- redirect HTTP to HTTPS
- TLS certificate
- hardened TLS configuration
- security headers
- websocket headers if later required

---

## 9. TLS

Use automated certificate issuance/renewal.

Requirements:
- certificate renewal monitored
- renewal tested
- HTTP redirect to HTTPS
- HSTS only after HTTPS/domain configuration is proven
- no mixed content

---

## 10. Production Environment

Never bake secrets into frontend or source.

`.env.production` should be readable only by appropriate server/deploy account.

Example categories:

```text
NODE_ENV=production
APP_URL=
API_URL=
DATABASE_URL=
REDIS_URL=
SESSION_SECRET=
CSRF_SECRET=

MPESA_...
WHATSAPP_...
SMTP_...
OBJECT_STORAGE_...
```

Prefer separate secret mechanism/files if deployment tooling supports it.

---

## 11. Deployment Procedure

Recommended:

```text
1. CI builds/tests commit.
2. Create version/tag.
3. Build images.
4. Push images to registry or build reproducibly on VPS.
5. Pull release.
6. Back up database / verify recent backup.
7. Run safe migrations.
8. Start new containers.
9. Check readiness.
10. Smoke test.
11. Switch/keep traffic.
12. Monitor errors.
13. Mark release successful.
```

Avoid `git pull && npm install && hope`.

---

## 12. Database Migration Deployment

Preferred expand/contract for risky schema changes:

### Release A
add nullable/new schema, app supports both.

### Backfill
populate safely.

### Release B
switch reads/writes.

### Release C
remove old fields after confidence period.

This reduces deploy coupling.

---

## 13. Rollback

Application rollback must be documented.

Maintain:
- previous image tag
- previous Compose release reference
- migration compatibility knowledge

Do not automatically roll back database migrations that destroy/transform data.

Roll back application first if schema remains backward compatible.

---

## 14. Backups

### PostgreSQL
At minimum:
- daily logical backup
- off-VPS copy
- encryption
- retention
- periodic full restore test

For tighter recovery objectives, add:
- WAL/archive strategy
- managed backup solution
- more frequent snapshots

### Files
Back up private uploads separately if self-hosted.

### Config
Back up:
- Nginx
- Compose
- deployment metadata

Do not put production secret dumps into normal source backups.

---

## 15. Restore Drill

Quarterly at minimum early on:
1. provision clean server/database
2. restore backup
3. run migrations if required
4. start app
5. authenticate
6. inspect sample tenant
7. validate payment and booking history
8. record restore duration

A recovery plan is not complete until tested.

---

## 16. Health Checks

API:
```text
GET /health/live
GET /health/ready
```

Docker health checks should verify process/service readiness without creating expensive DB traffic every second.

---

## 17. Logging

Production containers log to stdout/stderr structured JSON.

Configure:
- Docker log rotation or central log driver
- retention
- request IDs
- error reporting

Do not allow logs to fill the VPS disk.

---

## 18. Deployment Environments

Minimum:
- local
- CI/test
- staging
- production

Staging should use:
- separate database
- separate payment sandbox/credentials
- separate session secret
- non-production communication recipients or safe sink

Never point staging at production DB.

---

## 19. Scaling Path

First scale vertically.

Then:
- separate DB to managed PostgreSQL
- external Redis
- external object storage
- multiple API instances
- load balancing
- worker scaling
- read replicas/reporting strategy if justified

Do not introduce Kubernetes until operational requirements justify its cost.

---

## 20. Production Checklist

- DNS correct
- HTTPS valid
- firewall enabled
- DB not public
- Redis not public
- production secrets present
- debug off
- migrations complete
- backup verified
- health endpoints passing
- monitoring active
- log rotation active
- rate limits active
- security headers active
- admin account MFA available
- test tenant smoke tested
