# ADR-0001: Atomic first-administrator assignment

- Status: Accepted
- Date: 2026-11-01

## Context

An unclaimed instance must let its first successful account registration become administrator without a preconfigured email list or bootstrap command. Concurrent registrations must never create multiple initial administrators. Better Auth owns password, account, and session lifecycles; PostgreSQL is the durable source of role state.

## Decision

Better Auth's Drizzle adapter transactions are enabled so signup persists the user, credential, and initial session atomically. After that transaction commits, Better Auth's supported user-create database hook calls the registration service. The service opens a PostgreSQL transaction, acquires advisory lock `(0x53434854, 1)` in the `SCHT` application namespace, checks for an existing administrator, and promotes the current user only when none exists. The role is stored on the user record and is not client-writable. The transaction commits before the registration hook completes. If credential or session persistence fails, the signup transaction rolls back and the hook cannot promote a partial account.

The registration email allowlist, when set, is an exact comma-separated list of email addresses. App code trims and lowercases addresses for matching; the setting governs account creation only, not authentication.

## Consequences

- Concurrent registration hooks serialize on the database lock, so only one can observe an unclaimed instance and assign the administrator role.
- The role persists across process restarts and is checked server-side for administrator routes.
- If account creation succeeds but the process fails before role assignment completes, the instance remains unclaimed; the next successful registration can complete setup.
- The initial registration remains a deliberate takeover risk. Deployers must complete setup before public exposure.
- Email is not verified and cannot be treated as proof of ownership. No recovery email or bootstrap CLI is provided.
