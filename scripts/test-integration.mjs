import { spawnSync } from 'node:child_process';

import { assertTestDatabaseUrl } from './test-database-safety.mjs';

let value;
try {
	({ url: value } = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL));
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}

const result = spawnSync(
	'pnpm',
	['exec', 'vitest', 'run', '--config', 'vitest.integration.config.ts'],
	{
		stdio: 'inherit',
		env: {
			...process.env,
			DATABASE_URL: value,
			BETTER_AUTH_URL: 'http://localhost:3000',
			BETTER_AUTH_SECRET: 'integration-test-only-not-a-deployment-secret-0123456789',
			PASSWORD_AUTH_ENABLED: 'true',
			OIDC_ISSUER_URL: '',
			OIDC_CLIENT_ID: '',
			OIDC_CLIENT_SECRET: '',
			REGISTRATION_EMAIL_ALLOWLIST: ''
		}
	}
);

if (result.error) {
	console.error(result.error);
	process.exit(1);
}

process.exit(result.status ?? 1);
