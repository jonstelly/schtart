import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error('DATABASE_URL is required. See .env.example.');
}

export default defineConfig({
	schema: './src/lib/server/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: databaseUrl }
});
