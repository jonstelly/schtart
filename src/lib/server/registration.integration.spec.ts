import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	closeIntegrationDatabase,
	prepareIntegrationDatabase,
	resetIntegrationDatabase
} from '../../../tests/integration/database';
import { db } from './db';
import { assignInitialAdministrator, hasAdministrator } from './registration';
import { user } from './schema';

function pendingUser(id: string) {
	const now = new Date();
	return {
		id,
		name: id,
		email: `${id}@example.test`,
		username: id,
		createdAt: now,
		updatedAt: now
	};
}

describe('initial administrator registration service', () => {
	beforeAll(prepareIntegrationDatabase);
	beforeEach(resetIntegrationDatabase);
	afterAll(closeIntegrationDatabase);

	it('persists exactly one administrator when first registrations race', async () => {
		const ids = Array.from({ length: 12 }, (_, index) => `racer${index}`);
		await db.insert(user).values(ids.map(pendingUser));

		const assignments = await Promise.all(ids.map(assignInitialAdministrator));

		expect(assignments.filter((role) => role === 'admin')).toHaveLength(1);
		expect(assignments.filter((role) => role === 'user')).toHaveLength(11);
		expect(await hasAdministrator()).toBe(true);

		await db.insert(user).values(pendingUser('latecomer'));
		expect(await assignInitialAdministrator('latecomer')).toBe('user');
	});
});
