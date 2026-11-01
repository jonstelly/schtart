import { startScheduler, stopScheduler } from '#lib/server/scheduler';

export function init(): void {
	startScheduler();

	// adapter-node emits this after closing its HTTP server for SIGTERM/SIGINT.
	process.once('sveltekit:shutdown', () => {
		void stopScheduler();
	});
}
