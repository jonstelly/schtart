import { describe, expect, it, vi } from 'vitest';

const scheduler = vi.hoisted(() => ({
	start: vi.fn(),
	stop: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('#lib/server/scheduler', () => ({
	startScheduler: scheduler.start,
	stopScheduler: scheduler.stop
}));

import { init } from './hooks.server';

describe('server lifecycle hook', () => {
	it('starts scheduling at server initialization and stops it on adapter-node shutdown', () => {
		init();
		process.emit('sveltekit:shutdown');

		expect(scheduler.start).toHaveBeenCalledOnce();
		expect(scheduler.stop).toHaveBeenCalledOnce();
	});
});
