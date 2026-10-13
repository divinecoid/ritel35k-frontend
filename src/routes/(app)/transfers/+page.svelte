<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { Plus } from '@lucide/svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
	import TransferDialog from '#lib/features/transfers/TransferDialog.svelte';
	import TransferFormDialog from '#lib/features/transfers/TransferFormDialog.svelte';
	import { get } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { dateTime } from '#lib/utils/format';
	import type { TransferRow } from '#lib/types/api';

	let { data } = $props();
	let status = $state('');
	let creating = $state(false);
	let openId = $state<string | null>(page.url.searchParams.get('id')); // deep link from the approval inbox
	const list = createQuery(() => ({ queryKey: ['transfers', status], queryFn: async () => (await get<TransferRow[]>('/stock-transfers', { status, per_page: 100 })).data }));
	const canCreate = $derived(can(data.me.grants, 'inventory.transfer'));
</script>

<PageHeader title="Transfer stok" description="Antar toko dan gudang pusat — barang yang dikirim tercatat “dalam perjalanan” sampai diterima">
	{#snippet actions()}
		<Select class="w-48" bind:value={status}><option value="">Semua status</option><option value="draft">Draft</option><option value="submitted">Menunggu persetujuan</option><option value="approved">Disetujui</option><option value="shipped">Dalam perjalanan</option><option value="received">Diterima</option><option value="cancelled">Dibatalkan</option></Select>
		{#if canCreate}<Button onclick={() => (creating = true)}><Plus class="size-4" />Transfer baru</Button>{/if}
	{/snippet}
</PageHeader>

<Card>
	{#if list.isPending}<Empty title="Memuat…" />
	{:else if list.isError}<Empty title="Gagal memuat" hint={list.error.message} />
	{:else if !list.data.length}<Empty title="Belum ada transfer" />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Dokumen</th><th>Dari</th><th>Ke</th><th>Baris</th><th>Dibuat</th><th class="pr-4">Status</th></tr></thead>
			<tbody>
				{#each list.data as t (t.id)}
					<tr class="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60" onclick={() => (openId = t.id)}>
						<td class="px-4 py-2.5 font-mono text-[13px]">{t.document_number}</td>
						<td>{t.from_store_name ?? 'Pusat'} <span class="font-mono text-[12px] text-muted">{t.from_code}</span></td>
						<td>{t.to_store_name ?? 'Pusat'} <span class="font-mono text-[12px] text-muted">{t.to_code}</span></td>
						<td class="num text-muted">{t.line_count}</td><td class="num text-muted">{dateTime(t.created_at)}</td><td class="pr-4"><StatusBadge status={t.status} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<TransferFormDialog bind:open={creating} me={data.me} oncreated={(t) => (openId = t.id)} />
<TransferDialog bind:transferId={openId} me={data.me} />
