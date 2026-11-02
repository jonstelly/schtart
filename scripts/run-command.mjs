import { spawnSync } from 'node:child_process';
import { loadEnv } from 'vite';

const [defaultMode, separator, command, ...args] = process.argv.slice(2);

if (!defaultMode || separator !== '--' || !command) {
	console.error('Usage: node scripts/run-command.mjs <mode> -- <command> [args...]');
	process.exit(2);
}

let mode = defaultMode;
for (let index = 0; index < args.length; index += 1) {
	if (args[index] === '--mode') {
		const selectedMode = args[index + 1];
		if (!selectedMode) {
			console.error('The --mode option requires a value.');
			process.exit(2);
		}
		mode = selectedMode;
		index += 1;
	} else if (args[index].startsWith('--mode=')) {
		mode = args[index].slice('--mode='.length);
	}
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
