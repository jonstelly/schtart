import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	closeIntegrationDatabase,
	prepareIntegrationDatabase,
	resetIntegrationDatabase
} from '../../../../../tests/integration/database';
import { DELETE as deleteUserConfiguration, GET as getUserConfiguration, PUT as putUserConfiguration } from '../../configuration/+server';
import { POST as postAuth } from '../../auth/[...all]/+server';
import { DEFAULT_DASHBOARD_YAML } from '../../../../lib/server/dashboard-default';
import { GET, PUT } from './+server';

const origin = 'http://localhost:3000';
const updatedDefaultYaml = `version: 1
pages:
  home: { columns: [[{ widget: news-headlines, count: 2 }]] }
  news: { columns: [[{ widget: welcome }]] }
  sports: { columns: [[{ widget: sports-scores, league: NBA }]] }
  monitoring: { columns: [[{ widget: system-status }]] }
`;
const latestDefaultYaml = `version: 1
pages:
  home: { columns: [[{ widget: sports-scores, league: NHL }]] }
  news: { columns: [[{ widget: news-headlines, count: 3 }]] }
  sports: { columns: [[{ widget: welcome }]] }
  monitoring: { columns: [[{ widget: system-status }]] }
`;
const userOverrideYaml = `version: 1
pages:
  home: { columns: [[{ widget: system-status }]] }
  news: { columns: [[{ widget: welcome }]] }
  sports: { columns: [[{ widget: news-headlines, count: 1 }]] }
  monitoring: { columns: [[{ widget: sports-scores, league: MLB }]] }
`;

const adminRouteEvent = (request: Request) => ({ request }) as Parameters<typeof GET>[0];
const userRouteEvent = (request: Request) => ({ request }) as Parameters<typeof getUserConfiguration>[0];

function request(path: string, cookie?: string, yaml?: string, method = 'GET') {
	return new Request(`${origin}${path}`, {
		method,
		headers: {
			...(cookie ? { cookie } : {}),
			...(yaml !== undefined ? { 'content-type': 'application/json' } : {})
		},
		...(yaml !== undefined ? { body: JSON.stringify({ yaml }) } : {})
	});
}

async function signUp(username: string) {
	const signupRequest = new Request(`${origin}/api/auth/sign-up/email`, {
		method: 'POST',
		headers: { origin, 'content-type': 'application/json' },
		body: JSON.stringify({
			name: username,
			username,
			email: `${username}@example.test`,
			password: 'correct horse battery staple'
		})
	});
	const response = await postAuth({ request: signupRequest } as Parameters<typeof postAuth>[0]);
	expect(response.status).toBe(200);
	const cookie = response.headers.getSetCookie().find((value) => value.includes('session_token='));
	if (!cookie) throw new Error('Registration did not issue a session cookie.');
	return cookie.split(';', 1)[0];
}

describe('administrator default dashboard configuration routes', () => {
	beforeAll(prepareIntegrationDatabase);
	beforeEach(resetIntegrationDatabase);
	afterAll(closeIntegrationDatabase);

	it('denies unauthenticated and ordinary-user reads and writes', async () => {
		await expect(GET(adminRouteEvent(request('/api/admin/default-configuration')))).rejects.toMatchObject({ status: 401 });
		await expect(
			PUT(adminRouteEvent(request('/api/admin/default-configuration', undefined, updatedDefaultYaml, 'PUT')))
		).rejects.toMatchObject({ status: 401 });

		await signUp('ada');
		const ordinaryUser = await signUp('grace');
		await expect(
			GET(adminRouteEvent(request('/api/admin/default-configuration', ordinaryUser)))
		).rejects.toMatchObject({ status: 403 });
		await expect(
			PUT(adminRouteEvent(request('/api/admin/default-configuration', ordinaryUser, updatedDefaultYaml, 'PUT')))
		).rejects.toMatchObject({ status: 403 });
	});

	it('reads and saves validated defaults, rejecting invalid edits without replacing the saved value', async () => {
		const administrator = await signUp('ada');
		const initial = await GET(adminRouteEvent(request('/api/admin/default-configuration', administrator)));
		expect(initial.status).toBe(200);
		expect(initial.headers.get('cache-control')).toBe('private, no-store');
		expect(await initial.json()).toMatchObject({ yaml: DEFAULT_DASHBOARD_YAML, source: 'default' });

		const saved = await PUT(
			adminRouteEvent(request('/api/admin/default-configuration', administrator, updatedDefaultYaml, 'PUT'))
		);
		expect(saved.status).toBe(200);
		expect(await saved.json()).toMatchObject({ yaml: updatedDefaultYaml, source: 'default' });

		const invalid = await PUT(
				adminRouteEvent(request('/api/admin/default-configuration', administrator, `${updatedDefaultYaml}\nunknown: true`, 'PUT'))
		);
		expect(invalid.status).toBe(400);
		expect(await invalid.json()).toMatchObject({ errors: expect.any(Array) });

		const unchanged = await GET(adminRouteEvent(request('/api/admin/default-configuration', administrator)));
		expect(await unchanged.json()).toMatchObject({ yaml: updatedDefaultYaml, source: 'default' });
	});

	it('keeps defaults seeded only when absent and gives followers the latest default without changing overrides', async () => {
		const administrator = await signUp('ada');
		const follower = await signUp('grace');
		const overridingUser = await signUp('linus');

		await PUT(adminRouteEvent(request('/api/admin/default-configuration', administrator, updatedDefaultYaml, 'PUT')));
		const seededAgain = await GET(adminRouteEvent(request('/api/admin/default-configuration', administrator)));
		expect(await seededAgain.json()).toMatchObject({ yaml: updatedDefaultYaml, source: 'default' });
		const followingSavedDefault = await getUserConfiguration(userRouteEvent(request('/api/configuration', follower)));
		expect(await followingSavedDefault.json()).toMatchObject({ yaml: updatedDefaultYaml, source: 'default' });

		const override = await putUserConfiguration(
			userRouteEvent(request('/api/configuration', overridingUser, userOverrideYaml, 'PUT'))
		);
		expect(override.status).toBe(200);

		await PUT(adminRouteEvent(request('/api/admin/default-configuration', administrator, latestDefaultYaml, 'PUT')));
		const followerAfterEdit = await getUserConfiguration(userRouteEvent(request('/api/configuration', follower)));
		expect(await followerAfterEdit.json()).toMatchObject({ yaml: latestDefaultYaml, source: 'default' });
		const overrideAfterEdit = await getUserConfiguration(userRouteEvent(request('/api/configuration', overridingUser)));
		expect(await overrideAfterEdit.json()).toMatchObject({ yaml: userOverrideYaml, source: 'user' });

		const reset = await deleteUserConfiguration(userRouteEvent(request('/api/configuration', overridingUser, undefined, 'DELETE')));
		expect(await reset.json()).toMatchObject({ yaml: latestDefaultYaml, source: 'default' });
	});
});
