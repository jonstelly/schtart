import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	closeIntegrationDatabase,
	prepareIntegrationDatabase,
	resetIntegrationDatabase
} from '../../../../../tests/integration/database';
import { GET as getAuth, POST as postAuth } from './+server';
import { GET as getSetupStatus } from '../../setup/status/+server';
import { GET as getAccount } from '../../account/+server';
import { GET as getAdminStatus } from '../../admin/status/+server';
import { db } from '../../../../lib/server/db';
import { hasAdministrator } from '../../../../lib/server/registration';
import { sql } from 'drizzle-orm';
import { user } from '../../../../lib/server/schema';

const requestEvent = (request: Request) => ({ request }) as Parameters<typeof postAuth>[0];
const origin = 'http://localhost:3000';

function authRequest(path: string, method: 'GET' | 'POST', body?: object, cookie?: string) {
	return new Request(`${origin}/api/auth/${path}`, {
		method,
		headers: {
			...(method === 'POST' ? { origin } : {}),
			...(body ? { 'content-type': 'application/json' } : {}),
			...(cookie ? { cookie } : {})
		},
		...(body ? { body: JSON.stringify(body) } : {})
	});
}

async function signUp(username: string, email: string, extraFields: Record<string, unknown> = {}) {
	return postAuth(
		requestEvent(
			authRequest('sign-up/email', 'POST', {
				name: username,
				username,
				email,
				password: 'correct horse battery staple',
				...extraFields
			})
		)
	);
}

function sessionCookie(response: Response) {
	return response.headers
		.getSetCookie()
		.find((value) => value.includes('session_token='))
		?.split(';', 1)[0];
}

async function failAuthPersistenceOnInsert(table: 'account' | 'session') {
	const functionName = `reject_${table}_insert`;
	const triggerName = `reject_${table}_insert`;
	await db.execute(
			sql.raw(
				`CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated ${table} persistence failure'; RETURN NEW; END; $$`
			)
	);
	await db.execute(
		sql.raw(
			`CREATE TRIGGER ${triggerName} BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION ${functionName}()`
		)
	);
	return async () => {
		await db.execute(sql.raw(`DROP TRIGGER ${triggerName} ON "${table}"`));
		await db.execute(sql.raw(`DROP FUNCTION ${functionName}()`));
	};
}

async function expectFailedSignupLeavesInstanceUnclaimed() {
	const response = await signUp('ada', 'ada@example.test');
	expect(response.status).not.toBe(200);
	expect(await db.select({ id: user.id }).from(user)).toEqual([]);
	expect(await hasAdministrator()).toBe(false);
}

describe('password registration', () => {
	beforeAll(prepareIntegrationDatabase);
	beforeEach(async () => {
		delete process.env.REGISTRATION_EMAIL_ALLOWLIST;
		await resetIntegrationDatabase();
	});
	afterAll(closeIntegrationDatabase);
	afterEach(() => {
		delete process.env.REGISTRATION_EMAIL_ALLOWLIST;
	});

	it('completes first-user setup after a valid email and password signup', async () => {
		const response = await signUp('ada', 'ada@example.test');

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ user: { email: 'ada@example.test' } });

		const status = await getSetupStatus();
		expect(await status.json()).toEqual({ configured: true });
	});

	it('does not promote a user when credential persistence fails', async () => {
		const removeFailure = await failAuthPersistenceOnInsert('account');
		try {
			await expectFailedSignupLeavesInstanceUnclaimed();
		} finally {
			await removeFailure();
		}
	});

	it('does not promote a user when session persistence fails', async () => {
		const removeFailure = await failAuthPersistenceOnInsert('session');
		try {
			await expectFailedSignupLeavesInstanceUnclaimed();
		} finally {
			await removeFailure();
		}
	});

	it('requires a username for password registration', async () => {
		const response = await postAuth(
			requestEvent(
				authRequest('sign-up/email', 'POST', {
					name: 'Ada',
					email: 'ada@example.test',
					password: 'correct horse battery staple'
				})
			)
		);

		expect(response.status).toBe(400);
	});

	it('supports username login, authenticated and administrator routes, and logout', async () => {
		await signUp('ada', 'ada@example.test');
		const login = await postAuth(
			requestEvent(
				authRequest('sign-in/username', 'POST', {
					username: 'ada',
					password: 'correct horse battery staple'
				})
			)
		);
		expect(login.status).toBe(200);
		const cookie = sessionCookie(login);
		expect(cookie).toBeDefined();
		const session = await getAuth(requestEvent(authRequest('get-session', 'GET', undefined, cookie)));
		expect(await session.json()).toMatchObject({ user: { email: 'ada@example.test', role: 'admin' } });

		const account = await getAccount({ request: authRequest('unused', 'GET', undefined, cookie) });
		expect(account.status).toBe(200);
		expect(await account.json()).toMatchObject({ email: 'ada@example.test', role: 'admin' });

		const adminStatus = await getAdminStatus({
			request: authRequest('unused', 'GET', undefined, cookie)
		});
		expect(adminStatus.status).toBe(200);

		const logout = await postAuth(
			requestEvent(authRequest('sign-out', 'POST', {}, cookie))
		);
		expect(logout.status).toBe(200);

		await expect(
			getAccount({ request: authRequest('unused', 'GET', undefined, cookie) })
		).rejects.toMatchObject({ status: 401 });
	});

	it('keeps later registrations ordinary users and blocks them from administrator routes', async () => {
		const firstSignup = await signUp('ada', 'ada@example.test');
		const firstUserId = (await firstSignup.json()).user.id;
		const secondSignup = await signUp('grace', 'grace@example.test', { role: 'admin' });
		const cookie = sessionCookie(secondSignup);
		expect(cookie).toBeDefined();
		if (!cookie) throw new Error('Registration did not issue a session cookie.');

		const account = await getAccount({
			request: new Request(`${origin}/api/account?userId=${firstUserId}`, { headers: { cookie } })
		});
		expect(account.status).toBe(200);
		const accountInfo = await account.json();
		expect(accountInfo).toMatchObject({ email: 'grace@example.test', role: 'user' });
		expect(JSON.stringify(accountInfo)).not.toContain('ada@example.test');

		await expect(
			getAdminStatus({ request: authRequest('unused', 'GET', undefined, cookie) })
		).rejects.toMatchObject({ status: 403 });
	});

	it('assigns administrator access to exactly one concurrently registered user', async () => {
		const usernames = Array.from({ length: 12 }, (_, index) => `racer${index}`);
		const roles = await Promise.all(
			usernames.map(async (username) => {
				const registration = await signUp(username, `${username}@example.test`);
				expect(registration.status).toBe(200);
				const cookie = sessionCookie(registration);
				expect(cookie).toBeDefined();

				try {
					await getAdminStatus({ request: authRequest('unused', 'GET', undefined, cookie) });
					return 'admin';
				} catch (error) {
					if (error && typeof error === 'object' && 'status' in error && error.status === 403) {
						return 'user';
					}
					throw error;
				}
			})
		);

		expect(roles.filter((role) => role === 'admin')).toHaveLength(1);
		expect(roles.filter((role) => role === 'user')).toHaveLength(11);
	});

	it('applies the email allowlist to registration but not existing-user login', async () => {
		await signUp('ada', 'ada@example.test');
		process.env.REGISTRATION_EMAIL_ALLOWLIST = 'allowed@example.test';

		const denied = await signUp('grace', 'grace@example.test');
		expect(denied.status).toBe(403);

		const existingUserLogin = await postAuth(
			requestEvent(
				authRequest('sign-in/username', 'POST', {
					username: 'ada',
					password: 'correct horse battery staple'
				})
			)
		);
		expect(existingUserLogin.status).toBe(200);
	});

	it('allows a normalized email present in the registration allowlist', async () => {
		process.env.REGISTRATION_EMAIL_ALLOWLIST = ' Allowed@Example.Test ';

		const registration = await signUp('ada', 'Allowed@Example.Test');
		expect(registration.status).toBe(200);
	});

	it('requires a session for user routes', async () => {
		await expect(getAccount({ request: authRequest('unused', 'GET') })).rejects.toMatchObject({
			status: 401
		});
	});
});
