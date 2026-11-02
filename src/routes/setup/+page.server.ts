import { redirect } from '@sveltejs/kit';
import { authFeatures } from '../../lib/server/auth';
import { hasAdministrator } from '../../lib/server/registration';

export async function load() {
	if (await hasAdministrator()) redirect(303, '/login');
	return authFeatures;
}
