import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
import { prepareTestDatabase } from './prepare-test-database.mjs';

function runDocker(args, { allowFailure = false } = {}) {
	const result = spawnSync('docker', args, { encoding: 'utf8' });
	if (result.error) throw result.error;
	if (!allowFailure && result.status !== 0) {
		throw new Error(
			result.stderr.trim() || `docker ${args[0]} failed with exit code ${result.status}.`
		);
	}
	return result.stdout.trim();
}

async function unusedPort() {
	const server = createServer();
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const { port } = server.address();
	await new Promise((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve()))
	);
	return port;
}

const databaseUrl = await prepareTestDatabase(process.env.TEST_DATABASE_URL);
const port = await unusedPort();
const containerName = `schtart-lifecycle-test-${process.pid}`;
const image = process.env.SCHTART_TEST_DOCKER_IMAGE ?? 'schtart:ticket7';

try {
	runDocker([
		'run',
		'--detach',
		'--name',
		containerName,
		'--network',
		'host',
		'--env',
		`PORT=${port}`,
		'--env',
		`DATABASE_URL=${databaseUrl}`,
		'--env',
		`BETTER_AUTH_URL=http://127.0.0.1:${port}`,
		'--env',
		'BETTER_AUTH_SECRET=docker-lifecycle-test-only-not-a-deployment-secret',
		'--env',
		'PASSWORD_AUTH_ENABLED=true',
		image
	]);

	let healthy = false;
	for (let attempt = 0; attempt < 60; attempt += 1) {
		const state = runDocker(
			[
				'inspect',
				'--format',
				'{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}',
				containerName
			],
			{ allowFailure: true }
		);
		if (state === 'running healthy') {
			healthy = true;
			break;
		}
		if (state.startsWith('exited')) {
			throw new Error(`Docker container exited before becoming healthy (state: ${state}).`);
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	if (!healthy) throw new Error('Docker container did not become healthy within 60 seconds.');

	runDocker(['stop', '--time', '15', containerName]);
	const exitCode = runDocker(['inspect', '--format', '{{.State.ExitCode}}', containerName]);
	if (exitCode !== '0') {
		throw new Error(`Docker container did not exit cleanly after SIGTERM (exit code ${exitCode}).`);
	}

	console.log('Docker health check passed and the container exited cleanly after SIGTERM.');
} finally {
	runDocker(['rm', '--force', containerName], { allowFailure: true });
}
