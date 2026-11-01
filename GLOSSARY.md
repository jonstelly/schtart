# Glossary

- **Instance**: one deployed Schtart application connected to its PostgreSQL database.
- **Registration**: creating a new Schtart user account. Registration policy does not affect sign-in for an existing user.
- **Unclaimed instance**: an instance with no administrator account yet.
- **Administrator**: the first successfully registered user on an unclaimed instance; administrators can access administrator-only server operations.
- **Registration email allowlist**: an optional list of exact normalized email addresses permitted to create new accounts.
- **OIDC provider**: the single deployment-configured OpenID Connect identity provider used for sign-in and account linking.
- **Account linking**: an authenticated user's explicit addition of an external identity after completing that provider's authorization flow; matching email alone never links accounts.
- **Dashboard configuration**: one complete validated YAML document defining a user's Home, News, Sports, and Monitoring pages, their columns, ordered registered widgets, and permitted widget parameters.
- **Registered widget**: a built-in reusable dashboard component with a known configuration schema and no user-defined execution or network behavior.
- **Server default**: the database-backed dashboard configuration used by users who have no personal override; it is seeded only when absent.
- **User override**: a user's complete replacement dashboard configuration, isolated from other users and from later server-default changes until reset.
