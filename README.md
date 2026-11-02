# Schtart

Schtart is a personal web-app start page built with SvelteKit 3, Svelte 5, and TypeScript. Sports
will be one part of the experience, alongside other useful tabs and tools.

## Local development

Schtart uses an existing PostgreSQL database; it does not provision one locally.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Edit .env with the PostgreSQL connection and a unique random auth secret.
pnpm db:migrate # apply pending non-destructive migrations explicitly
pnpm dev        # Vite dev server
```

Project commands load `.env`, `.env.local`, and the applicable mode files (`.env.development`,
`.env.test`, or `.env.production`, plus each mode's `.local` variant). More specific files override
less specific ones, while variables already set in the shell take precedence over all env files.
Vite exposes only variables prefixed with `VITE_` to client-side code; never use that prefix for
secrets.

Migrations are never applied implicitly at app startup. `pnpm db:generate` creates a migration from
the Drizzle schema during development.

## Verification

`pnpm test` runs database-free unit tests. Integration, browser, and Docker lifecycle verification
require `TEST_DATABASE_URL` to point to a disposable PostgreSQL database whose name ends with
`_test` or `-test`. `.env.example` shows separate app and test database URLs. These scripts apply
real migrations and clear test tables; never aim them at development or production data.

```sh
pnpm test
pnpm check
pnpm test:integration
pnpm build
pnpm exec playwright install chromium # once per machine
pnpm test:browser                   # built app + local OIDC test provider
docker build -t schtart:ticket7 .
pnpm test:docker-lifecycle          # Linux Docker health + graceful stop
```

Browser verification uses a loopback OIDC provider and does not need a public identity provider.
GitHub Actions runs database-free unit checks independently from PostgreSQL integration and browser
journeys. See [deployment and operations](docs/deployment.md) for test-database safety, production
Docker/Kubernetes guidance, and authentication limitations.

## PostgreSQL and authentication

Set `DATABASE_URL` to an application-specific PostgreSQL database. `pnpm db:migrate` creates that
database when it is missing by connecting to the server's `postgres` maintenance database, then
applies pending migrations. The configured PostgreSQL role needs `CONNECT` on `postgres` and
`CREATEDB` only when the target database is missing; migrating an existing database does not require
`CREATEDB`. For deployments, provision the database separately if the application role should not
have database-creation privileges. Migrations are repeatable and do not drop or reset application
data.

An unclaimed instance sends visitors to `/setup`. The first successful password or OIDC
registration becomes administrator; later registrations become ordinary users. Complete setup
before exposing an unclaimed instance publicly: anyone who reaches it first can claim administrator
access. Email addresses are required but are not verified, and Schtart does not send verification
or password-recovery email. An unverified address is not proof of ownership.

Registration is open when `REGISTRATION_EMAIL_ALLOWLIST` is empty or unset. To restrict new
accounts, configure a comma-separated list of exact email addresses; comparisons trim whitespace
and ignore case. The allowlist applies to password and OIDC account creation only and never blocks
an existing user from signing in. Domain wildcards are not supported.

Password registration requires at least six characters. Longer, unique passphrases are recommended
for stronger account security.

Password authentication is enabled by default. To run OIDC-only, set
`PASSWORD_AUTH_ENABLED=false` and configure all three OIDC values; startup rejects partial settings
or a deployment with no authentication method enabled:

```dotenv
PASSWORD_AUTH_ENABLED=false
OIDC_ISSUER_URL=https://identity.example.com
OIDC_CLIENT_ID=schtart
OIDC_CLIENT_SECRET=replace-with-provider-secret
```

Disabling password authentication removes both password sign-in and registration; configured OIDC
remains the available account entry method. Set all OIDC values together or leave them all unset.

Schtart uses the issuer's OpenID Connect discovery document at
`<OIDC_ISSUER_URL>/.well-known/openid-configuration`. Register
`<BETTER_AUTH_URL>/api/auth/callback/oidc` as the provider's redirect URI. OIDC is hidden from the
sign-in and setup pages when these settings are absent; Schtart supports one deployment-configured
provider and has no provider-management UI. Matching emails never merge identities automatically;
linking requires a signed-in user to complete the provider's authorization flow.

See [dashboard configuration](docs/dashboard-configuration.md) for complete YAML replacement,
defaults, user overrides, validation, and reset behavior. Agent and contributor workflow:
`AGENTS.md`.
