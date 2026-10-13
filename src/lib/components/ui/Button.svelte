<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/cn';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		loading?: boolean;
		children: Snippet;
	}
	let { variant = 'primary', size = 'md', loading = false, class: cls, children, disabled, ...rest }: Props = $props();

	const variants = {
		primary: 'bg-primary text-primary-fg hover:opacity-90',
		secondary: 'bg-surface border border-border hover:bg-surface-2',
		ghost: 'hover:bg-surface-2',
		danger: 'bg-danger text-white hover:opacity-90'
	};
</script>

<button
	class={cn(
		'inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50',
		size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-4',
		variants[variant],
		cls
	)}
	disabled={disabled || loading}
	{...rest}
>
	{#if loading}<span class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>{/if}
	{@render children()}
</button>
