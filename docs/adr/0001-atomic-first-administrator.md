# ADR-0001: Atomic first-administrator assignment

- Status: Accepted
- Date: 2026-11-01

## Context

An unclaimed instance must let its first successful account registration become administrator without a preconfigured email list or bootstrap command. Concurrent registrations must never create multiple initial administrators. Better Auth owns password, account, and session lifecycles; PostgreSQL is the durable source of role state. Password registration persists its user, credential, and initial session atomically. Generic OAuth can persist a new user and account before it attempts the initial session, so the OIDC lifecycle has different accepted failure semantics.

## Decision

Better Auth's Drizzle adapter transactions are enabled so password signup persists the user, credential, and initial session atomically. After that transaction commits, Better Auth's supported user-create database hook calls the registration service. The service opens a PostgreSQL transaction, acquires advisory lock `(0x53434854, 1)` in the `SCHT` application namespace, checks for an existing administrator, and promotes the current user only when none exists. The role is stored on the user record and is not client-writable. The transaction commits before the registration hook completes. If password credential or session persistence fails, the signup transaction rolls back and the hook cannot promote a partial account.

For OIDC, record only a user admitted by Better Auth's `user.validateUserInfo` lifecycle as a newly created OAuth user for provider `oidc`. The supported user-create hook records that persisted user ID for the current auth request but does not promote it. After Better Auth confirms a new session for that same user, promote through the same advisory-lock registration service and refresh the session and any successful JSON response's sanitized user role. This applies to callback and direct social sign-in flows. Returning OIDC sign-in and explicit account linking do not bootstrap an unclaimed instance.

The registration email allowlist, when set, is an exact comma-separated list of email addresses. App code trims and lowercases addresses for matching; the setting governs account creation only, not authentication.

## Consequences

- Concurrent registration hooks serialize on the database lock, so only one can observe an unclaimed instance and assign the administrator role.
- The role persists across process restarts and is checked server-side for administrator routes.
- An OIDC user and account may persist with the ordinary `user` role if session persistence fails. No administrator is assigned in that case; the next genuinely new successful registration can claim the instance. Retrying sign-in for that OIDC account or linking an identity to an existing account does not bootstrap it.
- If password account creation succeeds but the process fails before role assignment completes, the instance remains unclaimed; the next successful registration can complete setup.
- The initial registration remains a deliberate takeover risk. Deployers must complete setup before public exposure.
- Email is not verified and cannot be treated as proof of ownership. No recovery email or bootstrap CLI is provided.
