import { redirect } from '@sveltejs/kit';
import { auth } from '../../lib/server/auth';
import { hasAdministrator } from '../../lib/server/registration';

export async function load({ request }: { request: Request }) {
	if (!(await hasAdministrator())) redirect(303, '/setup');
	if (await auth.api.getSession({ headers: request.headers })) redirect(303, '/');
	return {};
}
