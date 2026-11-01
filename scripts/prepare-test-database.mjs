import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { assertTestDatabaseUrl } from './test-database-safety.mjs';

/** @param {string | undefined} value */
export async function prepareTestDatabase(value) {
	const { url, databaseName } = assertTestDatabaseUrl(value);
	const client = postgres(url, { max: 1, connect_timeout: 10 });

	try {
		const [connection] = await client`SELECT current_database() AS name`;
		if (connection.name !== databaseName) {
			throw new Error(
				`Refusing destructive test operation: current_database() is "${connection.name}", not the designated test database.`
			);
		}

		await migrate(drizzle(client), { migrationsFolder: './drizzle' });
		await client.unsafe(
			'TRUNCATE TABLE "dashboard_user_configuration", "dashboard_server_default", "session", "account", "verification", "user" RESTART IDENTITY CASCADE'
		);
	} finally {
		await client.end({ timeout: 5 });
	}

	return url;
}
