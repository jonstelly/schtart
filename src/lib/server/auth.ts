import { building } from '$app/env';
import { APIError, betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { username } from 'better-auth/plugins';
import { decodeJwt } from 'jose';
import { db } from './db';
import * as schema from './schema';
import { assignInitialAdministrator } from './registration';
import { isRegistrationEmailAllowed, validateAuthConfiguration } from './auth-config';

type PendingOidcRegistration = { userId?: string };

// Keep the OIDC registration lifecycle isolated to one Better Auth request.
const pendingOidcRegistrations = new WeakMap<object, PendingOidcRegistration>();

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

const secret = process.env.BETTER_AUTH_SECRET;

if ((!secret && !building) || (secret && secret.length < 32)) {
	throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
}

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
export const authConfiguration = validateAuthConfiguration(process.env);
export const authFeatures = {
	passwordEnabled: authConfiguration.passwordEnabled,
	oidcEnabled: Boolean(authConfiguration.oidc)
};

const oidcConfiguration = authConfiguration.oidc;
const plugins = [
	username({ minUsernameLength: 3, maxUsernameLength: 30, immutableUsername: true }),
	...(oidcConfiguration
		? [
				genericOAuth({
					config: [
						{
							providerId: 'oidc',
							name: 'OpenID Connect',
							discoveryUrl: oidcConfiguration.discoveryUrl,
							clientId: oidcConfiguration.clientId,
							clientSecret: oidcConfiguration.clientSecret,
							scopes: ['openid', 'email', 'profile'],
							requireIdTokenVerification: true,
							accountSubject: ({ tokens, profile }) => {
								// Better Auth verifies this token before calling accountSubject. Decode only
								// its claims here; never trust the potentially UserInfo-derived profile issuer.
								if (typeof tokens.idToken !== 'string' || !tokens.idToken) {
									throw new Error('OIDC provider did not return a required ID token.');
								}
								const claims = decodeJwt(tokens.idToken);
								if (claims.iss !== oidcConfiguration.issuerUrl) {
									throw new Error('OIDC provider issuer does not match OIDC_ISSUER_URL.');
								}
								if (typeof claims.sub !== 'string' || !claims.sub) {
									throw new Error('OIDC provider did not return a stable subject.');
								}
								if (profile.sub !== claims.sub) {
									throw new Error('OIDC provider subject does not match the verified ID token.');
								}
								return claims.sub;
							}
						}
					]
				})
			]
		: [])
];

export const auth = betterAuth({
	baseURL,
	basePath: '/api/auth',
	secret: secret ?? 'build-only-secret-not-used-at-runtime-0123456789',
	// Keep Better Auth's user, credential, and initial session writes atomic. Its
	// supported create.after hook then runs only after those writes commit.
	database: drizzleAdapter(db, { provider: 'pg', schema, transaction: true }),
	trustedOrigins: [baseURL],
	account: {
		accountLinking: {
			enabled: true,
			disableImplicitLinking: true,
			trustedProviders: ['oidc']
		}
	},
	emailAndPassword: {
		enabled: authConfiguration.passwordEnabled,
		requireEmailVerification: false,
		minPasswordLength: 12
	},
	user: {
		validateUserInfo: ({ source }, context) => {
			if (
				source.action === 'create-user' &&
				source.method === 'oauth' &&
				source.oauth?.providerId === 'oidc'
			) {
				pendingOidcRegistrations.set(context.context, {});
			}
		},
		additionalFields: {
			username: { type: 'string', required: false, input: false },
			displayUsername: { type: 'string', required: false, input: false },
			role: {
				type: 'string',
				required: false,
				defaultValue: 'user',
				input: false
			}
		}
	},
	plugins,
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

					const email = newUser.email.trim().toLowerCase();
					if (!isRegistrationEmailAllowed(email, process.env.REGISTRATION_EMAIL_ALLOWLIST)) {
						throw APIError.from('FORBIDDEN', {
							code: 'REGISTRATION_EMAIL_NOT_ALLOWED',
							message: 'This email address is not allowed to register.'
						});
					}

					return { data: { ...newUser, email } };
				},
				after: async (newUser, context) => {
					const registration = context?.context
						? pendingOidcRegistrations.get(context.context)
						: undefined;
					if (registration) {
						// OIDC persists its account before its session; promote only after the
						// endpoint confirms that session belongs to this newly-created user.
						registration.userId = newUser.id;
						return;
					}

					// Even if an OIDC callback reaches user creation without a validation
					// marker, it must never fall through to password registration promotion.
					if (context?.path === '/callback/:id' && context.params?.id === 'oidc') return;

					await assignInitialAdministrator(newUser.id);
				}
			}
		},
	},
	hooks: {
		after: createAuthMiddleware(async (context) => {
			const registration = pendingOidcRegistrations.get(context.context);
			if (!registration) return;
			pendingOidcRegistrations.delete(context.context);

			const userId = registration.userId;
			const isOidcCallback = context.path === '/callback/:id' && context.params?.id === 'oidc';
			if (!userId || (!isOidcCallback && context.path !== '/sign-in/social')) return;

			const newSession = context.context.newSession;
			if (
				!newSession ||
				newSession.user.id !== userId ||
				newSession.session.userId !== userId
			) {
				return;
			}

			const role = await assignInitialAdministrator(userId);
			context.context.setNewSession({
				...newSession,
				user: { ...newSession.user, role }
			});

			const returned = context.context.returned;
			if (returned instanceof Response) {
				if (returned.status !== 200) return;
				const payload: unknown = await returned.clone().json();
				if (isRecord(payload) && isRecord(payload.user)) {
					return context.json({
						...payload,
						user: { ...payload.user, role }
					});
				}
			} else if (isRecord(returned) && isRecord(returned.user)) {
				returned.user.role = role;
			}
		})
	}
});
