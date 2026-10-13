<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { Plus } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
	import PoDialog from '#lib/features/purchasing/PoDialog.svelte';
	import PoFormDialog from '#lib/features/purchasing/PoFormDialog.svelte';
	import ReturnDialog from '#lib/features/purchasing/ReturnDialog.svelte';
	import { get } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { date, dateTime, idr } from '#lib/utils/format';
	import type { GRNRow, PORow, PurchaseReturnRow } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	let tab = $state<'po' | 'grn' | 'ret'>('po');
	let status = $state('');
	let search = $state('');
	let pageNo = $state(1);
	let creating = $state(false);
	let returning = $state(false);
	let openId = $state<string | null>(page.url.searchParams.get('id')); // deep link from the approval inbox
	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);

	const pos = createQuery(() => ({ queryKey: ['pos', storeId, status, search, pageNo], enabled: tab === 'po', queryFn: () => get<PORow[]>('/purchase-orders', { store_id: storeId, status, q: search, page: pageNo, per_page: 30 }) }));
	const grns = createQuery(() => ({ queryKey: ['grns', 'list', storeId], enabled: tab === 'grn', queryFn: async () => (await get<GRNRow[]>('/goods-receipts', { store_id: storeId, per_page: 50 })).data }));
	const rets = createQuery(() => ({ queryKey: ['returns'], enabled: tab === 'ret', queryFn: async () => (await get<PurchaseReturnRow[]>('/purchase-returns', { per_page: 50 })).data }));
	const canCreate = $derived(can(data.me.grants, 'purchase_order.create'));
	const canReturn = $derived(can(data.me.grants, 'purchase_return.create'));
</script>

<PageHeader title="Pembelian" description="{scope.label} · purchase order, penerimaan barang, dan retur ke supplier">
	{#snippet actions()}
		{#if tab === 'ret' && canReturn}<Button onclick={() => (returning = true)}><Plus class="size-4" />Retur ke supplier</Button>{/if}
		{#if canCreate}<Button onclick={() => (creating = true)}><Plus class="size-4" />Buat PO</Button>{/if}
	{/snippet}
</PageHeader>

<div class="mb-3 flex items-center justify-between">
	<div class="inline-flex rounded-md border border-border bg-surface p-0.5" role="tablist">
		{#each [['po', 'Purchase order'], ['grn', 'Penerimaan (GRN)'], ['ret', 'Retur supplier']] as [k, label]}
			<button role="tab" aria-selected={tab === k} class="rounded px-3 py-1.5 aria-selected:bg-primary aria-selected:text-primary-fg" onclick={() => (tab = k as typeof tab)}>{label}</button>
		{/each}
	</div>
	{#if tab === 'po'}
		<div class="flex gap-2">
			<Input class="w-44" placeholder="No. dokumen" bind:value={search} oninput={() => (pageNo = 1)} />
			<Select class="w-48" bind:value={status} onchange={() => (pageNo = 1)}>
				<option value="">Semua status</option><option value="draft">Draft</option><option value="submitted">Menunggu persetujuan</option><option value="approved">Disetujui</option><option value="partially_received">Diterima sebagian</option><option value="received">Diterima</option><option value="cancelled">Dibatalkan</option>
			</Select>
		</div>
	{/if}
</div>

<Card>
	{#if tab === 'po'}
		{#if pos.isPending}<Empty title="Memuat…" />
		{:else if pos.isError}<Empty title="Gagal memuat" hint={pos.error.message} />
		{:else if !pos.data.data.length}<Empty title="Belum ada purchase order" hint={canCreate ? 'Klik “Buat PO” untuk memesan barang ke supplier.' : undefined} />
		{:else}
			<table class="w-full text-left">
				<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Dokumen</th><th>Supplier</th><th>Tujuan</th><th>Dibuat</th><th class="text-right">Total</th><th class="pr-4">Status</th></tr></thead>
				<tbody>
					{#each pos.data.data as p (p.id)}
						<tr class="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60" onclick={() => (openId = p.id)}>
							<td class="px-4 py-2.5 font-mono text-[13px]">{p.document_number}</td><td>{p.supplier_name}</td><td class="text-muted">{p.store_name ?? 'Pusat'} / {p.warehouse_code}</td>
							<td class="num text-muted">{dateTime(p.created_at)}</td><td class="num text-right">{idr(p.total)}</td><td class="pr-4"><StatusBadge status={p.status} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if pos.data.meta && pos.data.meta.total_pages > 1}
				<div class="flex items-center justify-between border-t border-border px-4 py-2"><span class="text-muted">{pos.data.meta.total} PO</span>
					<div class="flex gap-2"><Button size="sm" variant="secondary" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button><Button size="sm" variant="secondary" disabled={pageNo >= pos.data.meta.total_pages} onclick={() => pageNo++}>Berikutnya</Button></div></div>
			{/if}
		{/if}
	{:else if tab === 'grn'}
		{#if grns.isPending}<Empty title="Memuat…" />
		{:else if !grns.data?.length}<Empty title="Belum ada penerimaan barang" hint="Buka PO yang sudah disetujui lalu klik “Terima barang”." />
		{:else}
			<table class="w-full text-left">
				<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Dokumen</th><th>Supplier</th><th>Gudang</th><th>PO</th><th>Surat jalan</th><th>Tanggal</th><th class="pr-4 text-right">Nilai</th></tr></thead>
				<tbody>{#each grns.data as g (g.id)}<tr class="border-b border-border last:border-0"><td class="px-4 py-2.5 font-mono text-[13px]">{g.document_number}</td><td>{g.supplier_name}</td><td class="text-muted">{g.store_name ?? 'Pusat'} / {g.warehouse_code}</td><td class="font-mono text-[12px] text-muted">{g.po_number ?? 'langsung'}</td><td>{g.supplier_ref || '—'}</td><td class="num text-muted">{date(g.received_date)}</td><td class="num pr-4 text-right">{idr(g.total_cost)}</td></tr>{/each}</tbody>
			</table>
		{/if}
	{:else if rets.isPending}<Empty title="Memuat…" />
	{:else if !rets.data?.length}<Empty title="Belum ada retur ke supplier" />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Dokumen</th><th>Supplier</th><th>Gudang</th><th>Alasan</th><th>Tanggal</th><th class="pr-4 text-right">Nilai</th></tr></thead>
			<tbody>{#each rets.data as r (r.id)}<tr class="border-b border-border last:border-0"><td class="px-4 py-2.5 font-mono text-[13px]">{r.document_number}</td><td>{r.supplier_name}</td><td class="text-muted">{r.store_name ?? 'Pusat'} / {r.warehouse_code}</td><td>{r.reason}</td><td class="num text-muted">{dateTime(r.created_at)}</td><td class="num pr-4 text-right">{idr(r.total_cost)}</td></tr>{/each}</tbody>
		</table>
	{/if}
</Card>

<PoFormDialog bind:open={creating} me={data.me} oncreated={(p) => (openId = p.id)} />
<PoDialog bind:poId={openId} me={data.me} />
<ReturnDialog bind:open={returning} />
