<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import SaleDialog from '#lib/features/pos/SaleDialog.svelte';
	import { get } from '#lib/api/client';
	import { useScope } from '#lib/scope/scope.svelte';
	import { dateTime, idr } from '#lib/utils/format';
	import type { SaleRow } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	let search = $state('');
	let status = $state('');
	let from = $state('');
	let to = $state('');
	let pageNo = $state(1);
	let openId = $state<string | null>(null);
	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const underPath = $derived(scope.storeId === 'all' ? scope.path : undefined);

	const sales = createQuery(() => ({
		queryKey: ['sales', storeId, underPath, search, status, from, to, pageNo],
		queryFn: () => get<SaleRow[]>('/pos/sales', { store_id: storeId, under_path: underPath, q: search, status, from, to, page: pageNo, per_page: 30 })
	}));
	const showStore = $derived(scope.storeId === 'all');
	const pathOf = (storeId: string) => scope.units.find((u) => u.store_id === storeId)?.path;
	let openPath = $state<string | undefined>();
</script>

<PageHeader title="Penjualan" description="{scope.label} · riwayat transaksi, void dan retur">
	{#snippet actions()}
		<Input class="w-48" placeholder="No. dokumen" bind:value={search} oninput={() => (pageNo = 1)} />
		<Select class="w-36" bind:value={status} onchange={() => (pageNo = 1)}><option value="">Semua status</option><option value="completed">Selesai</option><option value="voided">Void</option></Select>
		<Input type="date" class="w-40" bind:value={from} onchange={() => (pageNo = 1)} aria-label="Dari tanggal" />
		<Input type="date" class="w-40" bind:value={to} onchange={() => (pageNo = 1)} aria-label="Sampai tanggal" />
	{/snippet}
</PageHeader>

<Card>
	{#if sales.isPending}<Empty title="Memuat…" />
	{:else if sales.isError}<Empty title="Gagal memuat" hint={sales.error.message} />
	{:else if !sales.data.data.length}<Empty title="Belum ada transaksi" hint="Transaksi dari layar kasir akan muncul di sini." />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Dokumen</th><th>Waktu</th>{#if showStore}<th>Toko</th>{/if}<th>Kasir</th><th>Bayar</th><th class="text-right">Total</th><th class="pr-4">Status</th></tr></thead>
			<tbody>
				{#each sales.data.data as s (s.id)}
					<tr class="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60" onclick={() => { openPath = pathOf(s.store_id); openId = s.id; }}>
						<td class="px-4 py-2.5 font-mono text-[13px]">{s.document_number}</td>
						<td class="num text-muted">{dateTime(s.created_at)}</td>
						{#if showStore}<td>{s.store_name}</td>{/if}
						<td>{s.cashier_name}</td><td class="text-muted">{s.methods || '—'}</td>
						<td class="num text-right font-medium {s.status === 'voided' ? 'text-muted line-through' : ''}">{idr(s.grand_total)}{#if Number(s.refunded_total) > 0}<br /><span class="text-[12px] font-normal text-warn">retur {idr(s.refunded_total)}</span>{/if}</td>
						<td class="pr-4"><Badge tone={s.status === 'completed' ? 'ok' : 'danger'}>{s.status === 'completed' ? 'Selesai' : 'VOID'}</Badge></td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if sales.data.meta}
			<div class="flex items-center justify-between border-t border-border px-4 py-2">
				<span class="text-muted">{sales.data.meta.total} transaksi</span>
				<div class="flex gap-2">
					<Button size="sm" variant="secondary" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button>
					<Button size="sm" variant="secondary" disabled={pageNo >= sales.data.meta.total_pages} onclick={() => pageNo++}>Berikutnya</Button>
				</div>
			</div>
		{/if}
	{/if}
</Card>

<SaleDialog bind:saleId={openId} me={data.me} storePath={openPath} />
