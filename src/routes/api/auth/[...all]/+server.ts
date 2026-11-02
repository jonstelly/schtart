import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import { auth, authFeatures } from '../../../../lib/server/auth';

const handler = toSvelteKitHandler(auth);

async function handle(event: Parameters<typeof handler>[0]) {
	const path = new URL(event.request.url).pathname;
	if (
		!authFeatures.passwordEnabled &&
		event.request.method === 'POST' &&
		(path.endsWith('/sign-up/email') || path.endsWith('/sign-in/username'))
	) {
		return Response.json(
			{ code: 'PASSWORD_AUTH_DISABLED', message: 'Password authentication is disabled.' },
			{ status: 403 }
		);
	}
	return handler(event);
}

export const GET = handle;
export const POST = handle;
