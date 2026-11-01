<script lang="ts">
	import { ArrowUpRight, ShieldAlert } from '@lucide/svelte';
	import * as Alert from '#lib/components/ui/alert';
	import { Button } from '#lib/components/ui/button';
	import * as Card from '#lib/components/ui/card';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';

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

<main class="relative isolate min-h-svh overflow-hidden bg-background text-foreground">
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_17%_42%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_36%),radial-gradient(ellipse_at_91%_13%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_28%)]"
	></div>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--border)_15%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border)_15%,transparent)_1px,transparent_1px)] bg-size-[72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]"
	></div>

	<header class="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
		<a href="/" aria-label="Schtart home" class="group inline-flex items-center gap-2.5">
			<span
				aria-hidden="true"
				class="grid size-8 grid-cols-2 gap-0.5 rounded-lg border border-primary/25 bg-primary/10 p-1.5"
			>
				<span class="rounded-[2px] bg-primary"></span>
				<span class="rounded-[2px] bg-primary/45"></span>
				<span class="rounded-[2px] bg-primary/45"></span>
				<span class="rounded-[2px] bg-primary"></span>
			</span>
			<span class="text-lg font-semibold tracking-[-0.04em]">Schtart<span class="text-primary">.</span></span>
		</a>
		<div class="flex items-center gap-3">
			<span class="hidden text-xs font-medium tracking-wide text-muted-foreground sm:block">A quieter place to begin</span>
			<ThemeToggle />
		</div>
	</header>

	<div class="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-12 pt-4 sm:px-8 md:pt-8 lg:min-h-[calc(100svh-6.5rem)] lg:grid-cols-[1fr_0.82fr] lg:gap-16 lg:px-12 lg:pb-20">
		<section class="flex flex-col justify-center" aria-label="About Schtart">
			<div class="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-sm backdrop-blur">
				<span class="size-1.5 rounded-full bg-primary shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_80%,transparent)]"></span>
				A personal starting point
			</div>
			<h1 class="max-w-2xl font-heading text-6xl leading-[0.95] font-normal tracking-[-0.045em] text-foreground sm:text-7xl lg:text-8xl">
				Less noise.<br />More <span class="text-primary">of your day.</span>
			</h1>
			<p class="mt-6 max-w-md text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
				A clear place to begin, built around the things you care about.
			</p>
			<div class="mt-12 flex items-center gap-3 text-xs font-medium tracking-wide text-muted-foreground/80">
				<span class="h-px w-10 bg-primary/70"></span>
				Your pages, your pace
			</div>
		</section>

		<section class="w-full justify-self-end lg:max-w-[28rem]" aria-labelledby="page-title">
			<Card.Root class="border-border/70 bg-card/90 shadow-2xl shadow-black/15 backdrop-blur-xl">
				<Card.Header class="space-y-2 px-6 pb-3 pt-7 sm:px-8 sm:pt-8">
					<p class="text-[0.67rem] font-semibold uppercase tracking-[0.17em] text-primary">{copy.eyebrow}</p>
					<Card.Title id="page-title" class="font-heading text-3xl leading-tight font-normal tracking-[-0.025em]">
						{copy.title}
					</Card.Title>
					<Card.Description class="text-sm leading-6 text-muted-foreground">{copy.intro}</Card.Description>
				</Card.Header>

				<Card.Content class="px-6 pb-7 sm:px-8 sm:pb-8">
					{#if copy.warning}
						<Alert.Root class="mb-5 border-primary/25 bg-primary/5 text-foreground">
							<ShieldAlert aria-hidden="true" class="text-primary" />
							<Alert.Title class="text-sm font-semibold">Before you continue</Alert.Title>
							<Alert.Description class="text-xs leading-5 text-muted-foreground">{copy.warning}</Alert.Description>
						</Alert.Root>
					{/if}

					<form class="grid gap-4" onsubmit={submit}>
						<div class="grid gap-2">
							<Label for="username">Username</Label>
							<Input
								id="username"
								name="username"
								bind:value={username}
								autocomplete="username"
								placeholder="Your username"
								required
								minlength={isRegistration ? 3 : undefined}
								maxlength={isRegistration ? 30 : undefined}
								pattern={isRegistration ? '[A-Za-z0-9_.]+' : undefined}
								aria-describedby={isRegistration ? 'username-hint' : undefined}
								class="h-11 bg-background/60 px-3"
							/>
							{#if isRegistration}
								<p id="username-hint" class="text-xs leading-5 text-muted-foreground">
									3–30 letters, numbers, dots, or underscores.
								</p>
							{/if}
						</div>

						{#if isRegistration}
							<div class="grid gap-2">
								<Label for="email">Email address</Label>
								<Input
									id="email"
									name="email"
									type="email"
									bind:value={email}
									autocomplete="email"
									placeholder="you@example.com"
									required
									class="h-11 bg-background/60 px-3"
								/>
							</div>
						{/if}

						<div class="grid gap-2">
							<Label for="password">Password</Label>
							<Input
								id="password"
								name="password"
								type="password"
								bind:value={password}
								autocomplete={isRegistration ? 'new-password' : 'current-password'}
								placeholder="At least 12 characters"
								required
								minlength={isRegistration ? 12 : undefined}
								aria-describedby={isRegistration ? 'password-hint' : undefined}
								class="h-11 bg-background/60 px-3"
							/>
							{#if isRegistration}
								<p id="password-hint" class="text-xs leading-5 text-muted-foreground">
									Use at least 12 characters.
								</p>
							{/if}
						</div>

						{#if message}
							<p class="text-sm text-destructive" role="alert">{message}</p>
						{/if}

						<Button type="submit" disabled={pending} class="mt-1 h-11 w-full gap-2 font-semibold">
							{pending
								? isRegistration
									? 'Creating account…'
									: 'Signing in…'
								: isRegistration
									? 'Create account'
									: 'Sign in'}
							{#if !pending}<ArrowUpRight aria-hidden="true" size={16} />{/if}
						</Button>
					</form>

					<p class="mt-6 text-center text-sm text-muted-foreground">
						{#if isRegistration}
							Already have an account?
							<a class="ml-1 font-medium text-primary underline-offset-4 hover:underline" href="/login">Sign in</a>
						{:else}
							New here?
							<a class="ml-1 font-medium text-primary underline-offset-4 hover:underline" href="/register">Create an account</a>
						{/if}
					</p>
				</Card.Content>
			</Card.Root>
			<p class="mt-4 px-4 text-center text-xs leading-5 text-muted-foreground/80">
				A calm, private starting point for the things that matter to you.
			</p>
		</section>
	</div>
</main>
