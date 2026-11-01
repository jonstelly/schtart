import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from '../../src/lib/server/db';
import { prepareIntegrationDatabase, resetIntegrationDatabase } from './database';
import {
	assertCurrentIntegrationDatabase,
	assertSafeIntegrationDatabase
} from './database-safety';

vi.mock('../../src/lib/server/db', () => ({
	db: { execute: vi.fn() },
	closeDatabase: vi.fn()
}));
vi.mock('drizzle-orm/postgres-js/migrator', () => ({ migrate: vi.fn() }));

const previousTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const previousDatabaseUrl = process.env.DATABASE_URL;
const execute = vi.mocked(db.execute);

beforeEach(() => {
	process.env.TEST_DATABASE_URL = 'postgres://user:password@localhost:5432/schtart_test';
	process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
	execute.mockReset();
	vi.mocked(migrate).mockReset();
});

afterAll(() => {
	if (previousTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL;
	else process.env.TEST_DATABASE_URL = previousTestDatabaseUrl;
	if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
	else process.env.DATABASE_URL = previousDatabaseUrl;
});

describe('integration database safety', () => {
	it('accepts a dedicated test database URL', () => {
		expect(
			assertSafeIntegrationDatabase(
				'postgres://user:password@localhost:5432/schtart_test',
				'postgres://user:password@localhost:5432/schtart_test'
			)
		).toBe('schtart_test');
	});

	it.each(['database', 'dbname', 'DBNAME'])('rejects a %s query-parameter override', (key) => {
		const url = `postgres://user:password@localhost:5432/schtart_test?${key}=production`;
		expect(() => assertSafeIntegrationDatabase(url, url)).toThrow(/database override/i);
	});

	it('refuses a query-parameter database override in the integration test command', () => {
		const url = 'postgres://user:password@localhost:5432/schtart_test?dbname=production';
		const result = spawnSync(process.execPath, [resolve('scripts/test-integration.mjs')], {
			encoding: 'utf8',
			env: { ...process.env, TEST_DATABASE_URL: url }
		});

		expect(result.status).not.toBe(0);
		expect(result.stderr).toMatch(/database override/i);
	});

	it.each([
		'postgres://user:password@localhost:5432/production',
		'postgres://user:password@localhost:5432/schtart_test?db=production'
	])('refuses unsafe database URLs before starting browser tests: %s', (url) => {
		const result = spawnSync(process.execPath, [resolve('scripts/test-browser.mjs')], {
			encoding: 'utf8',
			env: { ...process.env, TEST_DATABASE_URL: url }
		});

		expect(result.status).not.toBe(0);
		expect(result.stderr).toMatch(/(?:ends with "test"|database override)/i);
		expect(result.stderr).not.toMatch(/ECONNREFUSED|playwright/i);
	});

	it('requires the application database URL to match the designated test URL', () => {
		expect(() =>
			assertSafeIntegrationDatabase(
				'postgres://user:password@localhost:5432/schtart_test',
				'postgres://user:password@localhost:5432/schtart'
			)
		).toThrow(/must use TEST_DATABASE_URL/i);
	});

	it('rejects databases whose names are not explicitly test-designated', () => {
		expect(() =>
			assertSafeIntegrationDatabase(
				'postgres://user:password@localhost:5432/production',
				'postgres://user:password@localhost:5432/production'
			)
		).toThrow(/ends with "test"/i);
	});

	it('requires the connected PostgreSQL database to match the URL database', () => {
		expect(() => assertCurrentIntegrationDatabase('schtart_test', 'production')).toThrow(
			/current_database\(\)/i
		);
	});

	it('checks current_database() before applying migrations', async () => {
		execute.mockResolvedValueOnce([{ name: 'production' }] as never);

		await expect(prepareIntegrationDatabase()).rejects.toThrow(/current_database\(\)/i);
		expect(execute).toHaveBeenCalledTimes(1);
		expect(migrate).not.toHaveBeenCalled();
	});

	it('checks current_database() before truncating auth tables', async () => {
		execute.mockResolvedValueOnce([{ name: 'production' }] as never);

		await expect(resetIntegrationDatabase()).rejects.toThrow(/current_database\(\)/i);
		expect(execute).toHaveBeenCalledTimes(1);
	});
});
