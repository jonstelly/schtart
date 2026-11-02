import { json } from '@sveltejs/kit';
import { hasAdministrator } from '../../../../lib/server/registration';

export async function GET() {
	return json({ configured: await hasAdministrator() });
}
