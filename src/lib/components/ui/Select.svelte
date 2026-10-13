<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/cn';
	let { value = $bindable(), class: cls, children, ...rest }: HTMLSelectAttributes = $props();
</script>

<select
	bind:value
	class={cn('h-9 w-full rounded-md border border-border bg-surface px-2 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60', cls)}
	{...rest}
>
	{@render children?.()}
</select>
