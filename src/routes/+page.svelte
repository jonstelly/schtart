<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let signingOut = $state(false);
	let message = $state('');

	async function signOut() {
		signingOut = true;
		message = '';
		try {
			const response = await fetch('/api/auth/sign-out', { method: 'POST' });
			if (response.ok) {
				window.location.assign('/login');
				return;
			}
			message = 'Could not sign out. Please try again.';
		} catch {
			message = 'The server could not be reached. Please try again.';
		} finally {
			signingOut = false;
		}
	}
</script>

<svelte:head>
	<title>Schtart — Your personal start page</title>
	<meta name="description" content="A personal starting point for your day." />
</svelte:head>

<main>
	<header>
		<a class="wordmark" href="/">Schtart<span>.</span></a>
		<div class="account">
			<span>{data.user.username ?? data.user.name}</span>
			<button type="button" onclick={signOut} disabled={signingOut}>
				{signingOut ? 'Signing out…' : 'Sign out'}
			</button>
		</div>
	</header>
	<section>
		{#if message}<p class="error" role="alert">{message}</p>{/if}
		<p class="eyebrow">A fresh tab for what matters</p>
		<h1>Your day,<br />in view.</h1>
		<p class="intro">Your account is ready. Your personal start page will take shape here.</p>
		<a class="status" href="/api/health">System status <span aria-hidden="true">↗</span></a>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0c1110;
	}

	main {
		box-sizing: border-box;
		min-height: 100svh;
		padding: 1.6rem clamp(1.25rem, 6vw, 6rem);
		background: radial-gradient(ellipse at 23% 55%, rgb(133 159 134 / 11%), transparent 38%), #0c1110;
		color: #e8ece7;
		font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif;
	}

	header {
		width: min(75rem, 100%);
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.wordmark {
		color: inherit;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.65rem;
		letter-spacing: -0.07em;
		text-decoration: none;
	}

	.wordmark span { color: #d18b68; }
	.account { display: flex; gap: 1rem; align-items: center; color: #b7c1b9; font-size: 0.85rem; }
	button { padding: 0.55rem 0.8rem; border: 1px solid #405047; border-radius: 0.4rem; background: transparent; color: inherit; font: inherit; cursor: pointer; }
	button:focus-visible, a:focus-visible { outline: 2px solid #d18b68; outline-offset: 3px; }

	section {
		width: min(75rem, 100%);
		min-height: calc(100svh - 8rem);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
	}

	.eyebrow { margin: 0 0 1rem; color: #a8b6ab; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
	h1 { margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(4rem, 12vw, 9rem); font-weight: 400; letter-spacing: -0.08em; line-height: 0.9; }
	.intro { max-width: 27rem; margin: 2rem 0; color: #afbbb1; font-size: clamp(1.05rem, 2vw, 1.25rem); line-height: 1.6; }
	.status { color: #e8ece7; font-size: 0.9rem; text-decoration-color: #d18b68; text-underline-offset: 0.3em; }
	.status span { margin-left: 0.35rem; color: #d18b68; }
	.error { color: #ffb4a1; font-size: 0.85rem; }
	@media (max-width: 600px) { .account { gap: 0.6rem; } .account span { display: none; } }
</style>
