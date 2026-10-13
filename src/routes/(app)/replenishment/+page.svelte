<script lang="ts">
	import { goto } from '$app/navigation';
	import { createMutation, createQuery } from '@tanstack/svelte-query';
	import { ArrowDown, ArrowUp, Minus, ShoppingCart } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { idr, num } from '#lib/utils/format';
	import { errMsg } from '#lib/utils/errors';
	import type { ReplenishmentResult, ReplenishmentSuggestion } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	let windowDays = $state('28');
	let coverDays = $state('7');
	let picked = $state<Record<string, boolean>>({});
	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const canOrder = $derived(can(data.me.grants, 'purchase_order.create'));

	const q = createQuery(() => ({
		queryKey: ['replenishment', storeId, windowDays, coverDays],
		placeholderData: (p) => p,
		queryFn: async () => (await get<ReplenishmentResult>('/replenishment', { store_id: storeId, window_days: windowDays, cover_days: coverDays })).data
	}));
	const rows = $derived(q.data?.suggestions ?? []);
	const key = (r: ReplenishmentSuggestion) => `${r.warehouse_id}:${r.variant_id}`;
	const chosen = $derived(rows.filter((r) => picked[key(r)] && r.supplier_id));
	const chosenCost = $derived(chosen.reduce((s, r) => s + Number(r.estimated_cost), 0));
	const tone = { stockout: 'danger', critical: 'warn', reorder: 'info' } as const;
	const label = { stockout: 'Habis', critical: 'Kritis', reorder: 'Pesan ulang' } as const;

	const draft = createMutation(() => ({
		mutationFn: async () => (await post<{ id: string; document_number: string }[]>('/replenishment/draft-po', { lines: chosen.map((r) => ({ warehouse_id: r.warehouse_id, supplier_id: r.supplier_id, variant_id: r.variant_id, qty: Number(r.suggested_qty) })) })).data,
		onSuccess: (r) => { toast.ok(`${r.length} draft PO dibuat (${r.map((d) => d.document_number).join(', ')})`); picked = {}; void goto('/purchasing'); },
		onError: (e) => toast.error(errMsg(e))
	}));
	function toggleAll(on: boolean) { picked = Object.fromEntries(rows.filter((r) => r.supplier_id).map((r) => [key(r), on])); }
</script>

<PageHeader title="Saran pengisian stok" description="{scope.label} · dihitung dari penjualan {windowDays} hari terakhir, lead time supplier, dan stok pengaman">
	{#snippet actions()}
		<Select bind:value={windowDays} aria-label="Riwayat"><option value="14">Riwayat 14 hari</option><option value="28">Riwayat 28 hari</option><option value="56">Riwayat 56 hari</option></Select>
		<Select bind:value={coverDays} aria-label="Cakupan"><option value="7">Cakup 7 hari</option><option value="14">Cakup 14 hari</option><option value="21">Cakup 21 hari</option></Select>
	{/snippet}
</PageHeader>

<Card>
	{#if q.isPending}<Empty title="Menghitung…" />
	{:else if !rows.length}<Empty title="Stok aman" hint="Tidak ada SKU yang perlu dipesan ulang untuk cakupan ini." />
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
			<span class="text-muted">{num(rows.length)} SKU disarankan · perkiraan {idr(q.data?.total_cost ?? 0)}</span>
			{#if canOrder}
				<span class="flex items-center gap-2">
					{#if chosen.length}<span class="text-muted">{chosen.length} dipilih · {idr(chosenCost)}</span>{/if}
					<Button size="sm" variant="secondary" onclick={() => toggleAll(true)}>Pilih semua</Button>
					<Button size="sm" disabled={!chosen.length} loading={draft.isPending} onclick={() => draft.mutate()}><ShoppingCart class="size-4" />Buat draft PO</Button>
				</span>
			{/if}
		</div>
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr>{#if canOrder}<th class="w-10 px-4"></th>{/if}<th class="px-4 py-2.5">SKU</th><th>Toko</th><th class="text-right">Stok</th><th class="text-right">Laku/hari</th><th class="text-right">Cukup</th><th class="text-right">Pesan</th><th>Supplier</th><th class="pr-4 text-right">Perkiraan</th></tr></thead>
			<tbody>
				{#each rows as r (key(r))}
					<tr class="border-b border-border last:border-0 hover:bg-surface-2/50">
						{#if canOrder}<td class="px-4"><input type="checkbox" aria-label="Pilih {r.sku}" disabled={!r.supplier_id} checked={!!picked[key(r)]} onchange={(e) => (picked[key(r)] = e.currentTarget.checked)} /></td>{/if}
						<td class="px-4 py-2.5"><span class="font-medium">{r.name}</span><br /><span class="font-mono text-[12px] text-muted">{r.sku}</span></td>
						<td>{r.store_name}</td>
						<td class="num text-right">{num(Number(r.on_hand))}{#if Number(r.in_transit) > 0}<br /><span class="text-[12px] text-muted">+{num(Number(r.in_transit))} dalam perjalanan</span>{/if}</td>
						<td class="num text-right">{r.daily_demand}
							<span class="ml-0.5 inline-block align-middle">{#if r.trend === 'up'}<ArrowUp class="size-3.5 text-ok" aria-label="naik" />{:else if r.trend === 'down'}<ArrowDown class="size-3.5 text-danger" aria-label="turun" />{:else}<Minus class="size-3.5 text-muted" aria-label="stabil" />{/if}</span></td>
						<td class="num text-right">{r.days_of_cover === null ? '—' : `${r.days_of_cover} hr`}<br /><Badge tone={tone[r.urgency]}>{label[r.urgency]}</Badge></td>
						<td class="num text-right font-semibold">{num(Number(r.suggested_qty))}</td>
						<td>{#if r.supplier_id}{r.supplier_name}<br /><span class="text-[12px] text-muted">lead {r.lead_days} hr</span>{:else}<span class="text-warn">belum ada supplier</span>{/if}</td>
						<td class="num pr-4 text-right">{idr(r.estimated_cost)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>
<p class="mt-3 text-[12px] text-muted">Saran bukan pesanan: draft PO tetap melewati alur ajukan → setujui. Rumus: laku/hari × (lead time + hari cakupan) + stok pengaman, dikurangi stok dan barang dalam perjalanan, dibulatkan ke kelipatan MOQ.</p>
