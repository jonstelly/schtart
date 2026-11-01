# Schtart

Schtart is a personal web-app start page built with SvelteKit 3, Svelte 5, and TypeScript. Sports will be one part of the experience, alongside other useful tabs and tools.

```sh
pnpm install --ignore-scripts
cp .env.example .env
# Edit .env with the existing PostgreSQL connection and a random auth secret.
set -a && . ./.env && set +a
pnpm db:migrate # apply pending, non-destructive migrations
pnpm dev        # dev server
pnpm test       # unit tests (no database required)
pnpm check      # types + svelte-check
pnpm build      # production build into ./build
```

## PostgreSQL and authentication

Schtart does not provision PostgreSQL. Create a database with an application-specific owner, set `DATABASE_URL`, then run `pnpm db:migrate` before starting the app. Migrations are explicit and repeatable; they do not drop or reset application data. `pnpm db:generate` creates a new migration from the Drizzle schema during development.

An unclaimed instance sends visitors to `/setup`. The first successful password registration becomes its administrator; later registrations become ordinary users. Complete setup before exposing an unclaimed instance publicly: anyone who reaches it first can claim administrator access. Email addresses are required but are not verified, and Schtart does not send verification or password-recovery email. An unverified address is not proof of ownership; deployers must protect the instance and its email policy accordingly.

Password registration is open when `REGISTRATION_EMAIL_ALLOWLIST` is empty or unset. To restrict new accounts, configure a comma-separated list of exact email addresses; comparisons trim whitespace and ignore case. The allowlist affects registration only and never blocks an existing user from signing in. Domain wildcards are not supported.

To run PostgreSQL integration tests, use an isolated disposable database whose name ends with `test` (for example, `schtart_test`). The integration test setup applies real migrations and clears only the auth tables in that explicitly designated test database:

```sh
TEST_DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/schtart_test pnpm test:integration
```

The command refuses a missing or non-test database name. Never point it at development or production data.

## Docker

```sh
docker build -t schtart .
docker run --rm --env-file .env schtart node scripts/db-migrate.mjs
docker run --env-file .env -p 3000:3000 schtart
```

For the container, set `BETTER_AUTH_URL` to the public URL (for local port forwarding, `http://localhost:3000`; use HTTPS in production) before running migrations and the server.

Health check: `GET /api/health`. Agent and contributor workflow: `AGENTS.md`.
