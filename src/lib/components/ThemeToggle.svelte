<script lang="ts">
	import { onMount } from 'svelte';
	import { Moon, Sun } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button';

	let isDark = $state(true);

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
	});

	function toggleTheme() {
		isDark = !isDark;
		document.documentElement.classList.toggle('dark', isDark);
		try {
			localStorage.setItem('schtart-theme', isDark ? 'dark' : 'light');
		} catch {
			// Keep the in-memory selection when browser storage is unavailable.
		}
	}
</script>

<Button
	variant="ghost"
	size="icon"
	class="rounded-full text-muted-foreground hover:text-foreground"
	aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
	title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
	onclick={toggleTheme}
>
	{#if isDark}
		<Sun aria-hidden="true" />
	{:else}
		<Moon aria-hidden="true" />
	{/if}
</Button>
