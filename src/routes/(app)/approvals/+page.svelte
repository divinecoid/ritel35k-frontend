<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { get } from '#lib/api/client';
	import { ago, idr } from '#lib/utils/format';
	import type { ApprovalInbox } from '#lib/types/api';

	let type = $state<'' | 'purchase_order' | 'stock_transfer' | 'stock_count'>('');
	const inbox = createQuery(() => ({ queryKey: ['approvals'], queryFn: async () => (await get<ApprovalInbox>('/approvals')).data }));
	const names = { purchase_order: 'Purchase order', stock_transfer: 'Transfer stok', stock_count: 'Stok opname' } as const;
	const items = $derived((inbox.data?.items ?? []).filter((i) => !type || i.type === type));
</script>

<PageHeader title="Persetujuan" description="Dokumen yang menunggu keputusan Anda — yang paling lama menunggu di atas" />

{#if inbox.data}
	<div class="mb-4 flex flex-wrap gap-2" role="tablist">
		<button role="tab" aria-selected={type === ''} class="rounded-md px-3 py-1.5 aria-selected:bg-primary aria-selected:text-primary-fg border border-border" onclick={() => (type = '')}>Semua ({inbox.data.total})</button>
		{#each Object.entries(names) as [k, label]}
			{#if k in inbox.data.counts && (inbox.data.counts[k] > 0 || type === k)}
				<button role="tab" aria-selected={type === k} class="rounded-md border border-border px-3 py-1.5 aria-selected:bg-primary aria-selected:text-primary-fg" onclick={() => (type = k as typeof type)}>{label} ({inbox.data.counts[k]})</button>
			{/if}
		{/each}
	</div>
{/if}

<Card>
	{#if inbox.isPending}<Empty title="Memuat…" />
	{:else if inbox.isError}<Empty title="Gagal memuat" hint={inbox.error.message} />
	{:else if !items.length}<Empty title="Tidak ada yang menunggu" hint="Dokumen yang diajukan dan butuh persetujuan Anda akan muncul di sini." />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Dokumen</th><th class="px-3">Jenis</th><th class="px-3">Lokasi</th><th class="px-3 text-right">Nilai</th><th class="px-3">Diajukan oleh</th><th class="px-3 pr-4 text-right">Menunggu</th></tr></thead>
			<tbody>
				{#each items as i (i.type + i.id)}
					<tr class="border-b border-border last:border-0 hover:bg-surface-2/60">
						<td class="px-4 py-2.5"><a href={i.href} class="font-mono text-[13px] text-primary hover:underline">{i.document_number}</a></td>
						<td class="px-3">{names[i.type]}</td>
						<td class="px-3 text-muted">{i.subtitle}</td>
						<td class="num px-3 text-right">{i.amount ? idr(i.amount) : '—'}{#if i.type === 'stock_count' && i.amount}<span class="block text-[12px] text-muted">selisih</span>{/if}</td>
						<td class="px-3">{i.requested_by}{#if i.own} <Badge tone="warn">Anda</Badge>{/if}</td>
						<td class="num px-3 pr-4 text-right text-muted">{i.requested_at ? ago(i.requested_at) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>
