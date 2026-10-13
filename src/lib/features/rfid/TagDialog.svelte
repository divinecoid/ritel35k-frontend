<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import { get } from '#lib/api/client';
	import { dateTime } from '#lib/utils/format';
	import type { RfidTagDetail } from '#lib/types/api';
	import { tagLabel, tagTone } from './status';

	let { epc = $bindable() }: { epc: string | null } = $props();
	let open = $state(false);
	$effect(() => { open = !!epc; });
	$effect(() => { if (!open) epc = null; });
	const q = createQuery(() => ({ queryKey: ['rfid', 'tag', epc], enabled: !!epc, queryFn: async () => (await get<RfidTagDetail>(`/rfid/tags/${epc}`)).data }));
	const t = $derived(q.data);
</script>

<Dialog bind:open title="Detail tag" wide>
	{#if !t}<p class="text-muted">Memuat…</p>
	{:else}
		<div class="flex items-center justify-between"><p class="font-mono text-[13px] break-all">{t.epc}</p><Badge tone={tagTone[t.status]}>{tagLabel[t.status]}</Badge></div>
		<dl class="grid grid-cols-2 gap-x-6 gap-y-2">
			<div><dt class="text-[12px] text-muted">Produk</dt><dd>{t.product_name} {t.variant_name}<br /><span class="font-mono text-[12px] text-muted">{t.sku}</span></dd></div>
			<div><dt class="text-[12px] text-muted">Lokasi</dt><dd>{t.store_name || 'Gudang pusat'}{t.location ? ` · ${t.location}` : ''}</dd></div>
			<div><dt class="text-[12px] text-muted">Terakhir terbaca</dt><dd>{dateTime(t.last_seen_at)}</dd></div>
			{#if t.sold_at}<div><dt class="text-[12px] text-muted">Terjual</dt><dd>{dateTime(t.sold_at)}</dd></div>{/if}
		</dl>
		<h3 class="font-semibold">Riwayat pembacaan</h3>
		{#if !t.history.length}<p class="text-muted">Belum pernah terbaca oleh reader.</p>
		{:else}
			<table class="w-full text-left text-[13px]">
				<thead class="text-[11px] text-muted uppercase"><tr><th>Waktu</th><th>Reader</th><th>Arah</th><th>Keputusan</th></tr></thead>
				<tbody>
					{#each t.history as h (h.id)}
						<tr class="border-t border-border"><td class="py-1.5">{dateTime(h.read_at)}</td><td>{h.reader_code}</td><td class="text-muted">{h.direction}</td><td><Badge tone={h.decision === 'alarm' ? 'danger' : h.decision === 'allow' ? 'ok' : 'neutral'}>{h.decision}</Badge> <span class="text-muted">{h.reason}</span></td></tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{/if}
</Dialog>
