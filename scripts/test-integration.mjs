import { spawnSync } from 'node:child_process';

const value = process.env.TEST_DATABASE_URL;
const databaseOverrideParameters = new Set(['db', 'database', 'dbname']);

if (!value) {
	console.error('TEST_DATABASE_URL must point to a dedicated disposable PostgreSQL test database.');
	process.exit(1);
}

let databaseName;

try {
	const url = new URL(value);
	if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') throw new Error();
	if ([...url.searchParams.keys()].some((key) => databaseOverrideParameters.has(key.toLowerCase()))) {
		console.error('TEST_DATABASE_URL must not include a database override query parameter.');
		process.exit(1);
	}
	databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
} catch {
	console.error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
	process.exit(1);
}

if (!/(?:^|[_-])test$/i.test(databaseName)) {
	console.error(`Refusing to run destructive integration tests against database "${databaseName}".`);
	console.error('Use a dedicated test database whose name ends with "test" (for example, schtart_test).');
	process.exit(1);
}

const result = spawnSync(
	'pnpm',
	['exec', 'vitest', 'run', '--config', 'vitest.integration.config.ts'],
	{
		stdio: 'inherit',
		env: { ...process.env, DATABASE_URL: value }
	}
);

if (result.error) {
	console.error(result.error);
	process.exit(1);
}

process.exit(result.status ?? 1);
