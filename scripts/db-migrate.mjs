import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.error('DATABASE_URL is required. See .env.example.');
	process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, connect_timeout: 10 });

try {
	await migrate(drizzle(client), { migrationsFolder: './drizzle' });
	console.log('Database migrations are up to date.');
} finally {
	await client.end({ timeout: 5 });
}
