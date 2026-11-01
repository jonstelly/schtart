import { json } from '@sveltejs/kit';
import { requireAdministrator } from '../../../../lib/server/authorization';

export async function GET({ request }: { request: Request }) {
	await requireAdministrator(request.headers);
	return json({ role: 'admin' });
}
