import { json } from '@sveltejs/kit';
import { requireAuthenticatedUser } from '../../../lib/server/authorization';

export async function GET({ request }: { request: Request }) {
	const { user } = await requireAuthenticatedUser(request.headers);
	return json({ id: user.id, email: user.email, username: user.username, role: user.role });
}
