<script lang="ts">
	import { Activity, Check, Newspaper, Trophy, Waves } from '@lucide/svelte';
	import type { DashboardWidgetConfiguration } from '../dashboard';
	import { newsExamples, serviceExamples, sportsExamples } from '../dashboard-widget-examples';

	let { widget }: { widget: DashboardWidgetConfiguration } = $props();

	const widgetDetails = {
		welcome: { title: 'A clear start', label: 'Daily brief', icon: Waves },
		'news-headlines': { title: 'Worth a look', label: 'Newsroom', icon: Newspaper },
		'sports-scores': { title: 'On the board', label: 'Sports', icon: Trophy },
		'system-status': { title: 'All in view', label: 'System pulse', icon: Activity }
	} as const;

	const detail = $derived({
		...widgetDetails[widget.widget],
		label: widget.widget === 'sports-scores' ? widget.league ?? 'Sports' : widgetDetails[widget.widget].label
	});
	const WidgetIcon = $derived(detail.icon);
</script>

<article class="overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-foreground/[0.03]">
	<div class="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
		<div class="flex min-w-0 items-center gap-3">
			<span class="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
				<WidgetIcon aria-hidden="true" size={17} />
			</span>
			<div class="min-w-0">
				<p class="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{detail.label}</p>
				<h2 class="mt-1 truncate text-base font-semibold tracking-tight text-foreground">{detail.title}</h2>
			</div>
		</div>
		<span class="shrink-0 rounded-full border border-border bg-muted/70 px-2 py-1 text-[0.62rem] font-medium text-muted-foreground">Sample</span>
	</div>

	<div class="px-5 py-4">
		{#if widget.widget === 'welcome'}
			<p class="font-heading text-2xl leading-tight text-heading">Your day, in view.</p>
			<p class="mt-2 text-sm leading-6 text-muted-foreground">A personal place to bring the things you follow into focus.</p>
		{:else if widget.widget === 'news-headlines'}
			<ul class="divide-y divide-border/70">
				{#each newsExamples.slice(0, widget.count ?? 3) as item}
					<li class="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
						<div>
							<p class="text-sm leading-5 font-medium text-foreground">{item.title}</p>
							<p class="mt-1 text-xs text-muted-foreground">{item.detail}</p>
						</div>
					</li>
				{/each}
			</ul>
		{:else if widget.widget === 'sports-scores'}
			<ul class="space-y-3">
				{#each sportsExamples as game}
					<li class="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-xs">
						<span class="min-w-0 truncate font-medium text-foreground">{game.away} <span class="text-muted-foreground">at</span> {game.home}</span>
						<span class="shrink-0 font-semibold tabular-nums text-foreground">{game.score}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<ul class="space-y-3">
				{#each serviceExamples as service}
					<li class="flex items-center justify-between gap-3 text-sm">
						<span class="text-foreground">{service.name}</span>
						<span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Check aria-hidden="true" class="text-primary" size={13} />{service.status}</span>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="mt-4 border-t border-border/70 pt-3 text-[0.68rem] leading-5 text-muted-foreground">
			{#if widget.widget === 'sports-scores'}
				Illustrative scores only — not live data.
			{:else}
				Example content only — no external feeds are connected.
			{/if}
		</p>
	</div>
</article>
