import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const envDirectories: string[] = [];

afterEach(() => {
	for (const directory of envDirectories.splice(0)) rmSync(directory, { recursive: true });
});

describe('project command environment', () => {
	it('loads mode-specific env files while preserving shell overrides', () => {
		const envDirectory = mkdtempSync(resolve(tmpdir(), 'schtart-command-env-'));
		envDirectories.push(envDirectory);
		writeFileSync(
			resolve(envDirectory, '.env'),
			'SCHTART_ENV_BASE=base\nSCHTART_ENV_OVERRIDE=base\nSCHTART_ENV_SHELL=from-file\n'
		);
		writeFileSync(
			resolve(envDirectory, '.env.development'),
			'SCHTART_ENV_MODE=development\nSCHTART_ENV_OVERRIDE=mode\n'
		);
		writeFileSync(
			resolve(envDirectory, '.env.development.local'),
			'SCHTART_ENV_OVERRIDE=mode-local\n'
		);

		const result = spawnSync(
			process.execPath,
			[
				resolve('scripts/run-command.mjs'),
				'development',
				'--',
				process.execPath,
				'-e',
				'process.stdout.write(JSON.stringify({base:process.env.SCHTART_ENV_BASE,mode:process.env.SCHTART_ENV_MODE,override:process.env.SCHTART_ENV_OVERRIDE,shell:process.env.SCHTART_ENV_SHELL}))'
			],
			{
				cwd: envDirectory,
				encoding: 'utf8',
				env: { ...process.env, SCHTART_ENV_SHELL: 'from-shell' }
			}
		);

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({
			base: 'base',
			mode: 'development',
			override: 'mode-local',
			shell: 'from-shell'
		});
	});

	it('loads the explicitly selected mode rather than the command default', () => {
		const envDirectory = mkdtempSync(resolve(tmpdir(), 'schtart-command-mode-'));
		envDirectories.push(envDirectory);
		writeFileSync(resolve(envDirectory, '.env.production'), 'SCHTART_ENV_MODE=production\n');
		writeFileSync(resolve(envDirectory, '.env.development'), 'SCHTART_ENV_MODE=development\n');

		const result = spawnSync(
			process.execPath,
			[
				resolve('scripts/run-command.mjs'),
				'production',
				'--',
				process.execPath,
				'-e',
				'process.stdout.write(process.env.SCHTART_ENV_MODE)',
				'--',
				'--mode',
				'development'
			],
			{ cwd: envDirectory, encoding: 'utf8', env: process.env }
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toBe('development');
	});
});
