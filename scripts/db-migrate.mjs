import { runDatabaseMigrations } from './database-migrations.mjs';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.error('DATABASE_URL is required. See .env.example.');
	process.exit(1);
}

try {
	await runDatabaseMigrations(databaseUrl);
	console.log('Database migrations are up to date.');
} catch (error) {
	console.error(formatError(error));
	process.exitCode = 1;
}

function formatError(error) {
	const messages = [];
	const visited = new Set();
	for (let current = error; current && !visited.has(current); current = current.cause) {
		visited.add(current);
		if (typeof current.message === 'string' && !messages.includes(current.message)) {
			messages.push(current.message);
		}
	}
	return messages.join('\nCaused by: ') || String(error);
}
