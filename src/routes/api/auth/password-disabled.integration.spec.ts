import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	closeIntegrationDatabase,
	prepareIntegrationDatabase,
	resetIntegrationDatabase
} from '../../../../tests/integration/database';
import { LocalOidcProvider } from '../../../../tests/integration/local-oidc-provider';
import { db } from '../../../lib/server/db';
import { hasAdministrator } from '../../../lib/server/registration';
import { user } from '../../../lib/server/schema';

const appOrigin = 'http://localhost:3000';
const provider = new LocalOidcProvider();
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

async function oidcRegistration() {
	provider.useIdentity({
		sub: 'oidc-only-admin',
		email: 'oidc-admin@example.test',
		name: 'OIDC Administrator'
	});
	const start = await postAuth({
		request: request('sign-in/social', 'POST', {
			provider: 'oidc',
			callbackURL: '/',
			disableRedirect: true
		})
	});
	const { url } = await start.json();
	const providerResponse = await fetch(url, { redirect: 'manual' });
	const callbackUrl = providerResponse.headers.get('location');
	if (providerResponse.status !== 302 || !callbackUrl) {
		throw new Error('Local identity provider did not redirect to the OIDC callback.');
	}
	return getAuth({
		request: new Request(callbackUrl, {
			headers: { cookie: updateCookies(undefined, start) }
		})
	});
}

describe('OIDC-only authentication mode', () => {
	beforeAll(async () => {
		await prepareIntegrationDatabase();
		await provider.start();
		process.env.BETTER_AUTH_SECRET = 'password-disabled-test-secret-with-at-least-32-bytes';
		process.env.BETTER_AUTH_URL = appOrigin;
		process.env.PASSWORD_AUTH_ENABLED = 'false';
		process.env.OIDC_ISSUER_URL = provider.issuerUrl;
		process.env.OIDC_CLIENT_ID = 'schtart-test-client';
		process.env.OIDC_CLIENT_SECRET = 'local-test-client-secret';
		delete process.env.REGISTRATION_EMAIL_ALLOWLIST;

		const authRoutes = await import('./[...all]/+server');
		postAuth = authRoutes.POST as typeof postAuth;
		getAuth = authRoutes.GET as typeof getAuth;
	});

	beforeEach(async () => {
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

	it('rejects password signup and login while allowing OIDC first-user setup', async () => {
		const setupPage = await import('../../setup/+page.server');
		expect(await setupPage.load()).toEqual({ passwordEnabled: false, oidcEnabled: true });

		const signup = await postAuth({
			request: request('sign-up/email', 'POST', {
				name: 'Password User',
				username: 'password-user',
				email: 'password@example.test',
				password: 'correct horse battery staple'
			})
		});
		expect(signup.status).toBe(403);
		expect(await signup.json()).toMatchObject({ code: 'PASSWORD_AUTH_DISABLED' });

		const login = await postAuth({
			request: request('sign-in/username', 'POST', {
				username: 'password-user',
				password: 'correct horse battery staple'
			})
		});
		expect(login.status).toBe(403);
		expect(await login.json()).toMatchObject({ code: 'PASSWORD_AUTH_DISABLED' });

		const oidcLogin = await oidcRegistration();
		expect(oidcLogin.status).toBe(302);
		expect(await db.select({ email: user.email, role: user.role }).from(user)).toEqual([
			{ email: 'oidc-admin@example.test', role: 'admin' }
		]);
		expect(await hasAdministrator()).toBe(true);
	});
});
