<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { Plus } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import CountFormDialog from '#lib/features/stockcount/CountFormDialog.svelte';
	import { get } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { dateTime } from '#lib/utils/format';
	import type { CountRow } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	let creating = $state(false);
	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const list = createQuery(() => ({ queryKey: ['counts', storeId], queryFn: async () => (await get<CountRow[]>('/stock-counts', { store_id: storeId, per_page: 100 })).data }));
	const tone = { counting: 'warn', submitted: 'info', approved: 'ok', cancelled: 'danger' } as const;
	const label = { counting: 'Sedang dihitung', submitted: 'Menunggu persetujuan', approved: 'Selesai', cancelled: 'Dibatalkan' } as const;
	const kind = { full: 'Seluruh stok', partial: 'Barang tertentu', category: 'Per kategori', cycle: 'Cycle count' } as const;
</script>

<PageHeader title="Stok opname" description="{scope.label} · hitung fisik, bandingkan dengan sistem, setujui selisih">
	{#snippet actions()}{#if can(data.me.grants, 'inventory.count')}<Button onclick={() => (creating = true)}><Plus class="size-4" />Mulai opname</Button>{/if}{/snippet}
</PageHeader>

<Card>
	{#if list.isPending}<Empty title="Memuat…" />
	{:else if list.isError}<Empty title="Gagal memuat" hint={list.error.message} />
	{:else if !list.data.length}<Empty title="Belum ada opname" />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Dokumen</th><th>Jenis</th><th>Gudang</th><th>Dimulai</th><th>Progres</th><th class="pr-4">Status</th></tr></thead>
			<tbody>
				{#each list.data as c (c.id)}
					<tr class="border-b border-border last:border-0 hover:bg-surface-2/60">
						<td class="px-4 py-2.5"><a class="font-mono text-[13px] text-primary hover:underline" href="/stock-counts/{c.id}">{c.document_number}</a></td>
						<td>{kind[c.kind as keyof typeof kind] ?? c.kind}</td><td class="text-muted">{c.store_name ?? 'Pusat'} / {c.warehouse_code}</td>
						<td class="num text-muted">{dateTime(c.snapshot_at)}</td><td class="num">{c.counted_count}/{c.item_count}</td>
						<td class="pr-4"><Badge tone={tone[c.status]}>{label[c.status]}</Badge></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<CountFormDialog bind:open={creating} me={data.me} />
