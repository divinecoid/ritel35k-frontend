<script lang="ts">
	import { idr } from '#lib/utils/format';

	/** 24 columns for the hourly sales distribution; the busiest hour is highlighted. */
	let { hours, height = 120 }: { hours: { hour: number; transactions: number; value: number }[]; height?: number } = $props();
	const max = $derived(Math.max(1, ...hours.map((h) => h.value)));
	const peak = $derived(hours.reduce((b, h) => (h.value > b.value ? h : b), hours[0] ?? { hour: -1, value: 0, transactions: 0 }));
</script>

<div>
	<div class="flex items-end gap-[3px]" style="height:{height}px" role="img" aria-label="Penjualan per jam">
		{#each hours as h (h.hour)}
			<div class="group relative flex h-full flex-1 items-end">
				<div class="w-full rounded-t-sm {h.hour === peak.hour && h.value > 0 ? 'bg-primary' : 'bg-primary/35'}" style="height:{Math.max(h.value > 0 ? 3 : 0, (h.value / max) * 100)}%"></div>
				<div class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded border border-border bg-surface px-2 py-1 text-[11px] whitespace-nowrap shadow-sm group-hover:block">
					{String(h.hour).padStart(2, '0')}:00 · {idr(h.value)} · {h.transactions} trx
				</div>
			</div>
		{/each}
	</div>
	<div class="mt-1 flex justify-between text-[11px] text-muted"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
</div>
