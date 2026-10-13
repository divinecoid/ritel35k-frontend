<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		label: string;
		error?: string;
		hint?: string;
		for?: string;
		children: Snippet;
	}
	let { label, error, hint, for: forId, children }: Props = $props();
</script>

<div class="space-y-1">
	<label class="block text-[13px] font-medium" for={forId}>{label}</label>
	{@render children()}
	{#if error}<p class="text-[12px] text-danger" role="alert">{error}</p>
	{:else if hint}<p class="text-[12px] text-muted">{hint}</p>{/if}
</div>
