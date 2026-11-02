import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	closeIntegrationDatabase,
	prepareIntegrationDatabase,
	resetIntegrationDatabase
} from '../../../../tests/integration/database';
import { POST as postAuth } from '../auth/[...all]/+server';
import { db } from '../../../lib/server/db';
import { dashboardServerDefault } from '../../../lib/server/schema';
import { DEFAULT_DASHBOARD_YAML } from '../../../lib/server/dashboard-default';
import { DELETE, GET, PUT } from './+server';

const origin = 'http://localhost:3000';
const defaultYaml = `version: 1
pages:
  home: { columns: [[{ widget: welcome }]] }
  news: { columns: [[{ widget: news-headlines }]] }
  sports: { columns: [[{ widget: sports-scores }]] }
  monitoring: { columns: [[{ widget: system-status }]] }
`;

const routeEvent = (request: Request) => ({ request }) as Parameters<typeof GET>[0];
const replacementYaml = `version: 1
pages:
  home: { columns: [[{ widget: news-headlines, count: 1 }]] }
  news: { columns: [[{ widget: welcome }]] }
  sports: { columns: [[{ widget: sports-scores, league: NBA }]] }
  monitoring: { columns: [[{ widget: system-status }]] }
`;

function request(path: string, cookie?: string, body?: string, method = 'GET') {
	return new Request(`${origin}${path}`, {
		method,
		headers: {
			...(cookie ? { cookie } : {}),
			...(body ? { 'content-type': 'application/json' } : {})
		},
		...(body ? { body } : {})
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

describe('authenticated dashboard configuration routes', () => {
	beforeAll(prepareIntegrationDatabase);
	beforeEach(resetIntegrationDatabase);
	afterAll(closeIntegrationDatabase);

	it('returns the seeded server default and requires authentication for every operation', async () => {
		await expect(GET(routeEvent(request('/api/configuration')))).rejects.toMatchObject({ status: 401 });
		await expect(
			PUT(routeEvent(request('/api/configuration', undefined, JSON.stringify({ yaml: defaultYaml }), 'PUT')))
		).rejects.toMatchObject({ status: 401 });
		await expect(DELETE(routeEvent(request('/api/configuration', undefined, undefined, 'DELETE')))).rejects.toMatchObject({ status: 401 });

		const cookie = await signUp('ada');
		const response = await GET(routeEvent(request('/api/configuration', cookie)));

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		const firstRead = await response.json();
		expect(firstRead).toMatchObject({
			yaml: DEFAULT_DASHBOARD_YAML,
			source: 'default',
			configuration: { version: 1 }
		});
		const secondRead = await GET(routeEvent(request('/api/configuration', cookie)));
		expect(await secondRead.json()).toEqual(firstRead);
	});

	it('keeps defaults for followers, saves a complete private replacement, and resets to the current default', async () => {
		const ada = await signUp('ada');
		const grace = await signUp('grace');
		const adaDefault = await GET(routeEvent(request('/api/configuration', ada)));
		const originalDefault = await adaDefault.json();
		const graceDefault = await GET(routeEvent(request('/api/configuration', grace)));
		expect(await graceDefault.json()).toEqual(originalDefault);

		await db.update(dashboardServerDefault).set({ yaml: defaultYaml });
		const graceFollowingCurrentDefault = await GET(routeEvent(request('/api/configuration', grace)));
		const currentDefault = await graceFollowingCurrentDefault.json();
		expect(currentDefault).toMatchObject({ yaml: defaultYaml, source: 'default' });

		const save = await PUT(
			routeEvent(request('/api/configuration', ada, JSON.stringify({ yaml: replacementYaml }), 'PUT'))
		);
		expect(save.status).toBe(200);
		expect(await save.json()).toMatchObject({ yaml: replacementYaml, source: 'user' });

		const adaSaved = await GET(routeEvent(request('/api/configuration', ada)));
		expect(await adaSaved.json()).toMatchObject({ yaml: replacementYaml, source: 'user' });
		const graceStillFollows = await GET(routeEvent(request('/api/configuration', grace)));
		expect(await graceStillFollows.json()).toEqual(currentDefault);

		const reset = await DELETE(routeEvent(request('/api/configuration', ada, undefined, 'DELETE')));
		expect(await reset.json()).toEqual(currentDefault);
	});

	it('rejects invalid saves without replacing the previous override', async () => {
		const cookie = await signUp('ada');
		await PUT(routeEvent(request('/api/configuration', cookie, JSON.stringify({ yaml: replacementYaml }), 'PUT')));

		const invalid = await PUT(
			routeEvent(request('/api/configuration', cookie, JSON.stringify({ yaml: `${replacementYaml}\nunknown: true` }), 'PUT'))
		);
		expect(invalid.status).toBe(400);
		expect(await invalid.json()).toMatchObject({ errors: expect.any(Array) });

		const saved = await GET(routeEvent(request('/api/configuration', cookie)));
		expect(await saved.json()).toMatchObject({ yaml: replacementYaml, source: 'user' });
	});

	it('preserves an existing server default instead of reseeding it', async () => {
		const cookie = await signUp('ada');
		const customDefault = { yaml: defaultYaml, source: 'default' };
		await db.insert(dashboardServerDefault).values({ id: 1, yaml: defaultYaml });

		const later = await GET(routeEvent(request('/api/configuration', cookie)));
		expect(await later.json()).toMatchObject(customDefault);
	});
});
