import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const connectionOptions = { max: 1, connect_timeout: 10 };

export async function runDatabaseMigrations(
	databaseUrl,
	{
		connect = postgres,
		applyMigrations = (client) => migrate(drizzle(client), { migrationsFolder: './drizzle' })
	} = {}
) {
	const migrateTarget = async () => {
		const client = connect(databaseUrl, connectionOptions);
		try {
			await applyMigrations(client);
		} finally {
			await client.end({ timeout: 5 });
		}
	};

	try {
		await migrateTarget();
	} catch (error) {
		if (!hasPostgresCode(error, '3D000')) throw error;

		await createDatabaseThroughPostgres(databaseUrl, connect);
		await migrateTarget();
	}
}

async function createDatabaseThroughPostgres(databaseUrl, connect) {
	const target = new URL(databaseUrl);
	const databaseName = decodeURIComponent(target.pathname.replace(/^\/+/, ''));
	if (!databaseName) throw new Error('DATABASE_URL must include the target database name.');

	target.pathname = '/postgres';
	const maintenanceClient = connect(target.toString(), connectionOptions);
	try {
		const existing = await maintenanceClient.unsafe(
			'SELECT 1 FROM pg_database WHERE datname = $1',
			[databaseName]
		);

		if (existing.length === 0) {
			try {
				await maintenanceClient.unsafe(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
			} catch (error) {
				// PostgreSQL may report a duplicate name or a catalog uniqueness race.
				if (!hasPostgresCode(error, '42P04') && !hasPostgresCode(error, '23505')) throw error;
				const createdByAnotherProcess = await maintenanceClient.unsafe(
					'SELECT 1 FROM pg_database WHERE datname = $1',
					[databaseName]
				);
				if (createdByAnotherProcess.length === 0) throw error;
			}
		}
	} catch (error) {
		if (hasPostgresCode(error, '42501')) {
			throw new Error(
				`Cannot create database "${databaseName}" via the "postgres" maintenance database. The configured PostgreSQL role needs CONNECT on "postgres" and CREATEDB privilege.`,
				{ cause: error }
			);
		}
		throw new Error(
			`Could not create database "${databaseName}" via the "postgres" maintenance database. Ensure that database exists and the configured role can connect to it.`,
			{ cause: error }
		);
	} finally {
		await maintenanceClient.end({ timeout: 5 });
	}
}

function quoteIdentifier(identifier) {
	return `"${identifier.replaceAll('"', '""')}"`;
}

function hasPostgresCode(error, code) {
	const visited = new Set();
	for (let current = error; current && !visited.has(current); current = current.cause) {
		visited.add(current);
		if (current.code === code) return true;
	}
	return false;
}
