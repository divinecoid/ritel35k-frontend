<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { SlidersHorizontal } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import AdjustDialog from '#lib/features/inventory/AdjustDialog.svelte';
	import { get } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { dateTime, idr, num } from '#lib/utils/format';
	import type { Balance, Movement } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	let tab = $state<'balances' | 'movements'>('balances');
	let search = $state('');
	let low = $state(false);
	let pageNo = $state(1);
	let adjusting = $state(false);
	const canAdjust = $derived(can(data.me.grants, 'inventory.adjust'));
	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const underPath = $derived(scope.storeId === 'all' ? scope.path : undefined);

	const balances = createQuery(() => ({
		queryKey: ['balances', storeId, underPath, search, low, pageNo],
		enabled: tab === 'balances',
		queryFn: () => get<Balance[]>('/inventory/balances', { store_id: storeId, under_path: underPath, q: search, low: low ? 'true' : undefined, page: pageNo, per_page: 50 })
	}));
	const moves = createQuery(() => ({
		queryKey: ['movements', storeId],
		enabled: tab === 'movements',
		queryFn: async () => (await get<Movement[]>('/inventory/movements', { store_id: storeId, per_page: 100 })).data
	}));
	const typeTone = (t: string) => (t.startsWith('SALE_RET') || t === 'OPENING' || t === 'PURCHASE' || t === 'SALE_VOID' ? 'ok' : t === 'SALE' ? 'info' : 'warn');
	const showStore = $derived(scope.storeId === 'all');
</script>

<PageHeader title="Inventori" description="{scope.label} · stok per gudang dari ledger yang tidak bisa diubah">
	{#snippet actions()}
		{#if canAdjust}<Button onclick={() => (adjusting = true)}><SlidersHorizontal class="size-4" />Penyesuaian stok</Button>{/if}
	{/snippet}
</PageHeader>

<div class="mb-3 flex items-center justify-between">
	<div class="inline-flex rounded-md border border-border bg-surface p-0.5" role="tablist">
		{#each [['balances', 'Saldo stok'], ['movements', 'Riwayat pergerakan']] as [k, label]}
			<button role="tab" aria-selected={tab === k} class="rounded px-3 py-1.5 aria-selected:bg-primary aria-selected:text-primary-fg" onclick={() => (tab = k as typeof tab)}>{label}</button>
		{/each}
	</div>
	{#if tab === 'balances'}
		<div class="flex items-center gap-3">
			<label class="flex items-center gap-1.5 text-muted"><input type="checkbox" bind:checked={low} onchange={() => (pageNo = 1)} />Stok menipis</label>
			<Input class="w-64" placeholder="Cari nama / SKU / barcode" bind:value={search} oninput={() => (pageNo = 1)} />
		</div>
	{/if}
</div>

<Card>
	{#if tab === 'balances'}
		{#if balances.isPending}<Empty title="Memuat…" />
		{:else if balances.isError}<Empty title="Gagal memuat" hint={balances.error.message} />
		{:else if !balances.data.data.length}<Empty title="Belum ada stok" hint="Gunakan Penyesuaian stok → Stok awal untuk mengisi stok toko." />
		{:else}
			<table class="w-full text-left">
				<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Produk</th><th>SKU</th>{#if showStore}<th>Toko</th>{/if}<th>Gudang</th><th class="text-right">Stok</th><th class="text-right">HPP rata-rata</th><th class="pr-4 text-right">Nilai</th></tr></thead>
				<tbody>
					{#each balances.data.data as b (b.warehouse_id + b.variant_id)}
						{@const n = Number(b.on_hand)}
						<tr class="border-b border-border last:border-0">
							<td class="px-4 py-2.5 font-medium">{b.product_name}</td>
							<td class="font-mono text-[13px] text-muted">{b.sku}</td>
							{#if showStore}<td>{b.store_name ?? '—'}</td>{/if}
							<td class="text-muted">{b.warehouse_code}</td>
							<td class="num text-right"><span class={n < 0 ? 'font-semibold text-danger' : n <= Number(b.reorder_point) ? 'font-semibold text-warn' : ''}>{num(b.on_hand)}</span></td>
							<td class="num text-right text-muted">{idr(b.avg_cost)}</td>
							<td class="num pr-4 text-right">{idr(n * Number(b.avg_cost))}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if balances.data.meta}
				<div class="flex items-center justify-between border-t border-border px-4 py-2">
					<span class="text-muted">{balances.data.meta.total} baris</span>
					<div class="flex gap-2">
						<Button size="sm" variant="secondary" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button>
						<Button size="sm" variant="secondary" disabled={pageNo >= balances.data.meta.total_pages} onclick={() => pageNo++}>Berikutnya</Button>
					</div>
				</div>
			{/if}
		{/if}
	{:else if moves.isPending}<Empty title="Memuat…" />
	{:else if moves.isError}<Empty title="Gagal memuat" hint={moves.error.message} />
	{:else if !moves.data.length}<Empty title="Belum ada pergerakan stok" />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Waktu</th><th>Jenis</th><th>Produk</th><th class="text-right">Qty</th><th class="text-right">Saldo</th><th class="pr-4">Dokumen</th></tr></thead>
			<tbody>
				{#each moves.data as m (m.id)}
					<tr class="border-b border-border last:border-0">
						<td class="num px-4 py-2 whitespace-nowrap text-muted">{dateTime(m.created_at)}</td>
						<td><Badge tone={typeTone(m.movement_type)}>{m.movement_type}</Badge></td>
						<td>{m.product_name} <span class="font-mono text-[12px] text-muted">{m.sku}</span></td>
						<td class="num text-right {Number(m.qty_delta) < 0 ? 'text-danger' : 'text-ok'}">{Number(m.qty_delta) > 0 ? '+' : ''}{num(m.qty_delta)}</td>
						<td class="num text-right">{num(m.balance_after)}</td>
						<td class="pr-4 font-mono text-[12px] text-muted">{m.document_number || m.note || '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<AdjustDialog bind:open={adjusting} me={data.me} />
