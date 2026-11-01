<script lang="ts">
	let { mode }: { mode: 'setup' | 'register' | 'login' } = $props();

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let message = $state('');
	let pending = $state(false);

	const isRegistration = $derived(mode !== 'login');
	const copy = $derived(
		mode === 'setup'
			? {
				eyebrow: 'First-run setup',
				title: 'Claim your start page.',
				intro: 'Create the first account to finish setup. This account becomes the administrator.',
				warning:
					'Complete setup before exposing an unclaimed instance publicly. The first person to register can claim it.'
			}
			: mode === 'register'
				? {
					eyebrow: 'Create an account',
					title: 'Make this page yours.',
					intro: 'Register with an email address, username, and password.',
					warning: ''
				}
				: {
					eyebrow: 'Welcome back',
					title: 'Pick up where you left off.',
					intro: 'Sign in with your username and password.',
					warning: ''
				}
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		message = '';
		pending = true;

		try {
			const response = await fetch(
				isRegistration ? '/api/auth/sign-up/email' : '/api/auth/sign-in/username',
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(
						isRegistration
							? { name: username, username, email, password }
							: { username, password }
					)
				}
			);
			if (!response.ok) {
				const result = await response.json().catch(() => null);
				message =
					result?.message ??
					(isRegistration
						? 'Registration could not be completed. Check your details and try again.'
						: 'Those username and password details did not match.');
				return;
			}
			window.location.assign('/');
		} catch {
			message = 'The server could not be reached. Try again in a moment.';
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>{copy.eyebrow} — Schtart</title>
</svelte:head>

<main class="auth-shell">
	<a class="wordmark" href="/" aria-label="Schtart home">Schtart<span>.</span></a>
	<div class="auth-grid">
		<section class="intro-panel" aria-label="About Schtart">
			<p class="eyebrow">A personal starting point</p>
			<h1>Less noise.<br />More <em>day.</em></h1>
			<p class="intro-copy">A clear place to begin, built around the things you care about.</p>
			<div class="signal" aria-hidden="true"><span></span><span></span><span></span></div>
		</section>

		<section class="form-panel" aria-labelledby="page-title">
			<p class="eyebrow">{copy.eyebrow}</p>
			<h2 id="page-title">{copy.title}</h2>
			<p class="form-intro">{copy.intro}</p>
			{#if copy.warning}
				<p class="warning">{copy.warning}</p>
			{/if}

			<form onsubmit={submit}>
				<label for="username">Username</label>
				<input
					id="username"
					name="username"
					bind:value={username}
					autocomplete="username"
					required
					minlength={isRegistration ? 3 : undefined}
					maxlength={isRegistration ? 30 : undefined}
					pattern={isRegistration ? '[A-Za-z0-9_.]+' : undefined}
					aria-describedby={isRegistration ? 'username-hint' : undefined}
				/>
				{#if isRegistration}
					<span id="username-hint" class="hint">3–30 letters, numbers, dots, or underscores.</span>
					<label for="email">Email address</label>
					<input
						id="email"
						name="email"
						type="email"
						bind:value={email}
						autocomplete="email"
						required
					/>
				{/if}

				<label for="password">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					bind:value={password}
					autocomplete={isRegistration ? 'new-password' : 'current-password'}
					required
					minlength={isRegistration ? 12 : undefined}
					aria-describedby={isRegistration ? 'password-hint' : undefined}
				/>
				{#if isRegistration}
					<span id="password-hint" class="hint">Use at least 12 characters.</span>
				{/if}

				{#if message}
					<p class="error" role="alert">{message}</p>
				{/if}
				<button type="submit" disabled={pending}>
					{pending ? (isRegistration ? 'Creating account…' : 'Signing in…') : isRegistration ? 'Create account' : 'Sign in'}
				</button>
			</form>
			<p class="switch">
				{#if isRegistration}
					Already have an account? <a href="/login">Sign in</a>
				{:else}
					New here? <a href="/register">Create an account</a>
				{/if}
			</p>
		</section>
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0c1110;
		color: #e8ece7;
		font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif;
	}

	.auth-shell {
		box-sizing: border-box;
		min-height: 100svh;
		padding: 2rem clamp(1.25rem, 6vw, 6rem) 3rem;
		background:
			radial-gradient(ellipse at 17% 46%, rgb(133 159 134 / 11%), transparent 38%),
			linear-gradient(135deg, #0c1110 0%, #101817 100%);
	}

	.wordmark {
		color: #e8ece7;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.65rem;
		letter-spacing: -0.07em;
		text-decoration: none;
	}

	.wordmark span { color: #d18b68; }

	.auth-grid {
		width: min(66rem, 100%);
		min-height: calc(100svh - 8rem);
		margin: 1.4rem auto 0;
		display: grid;
		grid-template-columns: 1fr minmax(19rem, 25rem);
		align-items: center;
		gap: clamp(3rem, 9vw, 9rem);
	}

	.intro-panel { padding: 2rem 0; }
	.eyebrow { margin: 0 0 1.1rem; color: #a8b6ab; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.17em; text-transform: uppercase; }
	h1 { margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(3.8rem, 8vw, 7rem); font-weight: 400; letter-spacing: -0.08em; line-height: 0.92; }
	h1 em { color: #d18b68; font-weight: 400; }
	.intro-copy { max-width: 22rem; margin: 1.75rem 0 0; color: #a8b6ab; font-size: 1.05rem; line-height: 1.7; }
	.signal { width: 8rem; display: flex; gap: 0.35rem; margin-top: 3rem; align-items: end; }
	.signal span { width: 1.8rem; border-top: 1px solid #52685c; }
	.signal span:nth-child(2) { width: 3.4rem; border-color: #d18b68; }
	.form-panel { padding: clamp(1.5rem, 4vw, 2.5rem); border: 1px solid #2d3a35; border-radius: 1rem; background: rgb(19 27 24 / 92%); box-shadow: 0 2rem 5rem rgb(0 0 0 / 18%); }
	h2 { margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 2rem; font-weight: 400; letter-spacing: -0.04em; }
	.form-intro { margin: 0.75rem 0 1.5rem; color: #afbbb1; font-size: 0.92rem; line-height: 1.55; }
	.warning { margin: 0 0 1.4rem; padding: 0.75rem 0.85rem; border-left: 2px solid #d18b68; background: #1b2521; color: #d8ded8; font-size: 0.82rem; line-height: 1.5; }
	form { display: grid; gap: 0.55rem; }
	label { margin-top: 0.45rem; color: #dbe1dc; font-size: 0.82rem; font-weight: 600; }
	input { box-sizing: border-box; width: 100%; min-height: 2.85rem; padding: 0.65rem 0.8rem; border: 1px solid #405047; border-radius: 0.45rem; background: #101714; color: #f2f4f1; font: inherit; }
	input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid #d18b68; outline-offset: 3px; }
	.hint { margin: -0.25rem 0 0.3rem; color: #9aa89d; font-size: 0.72rem; }
	button { min-height: 2.9rem; margin-top: 0.75rem; border: 0; border-radius: 0.45rem; background: #d18b68; color: #171714; font: inherit; font-weight: 700; cursor: pointer; transition: background 140ms ease, transform 140ms ease; }
	button:hover:not(:disabled) { transform: translateY(-1px); background: #e0a17f; }
	button:disabled { cursor: progress; opacity: 0.7; }
	.error { margin: 0.2rem 0; color: #ffb4a1; font-size: 0.82rem; }
	.switch { margin: 1.15rem 0 0; color: #a8b6ab; font-size: 0.82rem; text-align: center; }
	.switch a { color: #e2a07f; text-underline-offset: 0.2em; }
	@media (max-width: 720px) {
		.auth-shell { padding-top: 1.4rem; }
		.auth-grid { min-height: unset; grid-template-columns: 1fr; gap: 1rem; margin-top: 1rem; }
		.intro-panel { padding: 1rem 0 0; }
		h1 { font-size: clamp(3.1rem, 13vw, 5rem); }
		.intro-copy, .signal { display: none; }
	}
</style>
