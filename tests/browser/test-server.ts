import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { prepareTestDatabase } from '../../scripts/prepare-test-database.mjs';
import { LocalOidcProvider } from '../integration/local-oidc-provider';

const appOrigin = 'http://127.0.0.1:4173';

export type BrowserAuthMode = 'dual' | 'password-only' | 'oidc-only';

async function stopApp(app: ChildProcess) {
	if (app.exitCode !== null || app.signalCode !== null) return;
	const exited = new Promise<void>((resolve) => app.once('exit', () => resolve()));
	app.kill('SIGTERM');
	const forcedStop = setTimeout(() => app.kill('SIGKILL'), 15_000);
	forcedStop.unref();
	await exited;
	clearTimeout(forcedStop);
}

export async function startBrowserApp(mode: BrowserAuthMode) {
	const databaseUrl = await prepareTestDatabase(process.env.TEST_DATABASE_URL);
	const provider = mode === 'password-only' ? undefined : new LocalOidcProvider();
	if (provider) {
		await provider.start();
		provider.useIdentity({
			sub: mode === 'dual' ? 'browser-user' : 'oidc-only-user',
			email: mode === 'dual' ? 'browser-user@example.test' : 'oidc-only-user@example.test',
			name: mode === 'dual' ? 'Browser User' : 'OIDC Only User'
		});
	}

	const app = spawn(process.execPath, ['build'], {
		stdio: 'inherit',
		env: {
			...process.env,
			NODE_ENV: 'production',
			HOST: '127.0.0.1',
			PORT: '4173',
			DATABASE_URL: databaseUrl,
			BETTER_AUTH_URL: appOrigin,
			BETTER_AUTH_SECRET: 'playwright-only-not-a-deployment-secret-0123456789',
			PASSWORD_AUTH_ENABLED: mode === 'oidc-only' ? 'false' : 'true',
			REGISTRATION_EMAIL_ALLOWLIST: '',
			OIDC_ISSUER_URL: provider?.issuerUrl ?? '',
			OIDC_CLIENT_ID: provider ? 'schtart-test-client' : '',
			OIDC_CLIENT_SECRET: provider ? 'local-test-client-secret' : ''
		}
	});

	try {
		let ready = false;
		for (let attempt = 0; attempt < 60; attempt += 1) {
			if (app.exitCode !== null) {
				throw new Error(`Built Schtart server exited with code ${app.exitCode}.`);
			}
			try {
				const response = await fetch(`${appOrigin}/api/health`);
				if (response.ok) {
					ready = true;
					break;
				}
			} catch {
				// The server is still starting.
			}
			await delay(500);
		}
		if (!ready) throw new Error('Built Schtart server did not become ready at /api/health.');
	} catch (error) {
		await stopApp(app);
		await provider?.stop();
		throw error;
	}

	return {
		stop: async () => {
			await stopApp(app);
			await provider?.stop();
		}
	};
}
