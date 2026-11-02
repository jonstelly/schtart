import { spawnSync } from 'node:child_process';
import { loadEnv } from 'vite';

const [mode, separator, command, ...args] = process.argv.slice(2);

if (!mode || separator !== '--' || !command) {
	console.error('Usage: node scripts/run-command.mjs <mode> -- <command> [args...]');
	process.exit(2);
}

for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
	if (process.env[key] === undefined) process.env[key] = value;
}

const result = spawnSync(command, args, {
	stdio: 'inherit',
	env: process.env,
	shell: process.platform === 'win32'
});

if (result.error) {
	console.error(result.error);
	process.exit(1);
}

process.exit(result.status ?? 1);
