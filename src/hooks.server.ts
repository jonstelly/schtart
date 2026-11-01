import { building } from '$app/env';
import { startScheduler, stopScheduler } from '#lib/server/scheduler';

export function init(): void {
	if (building) return;

	startScheduler();

	// adapter-node emits this after closing its HTTP server for SIGTERM/SIGINT.
	process.once('sveltekit:shutdown', () => {
		void stopScheduler();
	});
}
