<script lang="ts">
	import AuthForm from '../../lib/components/AuthForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<AuthForm mode="setup" passwordEnabled={data.passwordEnabled} oidcEnabled={data.oidcEnabled} />
