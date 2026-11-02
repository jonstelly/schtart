import { building } from '$app/env';
import { validateAuthConfiguration } from '#lib/server/auth-config';
import { startScheduler, stopScheduler } from '#lib/server/scheduler';

export function init(): void {
	if (building) return;

	validateAuthConfiguration(process.env);
	startScheduler();

	// adapter-node emits this after closing its HTTP server for SIGTERM/SIGINT.
	process.once('sveltekit:shutdown', () => {
		void stopScheduler();
	});
}
