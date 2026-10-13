<script lang="ts">
	import '../app.css';
	import { browser } from '$app/env';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import Toaster from '#lib/components/ui/Toaster.svelte';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();

	const client = new QueryClient({
		defaultOptions: { queries: { enabled: browser, staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } }
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>RITEL35K</title>
</svelte:head>

<QueryClientProvider {client}>
	{@render children()}
	<Toaster />
</QueryClientProvider>
