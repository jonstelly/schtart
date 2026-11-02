const DATABASE_OVERRIDE_PARAMETERS = new Set(['db', 'database', 'dbname']);

/**
 * @param {string | undefined} value
 * @returns {{ url: string, databaseName: string }}
 */
export function assertTestDatabaseUrl(value) {
	if (!value) {
		throw new Error('TEST_DATABASE_URL must point to a dedicated disposable PostgreSQL test database.');
	}

	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
	}

	if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
		throw new Error('TEST_DATABASE_URL must be a PostgreSQL URL.');
	}
	if ([...url.searchParams.keys()].some((key) => DATABASE_OVERRIDE_PARAMETERS.has(key.toLowerCase()))) {
		throw new Error('TEST_DATABASE_URL must not include a database override query parameter.');
	}

	let databaseName;
	try {
		databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
	} catch {
		throw new Error('TEST_DATABASE_URL must contain a valid database name.');
	}
	if (!/(?:^|[_-])test$/i.test(databaseName)) {
		throw new Error(
			`Refusing destructive test operations against database "${databaseName}". ` +
				'Use a dedicated test database whose name ends with "test" (for example, schtart_test).'
		);
	}

	return { url: value, databaseName };
}
