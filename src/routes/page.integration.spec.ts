import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	closeIntegrationDatabase,
	prepareIntegrationDatabase,
	resetIntegrationDatabase
} from '../../tests/integration/database';
import { db } from '../lib/server/db';
import { DEFAULT_DASHBOARD_YAML } from '../lib/server/dashboard-default';
import { dashboardServerDefault } from '../lib/server/schema';
import { POST as postAuth } from './api/auth/[...all]/+server';
import { PUT as putUserConfiguration } from './api/configuration/+server';
import { load } from './+page.server';

const origin = 'http://localhost:3000';
const userOverrideYaml = `version: 1
pages:
  home: { columns: [[{ widget: system-status }]] }
  news: { columns: [[{ widget: news-headlines }]] }
  sports: { columns: [[{ widget: sports-scores, league: NBA }]] }
  monitoring: { columns: [[{ widget: welcome }]] }
`;
const updatedDefaultYaml = `version: 1
pages:
  home: { columns: [[{ widget: news-headlines, count: 1 }]] }
  news: { columns: [[{ widget: welcome }]] }
  sports: { columns: [[{ widget: system-status }]] }
  monitoring: { columns: [[{ widget: sports-scores, league: MLB }]] }
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

describe('authenticated dashboard page data', () => {
	beforeAll(prepareIntegrationDatabase);
	beforeEach(resetIntegrationDatabase);
	afterAll(closeIntegrationDatabase);

	it('renders the effective configuration for each user and keeps default followers current', async () => {
		const ada = await signUp('ada');
		const grace = await signUp('grace');

		const adaInitial = await load({ request: request('/', ada) });
		const graceInitial = await load({ request: request('/', grace) });
		expect(adaInitial.dashboardConfiguration).toMatchObject({
			yaml: DEFAULT_DASHBOARD_YAML,
			source: 'default'
		});
		expect(graceInitial.dashboardConfiguration).toEqual(adaInitial.dashboardConfiguration);

		await db.update(dashboardServerDefault).set({ yaml: updatedDefaultYaml });
		const savedOverride = await putUserConfiguration({
			request: request('/api/configuration', ada, JSON.stringify({ yaml: userOverrideYaml }), 'PUT')
		} as Parameters<typeof putUserConfiguration>[0]);
		expect(savedOverride.status).toBe(200);

		const adaAfterEdit = await load({ request: request('/', ada) });
		const graceAfterEdit = await load({ request: request('/', grace) });
		expect(adaAfterEdit.dashboardConfiguration).toMatchObject({
			yaml: userOverrideYaml,
			source: 'user'
		});
		expect(graceAfterEdit.dashboardConfiguration).toMatchObject({
			yaml: updatedDefaultYaml,
			source: 'default'
		});
	});
});
