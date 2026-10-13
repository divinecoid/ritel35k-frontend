<script lang="ts">
	import { toast } from './toast.svelte';
</script>

<div class="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
	{#each toast.items as t (t.id)}
		<div class="pointer-events-auto rounded-md border px-3 py-2 shadow-lg {t.kind === 'ok' ? 'border-ok/40 bg-surface' : 'border-danger/40 bg-surface'}">
			<span class={t.kind === 'ok' ? 'text-ok' : 'text-danger'}>{t.kind === 'ok' ? '✓' : '!'}</span>
			{t.text}
		</div>
	{/each}
</div>
