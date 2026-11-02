import { describe, expect, it, vi } from 'vitest';
import { runDatabaseMigrations } from './database-migrations';

const databaseUrl = 'postgres://app:secret@localhost:5432/schtart%22blue';

function postgresError(code: string) {
	return Object.assign(new Error(`PostgreSQL error ${code}`), { code });
}

function drizzleMissingDatabaseError() {
	return new Error('Migration failed', { cause: postgresError('3D000') });
}

function client(unsafe: (...args: unknown[]) => Promise<unknown> = async () => []) {
	return { unsafe: vi.fn(unsafe), end: vi.fn(async () => undefined) };
}

describe('database migrations', () => {
	it('migrates an existing database without connecting to the maintenance database', async () => {
		const targetClient = client();
		const connect = vi.fn(() => targetClient);
		const applyMigrations = vi.fn(async () => undefined);

		await runDatabaseMigrations(databaseUrl, { connect, applyMigrations });

		expect(connect).toHaveBeenCalledTimes(1);
		expect(connect.mock.calls[0][0]).toBe(databaseUrl);
		expect(applyMigrations).toHaveBeenCalledTimes(1);
		expect(targetClient.end).toHaveBeenCalledOnce();
	});

	it('creates a missing database through postgres, safely quotes its name, then migrates it', async () => {
		const firstTargetClient = client();
		const maintenanceClient = client(async (query) => {
			if (query === 'SELECT 1 FROM pg_database WHERE datname = $1') return [];
			return [];
		});
		const secondTargetClient = client();
		const clients = [firstTargetClient, maintenanceClient, secondTargetClient];
		const connect = vi.fn(() => clients.shift()!);
		const applyMigrations = vi
			.fn<(...args: unknown[]) => Promise<void>>()
			.mockRejectedValueOnce(drizzleMissingDatabaseError())
			.mockResolvedValueOnce(undefined);

		await runDatabaseMigrations(databaseUrl, { connect, applyMigrations });

		expect(connect.mock.calls.map(([url]) => new URL(url as string).pathname)).toEqual([
			'/schtart%22blue',
			'/postgres',
			'/schtart%22blue'
		]);
		expect(maintenanceClient.unsafe).toHaveBeenNthCalledWith(
			1,
			'SELECT 1 FROM pg_database WHERE datname = $1',
			['schtart"blue']
		);
		expect(maintenanceClient.unsafe).toHaveBeenNthCalledWith(
			2,
			'CREATE DATABASE "schtart""blue"'
		);
		expect(applyMigrations).toHaveBeenCalledTimes(2);
		expect(firstTargetClient.end).toHaveBeenCalledOnce();
		expect(maintenanceClient.end).toHaveBeenCalledOnce();
		expect(secondTargetClient.end).toHaveBeenCalledOnce();
	});

	it.each(['42P04', '23505'])(
		'continues if another process creates the database first (%s)',
		async (code) => {
			let existenceChecks = 0;
			const clients = [
				client(),
				client(async (query) => {
					if (query === 'SELECT 1 FROM pg_database WHERE datname = $1') {
						existenceChecks += 1;
						return existenceChecks === 1 ? [] : [{ datname: 'schtart"blue' }];
					}
					throw postgresError(code);
				}),
				client()
			];
			const connect = vi.fn(() => clients.shift()!);
			const applyMigrations = vi
				.fn<(...args: unknown[]) => Promise<void>>()
				.mockRejectedValueOnce(drizzleMissingDatabaseError())
				.mockResolvedValueOnce(undefined);

			await expect(
				runDatabaseMigrations(databaseUrl, { connect, applyMigrations })
			).resolves.toBeUndefined();
			expect(existenceChecks).toBe(2);
			expect(applyMigrations).toHaveBeenCalledTimes(2);
		}
	);

	it('does not treat an unrelated catalog uniqueness violation as a creation race', async () => {
		let existenceChecks = 0;
		const duplicateError = postgresError('23505');
		const clients = [
			client(),
			client(async (query) => {
				if (query === 'SELECT 1 FROM pg_database WHERE datname = $1') {
					existenceChecks += 1;
					return [];
				}
				throw duplicateError;
			})
		];
		const connect = vi.fn(() => clients.shift()!);
		const applyMigrations = vi.fn(async () => {
			throw drizzleMissingDatabaseError();
		});

		const error = await runDatabaseMigrations(databaseUrl, {
			connect,
			applyMigrations
		}).catch((caught) => caught);
		expect(error.cause).toBe(duplicateError);
		expect(existenceChecks).toBe(2);
		expect(applyMigrations).toHaveBeenCalledOnce();
	});

	it('does not try to create a database for unrelated migration failures', async () => {
		const targetClient = client();
		const connect = vi.fn(() => targetClient);
		const migrationError = postgresError('28P01');
		const applyMigrations = vi.fn(async () => {
			throw migrationError;
		});

		await expect(runDatabaseMigrations(databaseUrl, { connect, applyMigrations })).rejects.toBe(
			migrationError
		);
		expect(connect).toHaveBeenCalledTimes(1);
	});

	it('explains the required privilege if the configured role cannot create databases', async () => {
		const clients = [
			client(),
			client(async (query) => {
				if (query === 'SELECT 1 FROM pg_database WHERE datname = $1') return [];
				throw postgresError('42501');
			})
		];
		const connect = vi.fn(() => clients.shift()!);
		const applyMigrations = vi.fn(async () => {
			throw drizzleMissingDatabaseError();
		});

		await expect(
			runDatabaseMigrations(databaseUrl, { connect, applyMigrations })
		).rejects.toThrow(/CREATEDB/i);
	});
});
