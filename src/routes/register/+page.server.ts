import { redirect } from '@sveltejs/kit';
import { auth } from '../../lib/server/auth';

export async function load({ request }: { request: Request }) {
	if (await auth.api.getSession({ headers: request.headers })) redirect(303, '/');
	return {};
}
