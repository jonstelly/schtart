import { beforeEach, describe, expect, it, vi } from 'vitest';

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
	});

	it('does not start scheduling or register shutdown during a build', () => {
		environment.building = true;
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

	it('starts scheduling at server initialization and stops it on adapter-node shutdown', () => {
		environment.building = false;
		init();
		process.emit('sveltekit:shutdown');

		expect(scheduler.start).toHaveBeenCalledOnce();
		expect(scheduler.stop).toHaveBeenCalledOnce();
	});
});
