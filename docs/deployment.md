# Deployment and operations

Schtart is one Node.js application container with a separately provisioned PostgreSQL database.
Persist and back up PostgreSQL independently of the app container. No Compose stack, embedded
database, cloud-specific deployment, or implicit production migration is provided.

## Configuration and first setup

Copy `.env.example` and set `DATABASE_URL`, `BETTER_AUTH_URL`, and a unique random
`BETTER_AUTH_SECRET` of at least 32 characters. Keep production credentials outside the repository.
`BETTER_AUTH_URL` must be the public origin used by browsers (HTTPS in production).

Apply migrations explicitly before starting the app:

```sh
set -a && . ./.env && set +a
pnpm db:migrate
```

Migrations are repeatable and non-destructive. App startup and the production container do not run
them automatically. Run the migration command as a deliberate deployment step before releasing a
new app version.

An instance without an administrator sends visitors to `/setup`. The first successful password or
OIDC registration becomes administrator; later registrations are ordinary users. This is an
intentional bootstrap policy, not a public registration safeguard: complete setup before exposing
an unclaimed instance to the internet. There is no bootstrap allowlist or CLI.

Password authentication is enabled by default. Set `PASSWORD_AUTH_ENABLED=false` for OIDC-only
operation and configure all three values together: `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, and
`OIDC_CLIENT_SECRET`. The application uses the issuer's discovery document; register
`<BETTER_AUTH_URL>/api/auth/callback/oidc` as the provider redirect URI. Only one deployment-level
OIDC provider is supported. Keep the issuer stable after OIDC accounts exist; changing it can
reinterpret provider subjects and no issuer migration is provided. When
`REGISTRATION_EMAIL_ALLOWLIST` is set, it is a comma-separated list of exact email addresses
(trimmed and compared case-insensitively); it restricts new accounts through either method, not
existing sign-ins. Matching email alone never links accounts.

Email is required but is not verified. Schtart sends no email, verification message, or password
recovery link and has no recovery CLI. An unverified email is not proof of ownership; deployers must
secure the database and deployment credentials and account for an administrator losing access.

## Dashboard defaults and scheduling

The server default is stored in PostgreSQL and seeded only when absent. An administrator's validated
default edits persist across restarts. Each user's optional YAML override replaces the complete
default; it is not merged. Users without an override see the current default on their next page
load. Resetting removes the override and follows the current default again. See
[dashboard configuration](dashboard-configuration.md) for the format and widget limits.

Cron jobs run in memory in the app process. There are no production collectors yet, and scheduling
has no durable queue, replay of missed times, retry, or distributed execution. The scheduler's
stop operation prevents future runs and waits for already-running callbacks; those callbacks are not
forcibly cancelled. Future collectors must refresh from their source or resume a persisted
checkpoint instead of assuming that every scheduled run occurred. See [scheduler lifecycle](scheduler.md).

## Docker

Build and migrate with the same configuration used by the app, but keep migration an explicit
one-off operation:

```sh
docker build -t schtart:latest .
docker run --rm --env-file .env schtart:latest node scripts/db-migrate.mjs
docker run --rm --env-file .env -p 3000:3000 schtart:latest
```

The container includes a Docker `HEALTHCHECK` against `GET /api/health`. That endpoint reports
whether the HTTP app is answering; it does not prove that PostgreSQL is available. The Node adapter
handles `SIGTERM`, closes its HTTP server, and emits the shutdown hook used by the scheduler. Do not
put PostgreSQL data in the ephemeral app container.

## Kubernetes

Run Schtart as a **single replica** with a separately managed, persistent PostgreSQL service. The
in-process scheduler has no cross-pod coordination; a rolling overlap or second replica could run
scheduled work more than once. Use a non-overlapping rollout strategy (for example, `Recreate`) and
do not scale above one replica. No highly available or multi-replica guarantee is made.

Create Kubernetes Secrets for `DATABASE_URL`, `BETTER_AUTH_SECRET`, and, when enabled,
`OIDC_CLIENT_SECRET`; provide non-secret auth switches and URLs through ordinary configuration.
Run `node scripts/db-migrate.mjs` as a separate one-off Job using the same image and database
credentials before rolling out the app. The Deployment should not run migrations in its entrypoint.
Configure readiness and liveness probes against `/api/health`. This endpoint is an HTTP-process
check, not a database readiness check; monitor PostgreSQL separately. Keep credentials out of
container image layers, checked-in manifests, and logs.

## Local test databases

`TEST_DATABASE_URL` must identify an explicitly disposable PostgreSQL database whose name ends in
`_test` or `-test`. The integration, browser, and Docker lifecycle scripts validate the URL and
verify `current_database()` before applying migrations or truncating test tables. Browser and
Docker lifecycle tests reset their designated database; use no development, shared, or production
database for them. The browser tests start the built app and a local OIDC test provider and need no
public identity provider. Install the browser once with `pnpm exec playwright install chromium`.
