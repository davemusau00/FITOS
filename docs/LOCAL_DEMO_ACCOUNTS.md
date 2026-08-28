# FITOS local demo accounts

These accounts are for local development only. They are created by
`npm run seed --workspace=@fitos/database` using `FITOS_SEED_PASSWORD` (or the
default shown below). Do not use these credentials outside a disposable local
environment.

Default password: `ChangeMe123!`

| Surface          | Login                                  | Tenant / scope                 |
| ---------------- | -------------------------------------- | ------------------------------ |
| FITOS Command    | `owner@gym.fitos.test`                 | FITOS Demo Gym / Kilimani      |
| FITOS Front Desk | `reception@gym.fitos.test`             | FITOS Demo Gym / Kilimani      |
| FITOS Coach      | `trainer@gym.fitos.test`               | FITOS Demo Gym / Kilimani      |
| Finance          | `finance@gym.fitos.test`               | FITOS Demo Gym / Kilimani      |
| FITOS Command    | `owner@pilates.fitos.test`             | FITOS Demo Pilates / Westlands |
| FITOS Member     | `GYM-0001` or `amina.otieno@gmail.com` | FITOS Demo Gym                 |
| FITOS Platform   | `platform.admin@fitos.test`            | Platform-wide                  |

## Local URLs

- Staff application: http://localhost:5173/login
- Member portal: http://localhost:5173/member/login
- Platform administration: http://localhost:5173/platform/login
- API liveness: http://localhost:3000/api/v1/health/live

The PostgreSQL seed includes 20 members, active and inactive memberships,
membership plans, credit ledgers, services, rooms, scheduled occurrences,
leads, and automation examples for the gym tenant. The Pilates tenant provides
a second tenant boundary for isolation checks.

If the password is overridden, set `FITOS_SEED_PASSWORD` before seeding. The
seed is create-once for tenants; use a disposable local database when you need
to regenerate the complete fixture set.
