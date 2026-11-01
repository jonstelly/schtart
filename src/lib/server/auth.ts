import { building } from '$app/env';
import { APIError, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import { db } from './db';
import * as schema from './schema';
import { assignInitialAdministrator } from './registration';

const secret = process.env.BETTER_AUTH_SECRET;

if ((!secret && !building) || (secret && secret.length < 32)) {
	throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
}

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

function isRegistrationEmailAllowed(email: string) {
	const configured = process.env.REGISTRATION_EMAIL_ALLOWLIST?.trim();
	if (!configured) return true;

	const allowedEmails = new Set(configured.split(',').map(normalizeEmail).filter(Boolean));
	return allowedEmails.has(normalizeEmail(email));
}

export const auth = betterAuth({
	baseURL,
	basePath: '/api/auth',
	secret: secret ?? 'build-only-secret-not-used-at-runtime-0123456789',
	database: drizzleAdapter(db, { provider: 'pg', schema }),
	trustedOrigins: [baseURL],
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		minPasswordLength: 12
	},
	user: {
		additionalFields: {
			role: {
				type: 'string',
				required: false,
				defaultValue: 'user',
				input: false
			}
		}
	},
	plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30, immutableUsername: true })],
	databaseHooks: {
		user: {
			create: {
				before: async (newUser, context) => {
					if (
						context?.path === '/sign-up/email' &&
						(typeof newUser.username !== 'string' || !newUser.username.trim())
					) {
						throw APIError.from('BAD_REQUEST', {
							code: 'USERNAME_REQUIRED',
							message: 'A username is required to register.'
						});
					}

					const email = normalizeEmail(newUser.email);
					if (!isRegistrationEmailAllowed(email)) {
						throw APIError.from('FORBIDDEN', {
							code: 'REGISTRATION_EMAIL_NOT_ALLOWED',
							message: 'This email address is not allowed to register.'
						});
					}

					return { data: { ...newUser, email } };
				},
				after: async (newUser) => {
					await assignInitialAdministrator(newUser.id);
				}
			}
		}
	}
});
