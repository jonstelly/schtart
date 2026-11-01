import { eq } from 'drizzle-orm';
import { DEFAULT_DASHBOARD_YAML } from './dashboard-default';
import { db } from './db';
import { dashboardServerDefault, dashboardUserConfiguration } from './schema';
import type { EffectiveDashboardConfiguration } from '../dashboard';
import { validateDashboardConfiguration } from './dashboard-configuration';

/** Idempotently seed the shared default without replacing a configured value. */
export async function ensureDashboardServerDefault() {
	await db
		.insert(dashboardServerDefault)
		.values({ id: 1, yaml: DEFAULT_DASHBOARD_YAML })
		.onConflictDoNothing({ target: dashboardServerDefault.id });

	const [serverDefault] = await db
		.select({ yaml: dashboardServerDefault.yaml })
		.from(dashboardServerDefault)
		.where(eq(dashboardServerDefault.id, 1))
		.limit(1);
	if (!serverDefault) throw new Error('The dashboard server default could not be initialized.');
	return serverDefault.yaml;
}

export async function getEffectiveDashboardConfiguration(userId: string): Promise<EffectiveDashboardConfiguration> {
	const defaultYaml = await ensureDashboardServerDefault();
	const [override] = await db
		.select({ yaml: dashboardUserConfiguration.yaml })
		.from(dashboardUserConfiguration)
		.where(eq(dashboardUserConfiguration.userId, userId))
		.limit(1);
	const yaml = override?.yaml ?? defaultYaml;
	const validation = validateDashboardConfiguration(yaml);
	if (!validation.success) {
		throw new Error(`Stored dashboard configuration is invalid: ${validation.errors.join('; ')}`);
	}
	return {
		yaml,
		source: override ? 'user' : 'default',
		configuration: validation.configuration
	};
}

export async function saveUserDashboardConfiguration(userId: string, yaml: string) {
	const validation = validateDashboardConfiguration(yaml);
	if (!validation.success) throw new Error('Cannot save an invalid dashboard configuration.');

	await ensureDashboardServerDefault();
	await db
		.insert(dashboardUserConfiguration)
		.values({ userId, yaml })
		.onConflictDoUpdate({
			target: dashboardUserConfiguration.userId,
			set: { yaml, updatedAt: new Date() }
		});
	return { yaml, source: 'user' as const, configuration: validation.configuration };
}

export async function resetUserDashboardConfiguration(userId: string) {
	const yaml = await ensureDashboardServerDefault();
	const validation = validateDashboardConfiguration(yaml);
	if (!validation.success) {
		throw new Error(`Stored dashboard configuration is invalid: ${validation.errors.join('; ')}`);
	}
	await db
		.delete(dashboardUserConfiguration)
		.where(eq(dashboardUserConfiguration.userId, userId));
	return { yaml, source: 'default' as const, configuration: validation.configuration };
}
