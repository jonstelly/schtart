import { redirect } from '@sveltejs/kit';
import { hasAdministrator } from '../../lib/server/registration';

export async function load() {
	if (await hasAdministrator()) redirect(303, '/login');
	return {};
}
