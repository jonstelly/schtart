import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scheduler = vi.hoisted(() => ({
	start: vi.fn(),
	stop: vi.fn().mockResolvedValue(undefined)
}));

const environment = vi.hoisted(() => ({ building: false }));

vi.mock('#lib/server/scheduler', () => ({
	startScheduler: scheduler.start,
	stopScheduler: scheduler.stop
}));

vi.mock('$app/env', () => ({
	get building() {
		return environment.building;
	}
}));

import { init } from './hooks.server';

describe('server lifecycle hook', () => {
	beforeEach(() => {
		environment.building = false;
		scheduler.start.mockClear();
		scheduler.stop.mockClear();
		vi.stubEnv('PASSWORD_AUTH_ENABLED', 'true');
		vi.stubEnv('OIDC_ISSUER_URL', '');
		vi.stubEnv('OIDC_CLIENT_ID', '');
		vi.stubEnv('OIDC_CLIENT_SECRET', '');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('does not start scheduling or register shutdown during a build', () => {
		environment.building = true;
		vi.stubEnv('PASSWORD_AUTH_ENABLED', 'false');
		const registerShutdown = vi.spyOn(process, 'once').mockImplementation(() => process);

		try {
			init();

			expect(scheduler.start).not.toHaveBeenCalled();
			expect(registerShutdown).not.toHaveBeenCalled();
			expect(scheduler.stop).not.toHaveBeenCalled();
		} finally {
			registerShutdown.mockRestore();
		}
	});

	it('rejects startup when password auth is disabled and no OIDC provider is configured', () => {
		vi.stubEnv('PASSWORD_AUTH_ENABLED', 'false');

		expect(() => init()).toThrow(/No authentication method is enabled/);
		expect(scheduler.start).not.toHaveBeenCalled();
	});

	it('rejects startup for incomplete OIDC settings before starting the runtime', () => {
		vi.stubEnv('OIDC_ISSUER_URL', 'https://identity.example.test');

		expect(() => init()).toThrow(/OIDC configuration is incomplete/);
		expect(scheduler.start).not.toHaveBeenCalled();
	});

	it('starts scheduling at server initialization and stops it on adapter-node shutdown', () => {
		environment.building = false;
		const listenersBefore = process.listeners('sveltekit:shutdown');
		init();
		const shutdownListener = process
			.listeners('sveltekit:shutdown')
			.find((listener) => !listenersBefore.includes(listener));
		if (!shutdownListener) {
			throw new Error('Expected the lifecycle hook to register shutdown handling.');
		}
		shutdownListener.call(process);
		process.removeListener('sveltekit:shutdown', shutdownListener);

		expect(scheduler.start).toHaveBeenCalledOnce();
		expect(scheduler.stop).toHaveBeenCalledOnce();
	});
});
