import { describe, expect, it, vi } from 'vitest';
import { createSchedulerService, type ScheduledJob } from './scheduler';

function createManualScheduler() {
	const scheduled: Array<{ job: ScheduledJob; run: () => Promise<void>; stopped: boolean }> = [];

	return {
		scheduled,
		schedule(job: ScheduledJob, run: () => Promise<void>) {
			const entry = { job, run, stopped: false };
			scheduled.push(entry);
			return {
				stop() {
					entry.stopped = true;
				}
			};
		}
	};
}

describe('scheduler service', () => {
	it('starts code-registered jobs once and stops their schedules', async () => {
		const job: ScheduledJob = {
			name: 'refresh test source',
			schedule: '0 * * * *',
			run: vi.fn()
		};
		const manual = createManualScheduler();
		const service = createSchedulerService({ jobs: [job], scheduler: manual.schedule });

		service.start();
		service.start();

		expect(manual.scheduled).toHaveLength(1);
		expect(manual.scheduled[0].job).toBe(job);

		await service.stop();

		expect(manual.scheduled[0].stopped).toBe(true);
		await manual.scheduled[0].run();
		expect(job.run).not.toHaveBeenCalled();
	});

	it('does not overlap a job and allows its next run after completion', async () => {
		let finishFirstRun!: () => void;
		const run = vi
			.fn()
			.mockImplementationOnce(
				() => new Promise<void>((resolve) => (finishFirstRun = resolve))
			)
			.mockResolvedValue(undefined);
		const manual = createManualScheduler();
		const service = createSchedulerService({
			jobs: [{ name: 'refresh test source', schedule: '0 * * * *', run }],
			scheduler: manual.schedule
		});
		service.start();
		const trigger = manual.scheduled[0].run;

		const firstRun = trigger();
		await Promise.resolve();
		await trigger();
		expect(run).toHaveBeenCalledTimes(1);

		finishFirstRun();
		await firstRun;
		await trigger();
		expect(run).toHaveBeenCalledTimes(2);
		await service.stop();
	});

	it('logs a failed execution and still runs the job again', async () => {
		const failure = new Error('source is temporarily unavailable');
		const run = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
		const logger = { error: vi.fn() };
		const manual = createManualScheduler();
		const service = createSchedulerService({
			jobs: [{ name: 'refresh test source', schedule: '0 * * * *', run }],
			scheduler: manual.schedule,
			logger
		});
		service.start();
		const trigger = manual.scheduled[0].run;

		await trigger();
		await trigger();

		expect(logger.error).toHaveBeenCalledWith(
			'Scheduled job "refresh test source" failed',
			failure
		);
		expect(run).toHaveBeenCalledTimes(2);
		await service.stop();
	});

	it('stops future triggers and waits for in-flight work to finish', async () => {
		let finishRun!: () => void;
		const run = vi.fn(() => new Promise<void>((resolve) => (finishRun = resolve)));
		const manual = createManualScheduler();
		const service = createSchedulerService({
			jobs: [{ name: 'refresh test source', schedule: '0 * * * *', run }],
			scheduler: manual.schedule
		});
		service.start();
		const trigger = manual.scheduled[0].run;
		const execution = trigger();
		await Promise.resolve();

		let stopped = false;
		const stopping = service.stop().then(() => (stopped = true));
		await trigger();
		await Promise.resolve();
		expect(manual.scheduled[0].stopped).toBe(true);
		expect(run).toHaveBeenCalledTimes(1);
		expect(stopped).toBe(false);

		finishRun();
		await Promise.all([execution, stopping]);
		expect(stopped).toBe(true);
	});

	it('runs a registered Croner schedule against a controlled clock', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
		const run = vi.fn();
		const service = createSchedulerService({
			jobs: [{ name: 'clock test', schedule: '* * * * * *', run }]
		});

		try {
			service.start();
			await vi.advanceTimersByTimeAsync(1_000);
			expect(run).toHaveBeenCalledTimes(1);
			await service.stop();
		} finally {
			vi.useRealTimers();
		}
	});
});
