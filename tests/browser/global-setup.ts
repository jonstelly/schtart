import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { LocalOidcProvider } from '../integration/local-oidc-provider';

const appOrigin = 'http://127.0.0.1:4173';

async function stopApp(app: ChildProcess) {
	if (app.exitCode !== null || app.signalCode !== null) return;
	const exited = new Promise<void>((resolve) => app.once('exit', () => resolve()));
	app.kill('SIGTERM');
	const forcedStop = setTimeout(() => app.kill('SIGKILL'), 15_000);
	forcedStop.unref();
	await exited;
	clearTimeout(forcedStop);
}

export default async function globalSetup() {
	const provider = new LocalOidcProvider();
	await provider.start();
	provider.useIdentity({
		sub: 'browser-user',
		email: 'browser-user@example.test',
		name: 'Browser User'
	});

	const app = spawn(process.execPath, ['build'], {
		stdio: 'inherit',
		env: {
			...process.env,
			NODE_ENV: 'production',
			HOST: '127.0.0.1',
			PORT: '4173',
			BETTER_AUTH_URL: appOrigin,
			BETTER_AUTH_SECRET: 'playwright-only-not-a-deployment-secret-0123456789',
			PASSWORD_AUTH_ENABLED: 'true',
			REGISTRATION_EMAIL_ALLOWLIST: '',
			OIDC_ISSUER_URL: provider.issuerUrl,
			OIDC_CLIENT_ID: 'schtart-test-client',
			OIDC_CLIENT_SECRET: 'local-test-client-secret'
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
		await provider.stop();
		throw error;
	}

	return async () => {
		await stopApp(app);
		await provider.stop();
	};
}
