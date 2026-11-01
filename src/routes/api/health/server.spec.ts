import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('GET /api/health', () => {
	it('reports ok with an ISO timestamp', async () => {
		const body = await GET().json();
		expect(body.status).toBe('ok');
		expect(new Date(body.time).toISOString()).toBe(body.time);
	});
});
