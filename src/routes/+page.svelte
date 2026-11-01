<script lang="ts">
	import { Activity, ArrowUpRight, LogOut, Sparkles } from '@lucide/svelte';
	import * as Alert from '#lib/components/ui/alert';
	import { Button } from '#lib/components/ui/button';
	import ThemeToggle from '../lib/components/ThemeToggle.svelte';
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

<main class="relative isolate min-h-svh overflow-hidden bg-background text-foreground">
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_17%_42%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_36%),radial-gradient(ellipse_at_91%_13%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_28%)]"
	></div>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--border)_15%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border)_15%,transparent)_1px,transparent_1px)] bg-size-[72px_72px] [mask-image:linear-gradient(to_bottom,currentColor,transparent_78%)]"
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
		<div class="flex items-center gap-2 sm:gap-3">
			<span class="hidden max-w-36 truncate text-xs font-medium tracking-wide text-muted-foreground sm:block">
				{data.user.username ?? data.user.name}
			</span>
			<ThemeToggle />
			<Button variant="outline" size="sm" onclick={signOut} disabled={signingOut} class="gap-2">
				<LogOut aria-hidden="true" size={15} />
				<span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
			</Button>
		</div>
	</header>

	<div class="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-12 pt-4 sm:px-8 md:pt-8 lg:min-h-[calc(100svh-6.5rem)] lg:grid-cols-[1fr_0.82fr] lg:gap-16 lg:px-12 lg:pb-20">
		<section class="flex flex-col justify-center" aria-labelledby="welcome-title">
			<div class="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-sm backdrop-blur">
				<span class="size-1.5 rounded-full bg-primary shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_80%,transparent)]"></span>
				Your personal starting point
			</div>
			<h1 id="welcome-title" class="max-w-2xl font-heading text-6xl leading-[0.95] font-normal tracking-[-0.045em] text-heading sm:text-7xl lg:text-8xl">
				Your day,<br />in view.
			</h1>
			<p class="mt-6 max-w-md text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
				Your account is ready. Your personal start page will take shape here.
			</p>
			<div class="mt-12 flex items-center gap-3 text-xs font-medium tracking-wide text-muted-foreground">
				<span class="h-px w-10 bg-primary/70"></span>
				Your pages, your pace
			</div>
		</section>

		<section class="w-full justify-self-end lg:max-w-[28rem]" aria-labelledby="space-title">
			{#if message}
				<Alert.Root variant="destructive" class="mb-4">{message}</Alert.Root>
			{/if}

			<div class="flex flex-col gap-6 rounded-xl border border-border bg-card/90 p-6 shadow-2xl shadow-foreground/5 backdrop-blur-xl sm:p-8">
				<div class="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
					<Sparkles aria-hidden="true" size={21} />
				</div>
				<div>
					<p class="text-[0.67rem] font-semibold uppercase tracking-[0.17em] text-link">Account ready</p>
					<h2 id="space-title" class="mt-2 font-heading text-heading text-3xl leading-tight font-normal tracking-[-0.025em]">
						A clear place to begin.
					</h2>
					<p class="mt-3 text-sm leading-6 text-muted-foreground">
						Your start page is set up. More of the things you care about will find a home here soon.
					</p>
				</div>
				<div class="flex items-center gap-3 rounded-lg border border-border bg-muted/70 px-4 py-3">
					<Activity aria-hidden="true" class="shrink-0 text-primary" size={18} />
					<div class="min-w-0">
						<p class="text-sm font-medium text-foreground">Everything is running</p>
						<p class="mt-0.5 text-xs text-foreground">Check your instance status anytime.</p>
					</div>
				</div>
				<Button href="/api/health" variant="outline" class="w-fit gap-2">
					System status
					<ArrowUpRight aria-hidden="true" size={15} />
				</Button>
			</div>
			<p class="mt-4 px-4 text-center text-xs leading-5 text-muted-foreground">
				A calm, private starting point for the things that matter to you.
			</p>
		</section>
	</div>
</main>
