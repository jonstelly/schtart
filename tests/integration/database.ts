import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, closeDatabase } from '../../src/lib/server/db';
import { sql } from 'drizzle-orm';
import { assertCurrentIntegrationDatabase, assertSafeIntegrationDatabase } from './database-safety';

async function verifyIntegrationDatabase() {
	const expectedDatabase = assertSafeIntegrationDatabase(
		process.env.TEST_DATABASE_URL,
		process.env.DATABASE_URL
	);
	const [connection] = await db.execute<{ name: string }>(sql`SELECT current_database() AS name`);
	assertCurrentIntegrationDatabase(expectedDatabase, connection.name);
}

export async function prepareIntegrationDatabase() {
	await verifyIntegrationDatabase();
	await migrate(db, { migrationsFolder: './drizzle' });
}

export async function resetIntegrationDatabase() {
	await verifyIntegrationDatabase();
	await db.execute(
		sql`TRUNCATE TABLE "dashboard_user_configuration", "dashboard_server_default", "session", "account", "verification", "user" RESTART IDENTITY CASCADE`
	);
}

export async function closeIntegrationDatabase() {
	await closeDatabase();
}
