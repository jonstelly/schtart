<script lang="ts">
	import AuthForm from '../../lib/components/AuthForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<AuthForm mode="register" passwordEnabled={data.passwordEnabled} oidcEnabled={data.oidcEnabled} />
