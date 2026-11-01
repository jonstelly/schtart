import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, closeDatabase } from '../../src/lib/server/db';
import { sql } from 'drizzle-orm';

export async function prepareIntegrationDatabase() {
	const testDatabaseUrl = process.env.TEST_DATABASE_URL;
	if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
		throw new Error('Integration tests must use TEST_DATABASE_URL as DATABASE_URL.');
	}
	const testDatabase = new URL(testDatabaseUrl);
	const databaseName = decodeURIComponent(testDatabase.pathname.replace(/^\/+/, ''));
	if (
		(testDatabase.protocol !== 'postgres:' && testDatabase.protocol !== 'postgresql:') ||
		!/(?:^|[_-])test$/i.test(databaseName)
	) {
		throw new Error('Destructive integration tests require a PostgreSQL database whose name ends with "test".');
	}

	await migrate(db, { migrationsFolder: './drizzle' });
}

export async function resetIntegrationDatabase() {
	await db.execute(
		sql`TRUNCATE TABLE "session", "account", "verification", "user" RESTART IDENTITY CASCADE`
	);
}

export async function closeIntegrationDatabase() {
	await closeDatabase();
}
