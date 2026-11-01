import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
	closeIntegrationDatabase,
	prepareIntegrationDatabase,
	resetIntegrationDatabase
} from '../../../../tests/integration/database';
import { LocalOidcProvider, type OidcIdentity } from '../../../../tests/integration/local-oidc-provider';
import { account, session, user } from '../../../lib/server/schema';
import { db } from '../../../lib/server/db';
import { hasAdministrator } from '../../../lib/server/registration';

const appOrigin = 'http://localhost:3000';
const originalEnvironment = new Map<string, string | undefined>();
const environmentKeys = [
	'BETTER_AUTH_SECRET',
	'BETTER_AUTH_URL',
	'PASSWORD_AUTH_ENABLED',
	'OIDC_ISSUER_URL',
	'OIDC_CLIENT_ID',
	'OIDC_CLIENT_SECRET',
	'REGISTRATION_EMAIL_ALLOWLIST'
];

for (const key of environmentKeys) originalEnvironment.set(key, process.env[key]);

const provider = new LocalOidcProvider();
let postAuth: (event: { request: Request }) => Promise<Response>;
let getAuth: (event: { request: Request }) => Promise<Response>;

function request(path: string, method: 'GET' | 'POST', body?: object, cookie?: string) {
	return new Request(`${appOrigin}/api/auth/${path}`, {
		method,
		headers: {
			...(method === 'POST' ? { origin: appOrigin } : {}),
			...(body ? { 'content-type': 'application/json' } : {}),
			...(cookie ? { cookie } : {})
		},
		...(body ? { body: JSON.stringify(body) } : {})
	});
}

function updateCookies(previous: string | undefined, response: Response) {
	const cookies = new Map(
		(previous ?? '')
			.split(';')
			.map((cookie) => cookie.trim())
			.filter(Boolean)
			.map((cookie) => [cookie.slice(0, cookie.indexOf('=')), cookie])
	);
	for (const value of response.headers.getSetCookie()) {
		const cookie = value.split(';', 1)[0];
		cookies.set(cookie.slice(0, cookie.indexOf('=')), cookie);
	}
	return [...cookies.values()].join('; ');
}

function sessionCookie(response: Response) {
	return response.headers
		.getSetCookie()
		.find((value) => value.includes('session_token='))
		?.split(';', 1)[0];
}

async function oauthRequest(
	path: 'sign-in/social' | 'link-social',
	identity: OidcIdentity,
	cookie?: string
) {
	provider.useIdentity(identity);
	const start = await postAuth({
		request: request(
			path,
			'POST',
			{
				provider: 'oidc',
				callbackURL: '/',
				disableRedirect: true,
				...(path === 'sign-in/social' ? { loginHint: identity.sub } : {})
			},
			cookie
		)
	});
	const payload = await start.json();
	if (!start.ok || typeof payload.url !== 'string') {
		return { start, callback: undefined, cookie: updateCookies(cookie, start) };
	}

	const providerResponse = await fetch(payload.url, { redirect: 'manual' });
	const callbackUrl = providerResponse.headers.get('location');
	if (providerResponse.status !== 302 || !callbackUrl) {
		throw new Error(`Test identity provider did not redirect: ${providerResponse.status}`);
	}
	const callback = await getAuth({
		request: new Request(callbackUrl, {
			headers: { cookie: updateCookies(cookie, start) }
		})
	});
	return { start, callback, cookie: updateCookies(cookie, callback) };
}

describe('OIDC authentication and account linking', () => {
	beforeAll(async () => {
		await prepareIntegrationDatabase();
		await provider.start();
		process.env.BETTER_AUTH_SECRET = 'oidc-integration-test-secret-with-at-least-32-bytes';
		process.env.BETTER_AUTH_URL = appOrigin;
		process.env.PASSWORD_AUTH_ENABLED = 'true';
		process.env.OIDC_ISSUER_URL = provider.issuerUrl;
		process.env.OIDC_CLIENT_ID = 'schtart-test-client';
		process.env.OIDC_CLIENT_SECRET = 'local-test-client-secret';
		delete process.env.REGISTRATION_EMAIL_ALLOWLIST;

		const authRoutes = await import('./[...all]/+server');
		postAuth = authRoutes.POST as typeof postAuth;
		getAuth = authRoutes.GET as typeof getAuth;
	});

	beforeEach(async () => {
		delete process.env.REGISTRATION_EMAIL_ALLOWLIST;
		provider.setOmitIdToken(false);
		provider.setDiscoveryIssuer();
		await resetIntegrationDatabase();
	});

	afterAll(async () => {
		await provider.stop();
		await closeIntegrationDatabase();
		for (const key of environmentKeys) {
			const value = originalEnvironment.get(key);
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	it('registers the first OIDC user as administrator and does not revoke their sign-in when policy changes', async () => {
		process.env.REGISTRATION_EMAIL_ALLOWLIST = 'allowed@example.test';
		const identity = {
			sub: 'initial-admin',
			email: 'allowed@example.test',
			name: 'Initial Admin',
			emailVerified: true
		};
		const registration = await oauthRequest('sign-in/social', identity);
		expect(registration.start.status).toBe(200);
		expect(registration.callback?.status).toBe(302);
		expect(await hasAdministrator()).toBe(true);

		process.env.REGISTRATION_EMAIL_ALLOWLIST = 'someone-else@example.test';
		const existingUserSignIn = await oauthRequest('sign-in/social', identity);
		expect(existingUserSignIn.callback?.status).toBe(302);
		expect(sessionCookie(existingUserSignIn.callback!)).toBeDefined();
		expect(await db.select({ id: user.id }).from(user)).toHaveLength(1);
		expect(await db.select({ role: user.role }).from(user)).toEqual([{ role: 'admin' }]);
	});

	it('enforces the OIDC registration allowlist without claiming an unclaimed instance', async () => {
		process.env.REGISTRATION_EMAIL_ALLOWLIST = 'allowed@example.test';
		const registration = await oauthRequest('sign-in/social', {
			sub: 'denied-subject',
			email: 'denied@example.test',
			name: 'Denied User'
		});

		expect(registration.start.status).toBe(200);
		expect(await db.select({ id: user.id }).from(user)).toHaveLength(0);
		expect(await hasAdministrator()).toBe(false);
	});

	it('rejects an access-token-only response without creating an account, session, or administrator', async () => {
		provider.setOmitIdToken(true);
		const result = await oauthRequest('sign-in/social', {
			sub: 'access-token-only-subject',
			email: 'access-token-only@example.test',
			name: 'Access Token Only'
		});

		expect(result.start.status).toBe(200);
		expect(sessionCookie(result.callback!)).toBeUndefined();
		expect(await db.select({ id: user.id }).from(user)).toHaveLength(0);
		expect(await db.select({ id: account.id }).from(account)).toHaveLength(0);
		expect(await db.select({ id: session.id }).from(session)).toHaveLength(0);
		expect(await hasAdministrator()).toBe(false);
	});

	it('does not merge matching emails automatically and links only after authenticated external proof', async () => {
		const registration = await postAuth({
			request: request('sign-up/email', 'POST', {
				name: 'Ada',
				username: 'ada',
				email: 'ada@example.test',
				password: 'correct horse battery staple'
			})
		});
		expect(registration.status).toBe(200);
		const adaId = (await registration.json()).user.id as string;
		const passwordSession = sessionCookie(registration);
		expect(passwordSession).toBeDefined();
		// Make implicit linking eligible under Better Auth's ordinary verified-email policy;
		// this test must show Schtart disables even that automatic merge path.
		await db.update(user).set({ emailVerified: true }).where(eq(user.id, adaId));

		const collision = await oauthRequest('sign-in/social', {
			sub: 'unlinked-identity',
			email: 'ada@example.test',
			name: 'Ada from IdP'
		});
		expect(collision.callback?.status).toBe(302);
		expect(await db.select({ id: user.id }).from(user)).toHaveLength(1);
		expect(await db.select({ id: account.id }).from(account).where(eq(account.providerId, 'oidc'))).toHaveLength(0);

		const unauthenticatedLink = await postAuth({
			request: request(
				'link-social',
				'POST',
				{ provider: 'oidc', callbackURL: '/', disableRedirect: true }
			)
		});
		expect(unauthenticatedLink.status).toBe(401);

		const explicitLink = await oauthRequest(
			'link-social',
			{ sub: 'ada-oidc-account', email: 'ada@example.test', name: 'Ada at IdP' },
			passwordSession
		);
		expect(explicitLink.start.status).toBe(200);
		expect(explicitLink.callback?.status).toBe(302);
		expect(
			await db
				.select({ userId: account.userId, accountId: account.accountId })
				.from(account)
				.where(eq(account.providerId, 'oidc'))
		).toEqual([{ userId: adaId, accountId: 'ada-oidc-account' }]);
	});
});
