<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/cn';
	let { value = $bindable(), class: cls, ...rest }: HTMLInputAttributes = $props();
</script>

<input
	bind:value
	class={cn(
		'h-9 w-full rounded-md border border-border bg-surface px-3 placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60',
		cls
	)}
	{...rest}
/>
