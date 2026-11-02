import { redirect } from '@sveltejs/kit';
import { auth, authFeatures } from '../lib/server/auth';
import { hasAdministrator } from '../lib/server/registration';
import { getEffectiveDashboardConfiguration } from '../lib/server/dashboard-configuration-store';

export async function load({ request }: { request: Request }) {
	if (!(await hasAdministrator())) redirect(303, '/setup');
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) redirect(303, '/login');
	return {
		user: session.user,
		oidcEnabled: authFeatures.oidcEnabled,
		isAdministrator: session.user.role === 'admin',
		dashboardConfiguration: await getEffectiveDashboardConfiguration(session.user.id)
	};
}
