# ADR-0002: Fixed OIDC issuer identity

- Status: Accepted
- Date: 2026-11-01

## Context

OIDC accounts are stored under the Better Auth provider ID `oidc`, with the provider subject as the account ID. A configured issuer therefore defines the namespace in which those account subjects identify users. Discovery metadata and UserInfo are provider-controlled inputs; neither may replace the deployment's configured issuer identity when resolving an account.

## Decision

Preserve `OIDC_ISSUER_URL` exactly as configured after rejecting surrounding whitespace. Normalize a separate discovery URL only to retrieve the OpenID Connect discovery document. Better Auth verifies the ID token; Schtart decodes only the already-verified token's claims and requires its issuer to exactly equal the configured issuer string, its subject to be a nonempty string, and the returned profile subject to equal that token subject. The resolved account ID is the verified token subject, never a UserInfo issuer or subject.

Once any accounts exist under provider ID `oidc`, the configured issuer and its identity are fixed for that instance. Changing it can reinterpret account subjects and must not be done as a routine configuration update; it requires a separately designed migration that preserves account ownership and collision safety.

## Consequences

- UserInfo may supply profile attributes without an `iss` claim, but cannot establish issuer or subject identity.
- Differences such as a trailing slash, host casing, explicit port, or escaped path remain part of the configured identity even if discovery URL construction normalizes the URL.
- Deployers must keep the issuer setting stable for as long as OIDC accounts exist. No issuer-change migration is provided.
- Signature, issuer, audience, expiry, and nonce verification remain Better Auth's responsibility; Schtart does not add custom cryptography or a second token verifier.
