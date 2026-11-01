import { Cron } from 'croner';

export interface ScheduledJob {
	name: string;
	schedule: string;
	run: () => void | Promise<void>;
}

export interface ScheduledJobHandle {
	stop(): void;
}

export type JobScheduler = (
	job: ScheduledJob,
	run: () => Promise<void>
) => ScheduledJobHandle;

interface SchedulerLogger {
	error: (...data: unknown[]) => void;
}

interface SchedulerOptions {
	jobs: readonly ScheduledJob[];
	logger?: SchedulerLogger;
	scheduler?: JobScheduler;
}

export interface SchedulerService {
	start(): void;
	stop(): Promise<void>;
}

export function createSchedulerService({
	jobs,
	logger = console,
	scheduler = (job, run) =>
		new Cron(
			job.schedule,
			{
				name: job.name,
				protect: true,
				catch: (error) => logger.error(`Scheduler callback failed for "${job.name}"`, error)
			},
			run
		)
}: SchedulerOptions): SchedulerService {
	let started = false;
	let stopped = false;
	let stopPromise: Promise<void> | undefined;
	let handles: ScheduledJobHandle[] = [];
	const inFlight = new Map<ScheduledJob, Promise<void>>();

	function runJob(job: ScheduledJob): Promise<void> {
		if (stopped || inFlight.has(job)) return Promise.resolve();

		const execution = Promise.resolve()
			.then(job.run)
			.catch((error: unknown) => {
				logger.error(`Scheduled job "${job.name}" failed`, error);
			})
			.then(() => undefined)
			.finally(() => inFlight.delete(job));

		inFlight.set(job, execution);
		return execution;
	}

	return {
		start() {
			if (started || stopped) return;

			const scheduled: ScheduledJobHandle[] = [];
			try {
				for (const job of jobs) {
					scheduled.push(scheduler(job, () => runJob(job)));
				}
			} catch (error) {
				for (const handle of scheduled) handle.stop();
				throw error;
			}

			handles = scheduled;
			started = true;
		},
		stop() {
			if (stopPromise) return stopPromise;

			stopped = true;
			for (const handle of handles) handle.stop();
			handles = [];
			stopPromise = Promise.all(inFlight.values()).then(() => undefined);
			return stopPromise;
		}
	};
}

// No collectors run yet. Future collectors must refresh from their source or resume a
// persisted checkpoint; missed cron executions are not replayed.
const registeredJobs: readonly ScheduledJob[] = [];
const schedulerService = createSchedulerService({ jobs: registeredJobs });

export function startScheduler(): void {
	schedulerService.start();
}

export function stopScheduler(): Promise<void> {
	return schedulerService.stop();
}
