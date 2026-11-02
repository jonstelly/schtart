# Scheduler lifecycle

The Node server starts code-registered Croner jobs from SvelteKit's server `init` hook. The
adapter-node `sveltekit:shutdown` event stops future runs. The scheduler's stop promise waits for
active job callbacks to settle; jobs are not forcibly cancelled. The adapter retains its normal
HTTP shutdown behavior.

Jobs are in-memory and local to one server process. Missed schedule times are not replayed, and
there are no retries or distributed-execution guarantees. No collectors are registered yet.
Future collectors must recover by refreshing from their source or resuming a persisted checkpoint;
they must not assume every scheduled execution occurred.
