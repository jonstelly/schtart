import { building } from '$app/env';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && !building) {
	throw new Error('DATABASE_URL is required to connect to PostgreSQL.');
}

// SvelteKit imports server modules while analyzing routes; no connection is made at build time.
export const postgresClient = postgres(databaseUrl || 'postgres://build:build@127.0.0.1:1/schtart-build', {
	max: 10,
	idle_timeout: 20,
	connect_timeout: 10
});

export const db = drizzle(postgresClient, { schema });

export async function closeDatabase() {
	await postgresClient.end({ timeout: 5 });
}
