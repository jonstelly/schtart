import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	closeIntegrationDatabase,
	prepareIntegrationDatabase,
	resetIntegrationDatabase
} from '../../../../../tests/integration/database';
import { GET } from './+server';

describe('GET /api/setup/status', () => {
	beforeAll(prepareIntegrationDatabase);
	beforeEach(resetIntegrationDatabase);
	afterAll(closeIntegrationDatabase);

	it('reports when the instance has not yet been claimed', async () => {
		const response = await GET();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ configured: false });
	});
});
