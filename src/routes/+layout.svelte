<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>Schtart — Your personal start page</title>
	<meta
		name="description"
		content="A personal starting point for your day, with sports as one part of the picture."
	/>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
