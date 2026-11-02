import { expect, test as base } from '@playwright/test';
import { startBrowserApp, type BrowserAuthMode } from './test-server';

export const test = base.extend<{ authMode: BrowserAuthMode; browserApp: void }>({
	authMode: ['dual', { option: true }],
	browserApp: [
		async ({ authMode }, use) => {
			const app = await startBrowserApp(authMode);
			try {
				await use();
			} finally {
				await app.stop();
			}
		},
		{ auto: true }
	]
});

export { expect };
