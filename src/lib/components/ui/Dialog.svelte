<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from '@lucide/svelte';

	interface Props {
		open: boolean;
		title: string;
		onclose?: () => void;
		children: Snippet;
		footer?: Snippet;
		wide?: boolean;
	}
	let { open = $bindable(), title, onclose, children, footer, wide = false }: Props = $props();
	let el: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!el) return;
		if (open && !el.open) el.showModal();
		if (!open && el.open) el.close();
	});
</script>

<dialog
	bind:this={el}
	onclose={() => {
		open = false;
		onclose?.();
	}}
	onclick={(e) => e.target === el && (open = false)}
	class="m-auto w-full rounded-lg border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/40 {wide ? 'max-w-2xl' : 'max-w-md'}"
>
	{#if open}
		<div class="flex items-center justify-between border-b border-border px-5 py-3">
			<h2 class="text-base font-semibold">{title}</h2>
			<button class="rounded p-1 text-muted hover:bg-surface-2" aria-label="Tutup" onclick={() => (open = false)}><X class="size-4" /></button>
		</div>
		<div class="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">{@render children()}</div>
		{#if footer}<div class="flex justify-end gap-2 border-t border-border px-5 py-3">{@render footer()}</div>{/if}
	{/if}
</dialog>
