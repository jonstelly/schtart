import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { user } from './schema';

export type UserRole = 'admin' | 'user';

/** Serialize the one-time administrator assignment across concurrent registrations. */
export async function assignInitialAdministrator(userId: string): Promise<UserRole> {
	return db.transaction(async (transaction) => {
		// 0x53434854 is the app-specific "SCHT" lock namespace; 1 identifies bootstrap assignment.
		await transaction.execute(sql`SELECT pg_advisory_xact_lock(1396918356, 1)`);

		const [registeredUser] = await transaction
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (!registeredUser) {
			throw new Error('Cannot assign a role to a user that does not exist.');
		}

		const [administrator] = await transaction
			.select({ id: user.id })
			.from(user)
			.where(eq(user.role, 'admin'))
			.limit(1);

		if (administrator) return registeredUser.role === 'admin' ? 'admin' : 'user';

		const [updatedUser] = await transaction
			.update(user)
			.set({ role: 'admin' })
			.where(eq(user.id, userId))
			.returning({ role: user.role });

		if (!updatedUser) {
			throw new Error('Registered user disappeared during initial administrator assignment.');
		}

		return updatedUser.role === 'admin' ? 'admin' : 'user';
	});
}

export async function hasAdministrator(): Promise<boolean> {
	const [administrator] = await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin')).limit(1);
	return Boolean(administrator);
}
