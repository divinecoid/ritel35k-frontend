<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/cn';
	let { class: cls, children }: { class?: string; children: Snippet } = $props();
</script>

<div class={cn('rounded-lg border border-border bg-surface', cls)}>{@render children()}</div>
