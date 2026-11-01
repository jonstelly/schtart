<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Fingerprint, LayoutGrid, LogOut, Settings2 } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button';
	import DashboardConfigurationEditor from '../lib/components/DashboardConfigurationEditor.svelte';
	import DashboardWidgetCard from '../lib/components/DashboardWidgetCard.svelte';
	import ThemeToggle from '../lib/components/ThemeToggle.svelte';
	import {
		DASHBOARD_PAGES,
		DASHBOARD_PAGE_LABELS,
		type DashboardConfiguration,
		type DashboardPageName,
		type EffectiveDashboardConfiguration
	} from '../lib/dashboard';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let configuration = $state<DashboardConfiguration | null>(null);
	let configurationYaml = $state('');
	let configurationSource = $state<'default' | 'user'>('default');
	let activePage = $state<DashboardPageName>('home');
	let loading = $state(true);
	let pageError = $state('');
	let editorOpen = $state(false);
	let signingOut = $state(false);
	let signOutError = $state('');
	let linkingIdentity = $state(false);
	let linkMessage = $state('');

	const pageDescriptions: Record<DashboardPageName, string> = {
		home: 'A thoughtful mix of the things you follow.',
		news: 'A quiet place for the stories worth your attention.',
		sports: 'Scores and fixtures, presented as examples.',
		monitoring: 'A simple view of service health examples.'
	};
	const activePageDescription = $derived(pageDescriptions[activePage]);
	const activePageLabel = $derived(DASHBOARD_PAGE_LABELS[activePage]);
	const activeLayout = $derived(configuration?.pages[activePage]);

	onMount(() => {
		void loadConfiguration();
	});

	async function loadConfiguration() {
		loading = true;
		pageError = '';
		try {
			const response = await fetch('/api/configuration');
			if (!response.ok) throw new Error('Your dashboard configuration could not be loaded.');
			applyConfiguration((await response.json()) as EffectiveDashboardConfiguration);
		} catch (error) {
			pageError = error instanceof Error ? error.message : 'Your dashboard configuration could not be loaded.';
		} finally {
			loading = false;
		}
	}

	function applyConfiguration(value: EffectiveDashboardConfiguration) {
		configuration = value.configuration;
		configurationYaml = value.yaml;
		configurationSource = value.source;
	}

	async function signOut() {
		signingOut = true;
		signOutError = '';
		try {
			const response = await fetch('/api/auth/sign-out', { method: 'POST' });
			if (response.ok) {
				window.location.assign('/login');
				return;
			}
			signOutError = 'Could not sign out. Please try again.';
		} catch {
			signOutError = 'The server could not be reached. Please try again.';
		} finally {
			signingOut = false;
		}
	}

	async function linkOidcIdentity() {
		linkingIdentity = true;
		linkMessage = '';
		try {
			const response = await fetch('/api/auth/link-social', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ provider: 'oidc', callbackURL: '/', disableRedirect: true })
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || typeof result?.url !== 'string') {
				linkMessage = result?.message ?? 'The identity provider could not be reached. Try again.';
				return;
			}
			window.location.assign(result.url);
		} catch {
			linkMessage = 'The server could not be reached. Try again in a moment.';
		} finally {
			linkingIdentity = false;
		}
	}
</script>

<svelte:head>
	<title>Schtart — {activePageLabel}</title>
	<meta name="description" content="A private, configurable starting point for your day." />
</svelte:head>

<main class="min-h-svh bg-background text-foreground">
	<header class="border-b border-border/75 bg-background/90 backdrop-blur-sm">
		<div class="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-4 px-5 py-4 sm:px-8 lg:px-12">
			<a href="/" aria-label="Schtart home" class="group inline-flex items-center gap-2.5">
				<span aria-hidden="true" class="grid size-8 grid-cols-2 gap-0.5 rounded-lg border border-primary/25 bg-primary/10 p-1.5">
					<span class="rounded-[2px] bg-primary"></span>
					<span class="rounded-[2px] bg-primary/45"></span>
					<span class="rounded-[2px] bg-primary/45"></span>
					<span class="rounded-[2px] bg-primary"></span>
				</span>
				<span class="text-lg font-semibold tracking-[-0.04em]">Schtart<span class="text-primary">.</span></span>
			</a>

			<div class="flex flex-col items-end gap-2">
				<div class="flex items-center gap-1.5 sm:gap-2">
					<span class="hidden max-w-36 truncate px-2 text-xs font-medium text-muted-foreground sm:block">
						{data.user.username ?? data.user.name}
					</span>
					{#if data.oidcEnabled}
						<Button
							variant="outline"
							size="sm"
							aria-label={linkingIdentity ? 'Opening identity provider' : 'Link OIDC identity'}
							onclick={linkOidcIdentity}
							disabled={linkingIdentity}
							class="gap-2"
						>
							<Fingerprint aria-hidden="true" size={15} />
							<span class="hidden lg:inline">{linkingIdentity ? 'Opening provider…' : 'Link identity'}</span>
						</Button>
					{/if}
					<Button variant="outline" size="sm" class="gap-2" onclick={() => (editorOpen = true)}>
						<Settings2 aria-hidden="true" size={15} />
						<span class="hidden sm:inline">Edit layout</span>
						<span class="sm:hidden">Layout</span>
					</Button>
					<ThemeToggle />
					<Button
						variant="ghost"
						size="sm"
						aria-label={signingOut ? 'Signing out' : 'Sign out'}
						onclick={signOut}
						disabled={signingOut}
						class="gap-2 px-2 sm:px-2.5"
					>
						<LogOut aria-hidden="true" size={15} />
						<span class="hidden sm:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span>
					</Button>
				</div>
				{#if linkMessage}
					<p class="max-w-sm text-right text-xs text-destructive" role="alert">{linkMessage}</p>
				{/if}
			</div>
		</div>
	</header>

	<div class="mx-auto w-full max-w-7xl px-5 pb-12 pt-8 sm:px-8 sm:pt-11 lg:px-12">
		<div class="flex flex-col justify-between gap-6 border-b border-border/75 pb-7 md:flex-row md:items-end">
			<div>
				<div class="mb-4 inline-flex items-center gap-2 text-[0.67rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
					<LayoutGrid aria-hidden="true" size={14} class="text-primary" />
					Your personal starting point
				</div>
				<h1 class="font-heading text-5xl leading-[0.95] font-normal tracking-[-0.04em] text-heading sm:text-6xl">
					{activePageLabel}<span class="text-heading-accent">.</span>
				</h1>
				<p class="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{activePageDescription}</p>
			</div>
			<div class="flex items-center gap-2 pb-1 text-xs text-muted-foreground">
				<span class="size-1.5 rounded-full bg-primary"></span>
				{#if configurationSource === 'user'}
					Your personal layout
				{:else}
					Following the shared default
				{/if}
			</div>
		</div>

		<nav class="-mx-1 flex gap-1 overflow-x-auto py-4" aria-label="Dashboard pages">
			{#each DASHBOARD_PAGES as page}
				<button
					type="button"
					aria-current={activePage === page ? 'page' : undefined}
					onclick={() => (activePage = page)}
					class="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background {activePage === page ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					{DASHBOARD_PAGE_LABELS[page]}
				</button>
			{/each}
		</nav>

		{#if loading}
			<div class="grid gap-5 lg:grid-cols-2" aria-label="Loading dashboard" aria-busy="true">
				{#each [1, 2, 3, 4] as placeholder}
					<div class="h-52 animate-pulse rounded-xl border border-border bg-card/70" aria-hidden="true"></div>
				{/each}
			</div>
		{:else if pageError}
			<section class="rounded-xl border border-border bg-card px-6 py-8 text-center" aria-live="polite">
				<p class="text-sm text-destructive" role="alert">{pageError}</p>
				<Button class="mt-4 gap-2" variant="outline" onclick={loadConfiguration}>
					Try again <ArrowRight aria-hidden="true" size={14} />
				</Button>
			</section>
		{:else if activeLayout}
			<div class={`grid gap-5 ${activeLayout.columns.length === 2 ? 'lg:grid-cols-2' : activeLayout.columns.length === 3 ? 'lg:grid-cols-3' : ''}`}>
				{#each activeLayout.columns as column, columnIndex}
					<section class="flex min-w-0 flex-col gap-5" aria-label={`${activePageLabel} column ${columnIndex + 1}`}>
						{#each column as widget}
							<DashboardWidgetCard {widget} />
						{/each}
					</section>
				{/each}
			</div>
		{/if}

		<footer class="mt-10 flex flex-col gap-2 border-t border-border/75 pt-4 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
			<p>Example widgets are placeholders. No external feeds or monitoring sources are connected.</p>
			<p>Private by design <span class="mx-1 text-border">·</span> Pages are yours to arrange</p>
		</footer>
	</div>

	{#if signOutError}
		<p class="fixed bottom-4 right-4 max-w-sm rounded-lg border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive shadow-lg" role="alert">{signOutError}</p>
	{/if}
	{#if editorOpen}
		<DashboardConfigurationEditor
			initialYaml={configurationYaml}
			onClose={() => (editorOpen = false)}
			onSaved={applyConfiguration}
		/>
	{/if}
</main>
