import { redirect } from '@sveltejs/kit';
import { auth } from '../lib/server/auth';
import { hasAdministrator } from '../lib/server/registration';

export async function load({ request }: { request: Request }) {
	if (!(await hasAdministrator())) redirect(303, '/setup');
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) redirect(303, '/login');
	return { user: session.user };
}
