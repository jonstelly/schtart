const TEST_DATABASE_NAME = /(?:^|[_-])test$/i;
const DATABASE_OVERRIDE_PARAMETERS = new Set(['db', 'database', 'dbname']);

export function assertSafeIntegrationDatabase(
	testDatabaseUrl: string | undefined,
	databaseUrl: string | undefined
): string {
	if (!testDatabaseUrl || databaseUrl !== testDatabaseUrl) {
		throw new Error('Integration tests must use TEST_DATABASE_URL as DATABASE_URL.');
	}

	let testDatabase: URL;
	try {
		testDatabase = new URL(testDatabaseUrl);
	} catch {
		throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
	}

	if (testDatabase.protocol !== 'postgres:' && testDatabase.protocol !== 'postgresql:') {
		throw new Error('TEST_DATABASE_URL must be a PostgreSQL URL.');
	}

	if ([...testDatabase.searchParams.keys()].some((key) => DATABASE_OVERRIDE_PARAMETERS.has(key.toLowerCase()))) {
		throw new Error('TEST_DATABASE_URL must not include a database override query parameter.');
	}

	let databaseName: string;
	try {
		databaseName = decodeURIComponent(testDatabase.pathname.replace(/^\/+/, ''));
	} catch {
		throw new Error('TEST_DATABASE_URL must contain a valid database name.');
	}

	if (!TEST_DATABASE_NAME.test(databaseName)) {
		throw new Error('Destructive integration tests require a PostgreSQL database whose name ends with "test".');
	}

	return databaseName;
}

export function assertCurrentIntegrationDatabase(expectedDatabase: string, currentDatabase: string): void {
	if (currentDatabase !== expectedDatabase) {
		throw new Error(
			`Refusing destructive integration test operation: current_database() is "${currentDatabase}", not the designated test database.`
		);
	}
}
