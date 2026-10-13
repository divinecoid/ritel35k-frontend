<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, description, actions }: { title: string; description?: string; actions?: Snippet } = $props();
</script>

<div class="mb-5 flex flex-wrap items-start justify-between gap-3">
	<div>
		<h1 class="text-xl font-semibold tracking-tight">{title}</h1>
		{#if description}<p class="mt-0.5 text-muted">{description}</p>{/if}
	</div>
	{#if actions}<div class="flex items-center gap-2">{@render actions()}</div>{/if}
</div>
