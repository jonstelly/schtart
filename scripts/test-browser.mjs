import { spawnSync } from 'node:child_process';
import { prepareTestDatabase } from './prepare-test-database.mjs';

let databaseUrl;
try {
	databaseUrl = await prepareTestDatabase(process.env.TEST_DATABASE_URL);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}

const result = spawnSync('pnpm', ['exec', 'playwright', 'test'], {
	stdio: 'inherit',
	env: {
		...process.env,
		DATABASE_URL: databaseUrl,
		TEST_DATABASE_URL: databaseUrl
	}
});

if (result.error) {
	console.error(result.error);
	process.exit(1);
}

process.exit(result.status ?? 1);
