<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { get } from '#lib/api/client';
	import { useScope } from '#lib/scope/scope.svelte';
	import { dateTime, idr } from '#lib/utils/format';
	import type { Shift, ShiftRow } from '#lib/types/api';

	const scope = useScope();
	let status = $state('');
	let openId = $state<string | null>(null);
	let open = $state(false);
	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);

	const shifts = createQuery(() => ({ queryKey: ['shifts', storeId, status], queryFn: async () => (await get<ShiftRow[]>('/pos/shifts', { store_id: storeId, status, per_page: 50 })).data }));
	const detail = createQuery(() => ({ queryKey: ['shift', openId], enabled: !!openId, queryFn: async () => (await get<Shift>(`/pos/shifts/${openId}`)).data }));
	const tone = (v: string | null) => (v === null ? 'neutral' : Number(v) === 0 ? 'ok' : 'danger');
</script>

<PageHeader title="Shift kasir" description="{scope.label} · kas awal, penjualan, dan selisih hitung kas">
	{#snippet actions()}
		<Select class="w-40" bind:value={status}><option value="">Semua</option><option value="open">Berjalan</option><option value="closed">Selesai</option></Select>
	{/snippet}
</PageHeader>

<Card>
	{#if shifts.isPending}<Empty title="Memuat…" />
	{:else if shifts.isError}<Empty title="Gagal memuat" hint={shifts.error.message} />
	{:else if !shifts.data.length}<Empty title="Belum ada shift" />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Toko / terminal</th><th>Kasir</th><th>Buka</th><th>Tutup</th><th class="text-right">Kas awal</th><th class="text-right">Seharusnya</th><th class="text-right">Dihitung</th><th class="pr-4 text-right">Selisih</th></tr></thead>
			<tbody>
				{#each shifts.data as s (s.id)}
					<tr class="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60" onclick={() => { openId = s.id; open = true; }}>
						<td class="px-4 py-2.5">{s.store_name} <span class="font-mono text-[12px] text-muted">{s.terminal_code}</span></td>
						<td>{s.cashier_name}</td><td class="num text-muted">{dateTime(s.opened_at)}</td>
						<td class="num text-muted">{s.status === 'open' ? 'berjalan' : dateTime(s.closed_at)}</td>
						<td class="num text-right">{idr(s.opening_cash)}</td><td class="num text-right">{idr(s.expected_cash)}</td><td class="num text-right">{idr(s.counted_cash)}</td>
						<td class="pr-4 text-right">{#if s.variance !== null}<Badge tone={tone(s.variance)}>{Number(s.variance) === 0 ? 'Sesuai' : idr(s.variance)}</Badge>{:else}—{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<Dialog bind:open title="Detail shift" wide onclose={() => (openId = null)}>
	{#if detail.data}
		{@const t = detail.data.totals}
		<dl class="grid grid-cols-2 gap-x-8 gap-y-1.5">
			<dt class="text-muted">Kas awal</dt><dd class="num text-right">{idr(t.opening_cash)}</dd>
			<dt class="text-muted">Penjualan tunai</dt><dd class="num text-right">{idr(t.cash_sales)}</dd>
			<dt class="text-muted">Kas masuk</dt><dd class="num text-right">{idr(t.cash_in)}</dd>
			<dt class="text-muted">Kas keluar</dt><dd class="num text-right">-{idr(t.cash_out)}</dd>
			<dt class="text-muted">Refund tunai</dt><dd class="num text-right">-{idr(t.cash_refunds)}</dd>
			<dt class="font-semibold">Seharusnya di laci</dt><dd class="num text-right font-semibold">{idr(t.expected_cash)}</dd>
			<dt class="text-muted">Non-tunai</dt><dd class="num text-right">{idr(t.noncash_sales)}</dd>
			<dt class="text-muted">Total penjualan</dt><dd class="num text-right">{idr(t.gross_sales)} · {t.sale_count} trx{t.void_count ? ` · ${t.void_count} void` : ''}</dd>
		</dl>
		{#if detail.data.status === 'closed'}
			<p class="font-medium {Number(detail.data.variance) === 0 ? 'text-ok' : 'text-danger'}">Dihitung {idr(detail.data.counted_cash)} · {Number(detail.data.variance) === 0 ? 'sesuai' : `selisih ${idr(detail.data.variance)}`}{detail.data.note ? ` — ${detail.data.note}` : ''}</p>
		{/if}
		{#if detail.data.movements?.length}
			<ul class="divide-y divide-border rounded-md border border-border">
				{#each detail.data.movements as m}<li class="flex justify-between px-3 py-1.5"><span>{m.type.replace('_', ' ')} · {m.reason}</span><span class="num">{idr(m.amount)}</span></li>{/each}
			</ul>
		{/if}
	{:else}<p class="text-muted">Memuat…</p>{/if}
</Dialog>
