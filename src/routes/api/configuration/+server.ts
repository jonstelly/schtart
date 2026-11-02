import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthenticatedUser } from '../../../lib/server/authorization';
import {
	getEffectiveDashboardConfiguration,
	resetUserDashboardConfiguration,
	saveUserDashboardConfiguration
} from '../../../lib/server/dashboard-configuration-store';
import { validateDashboardConfiguration } from '../../../lib/server/dashboard-configuration';

const MAX_REQUEST_LENGTH = 64_000;

function privateJson(body: unknown, status = 200) {
	return json(body, { status, headers: { 'cache-control': 'private, no-store' } });
}

export const GET: RequestHandler = async ({ request }) => {
	const { user } = await requireAuthenticatedUser(request.headers);
	return privateJson(await getEffectiveDashboardConfiguration(user.id));
};

export const PUT: RequestHandler = async ({ request }) => {
	const { user } = await requireAuthenticatedUser(request.headers);
	const requestText = await request.text();
	if (requestText.length > MAX_REQUEST_LENGTH) {
		return privateJson({ errors: ['Request body is too large.'] }, 413);
	}

	let body: unknown;
	try {
		body = JSON.parse(requestText);
	} catch {
		return privateJson({ errors: ['Request body must be valid JSON.'] }, 400);
	}

	if (
		!body ||
		typeof body !== 'object' ||
		Array.isArray(body) ||
		Object.keys(body).length !== 1 ||
		typeof (body as { yaml?: unknown }).yaml !== 'string'
	) {
		return privateJson({ errors: ['Request body must contain only a YAML string in the "yaml" field.'] }, 400);
	}

	const yaml = (body as { yaml: string }).yaml;
	const validation = validateDashboardConfiguration(yaml);
	if (!validation.success) {
		return privateJson({ message: 'Dashboard configuration is invalid.', errors: validation.errors }, 400);
	}

	return privateJson(await saveUserDashboardConfiguration(user.id, yaml));
};

export const DELETE: RequestHandler = async ({ request }) => {
	const { user } = await requireAuthenticatedUser(request.headers);
	return privateJson(await resetUserDashboardConfiguration(user.id));
};
