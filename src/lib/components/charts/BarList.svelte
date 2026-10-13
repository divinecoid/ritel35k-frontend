<script lang="ts">
	/** Ranked horizontal bars: label, value text and a share bar. Rows can be clickable (drill-down). */
	let { rows, onselect }: { rows: { key: string; label: string; sub?: string; value: string; share: number; tone?: 'primary' | 'ok' | 'warn' }[]; onselect?: (key: string) => void } = $props();
	const bar = { primary: 'bg-primary', ok: 'bg-ok', warn: 'bg-warn' };
</script>

<ul class="space-y-2.5">
	{#each rows as r (r.key)}
		<li>
			{#if onselect}
				<button type="button" class="block w-full text-left" onclick={() => onselect(r.key)}>{@render row(r)}</button>
			{:else}
				{@render row(r)}
			{/if}
		</li>
	{/each}
</ul>

{#snippet row(r: (typeof rows)[number])}
	<div class="flex items-baseline justify-between gap-3">
		<span class="min-w-0 truncate">{r.label}{#if r.sub}<span class="ml-1.5 text-[12px] text-muted">{r.sub}</span>{/if}</span>
		<span class="num shrink-0 font-medium">{r.value}</span>
	</div>
	<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div class="h-full rounded-full {bar[r.tone ?? 'primary']}" style="width:{Math.max(1, Math.min(100, r.share))}%"></div></div>
{/snippet}
