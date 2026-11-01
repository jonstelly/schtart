import { error } from '@sveltejs/kit';
import { auth } from './auth';

export async function requireAuthenticatedUser(headers: Headers) {
	const session = await auth.api.getSession({ headers });
	if (!session) error(401, 'Authentication required.');
	return session;
}

export async function requireAdministrator(headers: Headers) {
	const session = await requireAuthenticatedUser(headers);
	if (session.user.role !== 'admin') error(403, 'Administrator access required.');
	return session;
}
